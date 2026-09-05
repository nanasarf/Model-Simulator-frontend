import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiClient } from '../src/lib/api/client';
import { AuthSession } from '../src/lib/auth/session';
import { createQueryClient } from '../src/lib/api/query';
import { RuntimeProvider } from '../src/app/runtime';
import { Protected, LoginPage } from '../src/features/auth/pages';
import { studentSessionService } from '../src/features/sessions/service';
import { instructorService } from '../src/features/instructor/service';
import { hasCapability, canPerform, isInstructor } from '../src/lib/permissions';
import { tokens, vault, json, recovery, userId, sessionId } from './helpers';
function routeSetup(role: string, path: string) {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(json(tokens(role, 'rotated')));
  const api = new ApiClient('', undefined, transport); const auth = new AuthSession(api, vault(tokens(role))); const queries = createQueryClient();
  render(<RuntimeProvider runtime={{ api, auth, queries }}><MemoryRouter initialEntries={[path]}><Routes><Route path="/auth" element={<LoginPage/>}/><Route element={<Protected role="Instructor"/>}><Route path="/instructor" element={<h1>Instructor content</h1>}/></Route><Route element={<Protected role="Student"/>}><Route path="/student" element={<h1>Student content</h1>}/></Route></Routes></MemoryRouter></RuntimeProvider>);
  return { auth, queries, transport };
}
describe('protected routes', () => {
  it('waits for auth before showing Instructor content', async () => { const s = routeSetup('Instructor', '/instructor'); expect(screen.queryByText('Instructor content')).not.toBeInTheDocument(); expect(await screen.findByText('Instructor content')).toBeVisible(); s.queries.clear(); });
  it('permits Student routes', async () => { const s = routeSetup('Student', '/student'); expect(await screen.findByText('Student content')).toBeVisible(); s.queries.clear(); });
  it('permits administrators under the backend Instructor policy', async () => { const s = routeSetup('PlatformAdministrator', '/instructor'); expect(await screen.findByText('Instructor content')).toBeVisible(); s.queries.clear(); });
  it.each([['Student', '/instructor', 'Instructor content'], ['Instructor', '/student', 'Student content']])('forbids %s at %s', async (role, path, content) => { const s = routeSetup(role, path); expect(await screen.findByText('This workspace is unavailable to your account')).toBeVisible(); expect(screen.queryByText(content)).not.toBeInTheDocument(); s.queries.clear(); });
  it('provides accessible login errors', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(json({ title: 'authentication.invalid_credentials', detail: 'Invalid email or password.' }, 401));
    const api = new ApiClient('', undefined, transport); const auth = new AuthSession(api, vault()); const queries = createQueryClient();
    render(<RuntimeProvider runtime={{ api, auth, queries }}><MemoryRouter><LoginPage/></MemoryRouter></RuntimeProvider>);
    const user = userEvent.setup(); await user.type(await screen.findByLabelText('Email address'), 'student@example.test'); await user.type(screen.getByLabelText('Password'), 'incorrect'); await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.'); expect(transport).toHaveBeenCalledTimes(1); queries.clear();
  });
});
describe('projection security', () => {
  it('student recovery paths request state/history only, never instructor consoles', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(json(recovery)).mockResolvedValueOnce(json([]));
    const service = studentSessionService(new ApiClient('', undefined, transport)); await service.state(sessionId); await service.history(sessionId);
    expect(transport.mock.calls.map(c => c[0])).toEqual([`/api/v1/sessions/${sessionId}/state`, `/api/v1/sessions/${sessionId}/history`]); expect(transport.mock.calls.some(c => String(c[0]).includes('/console'))).toBe(false);
  });
  it('instructor service refuses Student calls before HTTP', () => {
    const transport = vi.fn<typeof fetch>(); const service = instructorService(new ApiClient('', undefined, transport), { id: userId, roles: ['Student'], accessTokenExpiresAt: '' });
    expect(() => service.macroConsole(sessionId)).toThrow('Instructor access is required.'); expect(() => service.marketConsole(sessionId)).toThrow(); expect(transport).not.toHaveBeenCalled();
  });
  it('roles never become capabilities and unknown grants fail closed', () => {
    const user = { id: userId, roles: ['Student'] as const, accessTokenExpiresAt: '' }; const mutableUser = { ...user, roles: [...user.roles] };
    expect(hasCapability(['GOVERNMENT'], 'MACRO_SET_FISCAL_POLICY')).toBe(false); expect(hasCapability(null, 'MARKET_SUBMIT_BID')).toBe(false);
    expect(canPerform(mutableUser, { platformRole: 'Student', capability: 'MARKET_SUBMIT_BID' }, ['MARKET_SUBMIT_BID'])).toBe(true); expect(isInstructor(mutableUser)).toBe(false);
  });
});
