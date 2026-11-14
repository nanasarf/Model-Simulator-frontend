import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RuntimeProvider } from '../src/app/runtime';
import { InstructorHome } from '../src/features/instructor/home';
import { ApiClient } from '../src/lib/api/client';
import { createQueryClient } from '../src/lib/api/query';
import { AuthSession } from '../src/lib/auth/session';
import { json, sessionId, sessionTransport, tokens, vault } from './helpers';

it('shows draft and running sessions without requesting retired session codes', async () => {
  const calls: string[] = [];
  const transport = vi.fn<typeof fetch>(async input => {
    const path = String(input);
    calls.push(path);
    if (path.endsWith('/auth/login')) return json(tokens('Instructor'));
    if (path.startsWith('/api/v1/sessions?')) return json({
      items: [
        { sessionId, scenarioTitle: 'Draft simulation', classroomName: 'Class A', status: 'Draft', currentRound: 0, currentPhase: 'Setup' },
        { sessionId: 'running-session', scenarioTitle: 'Running simulation', classroomName: 'Class B', status: 'Running', currentRound: 1, currentPhase: 'Decision' },
      ], page: 1, pageSize: 8, totalCount: 2,
    });
    if (path.startsWith('/api/v1/scenarios?')) return json({ items: [], page: 1, pageSize: 6, totalCount: 0 });
    if (path.startsWith('/api/v1/classrooms?')) return json({ items: [], page: 1, pageSize: 1, totalCount: 2 });
    throw new Error(`Unexpected request: ${path}`);
  });
  const api = new ApiClient('', undefined, sessionTransport(transport));
  const auth = new AuthSession(api, vault());
  const queries = createQueryClient();
  await auth.login({ email: 'instructor@example.test', password: 'fixture-only' });
  const view = render(<RuntimeProvider runtime={{ api, auth, queries }}><MemoryRouter><InstructorHome /></MemoryRouter></RuntimeProvider>);

  expect(await screen.findByText('Running simulation')).toBeVisible();
  expect(screen.getAllByText('Draft simulation').length).toBeGreaterThan(0);
  expect(screen.getAllByRole('link', { name: 'Open Session' }).map(link => link.getAttribute('href')))
    .toContain(`/instructor/sessions/${sessionId}/setup`);
  expect(calls.some(path => path.includes('/join-code'))).toBe(false);
  view.unmount();
  queries.clear();
});
