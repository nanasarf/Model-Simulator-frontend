import { expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RuntimeProvider } from '../src/app/runtime';
import { ClassroomListPage } from '../src/features/instructor/classrooms';
import { ApiClient } from '../src/lib/api/client';
import { createQueryClient } from '../src/lib/api/query';
import { AuthSession } from '../src/lib/auth/session';
import { json, sessionTransport, tokens, vault } from './helpers';

it('deletes a classroom with confirmation and removes it from the list', async () => {
  let items = [{ classroomId: 'class-1', name: 'Econ 101', courseId: 'c', courseCode: 'EC1', courseName: 'Economics' }];
  const calls: Array<{ path: string; method: string }> = [];
  const transport = vi.fn<typeof fetch>(async (input, init) => {
    const path = String(input); const method = init?.method ?? 'GET';
    calls.push({ path, method });
    if (path.endsWith('/auth/login')) return json(tokens('Instructor'));
    if (method === 'DELETE' && path === '/api/v1/classrooms/class-1') { items = []; return new Response(null, { status: 204 }); }
    if (path.startsWith('/api/v1/classrooms?')) return json({ items, page: 1, pageSize: 25, totalCount: items.length });
    throw new Error(`Unexpected request ${method} ${path}`);
  });
  const api = new ApiClient('', undefined, sessionTransport(transport));
  const auth = new AuthSession(api, vault());
  const queries = createQueryClient();
  await auth.login({ email: 'instructor@example.test', password: 'fixture-only' });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<RuntimeProvider runtime={{ api, auth, queries }}><MemoryRouter><ClassroomListPage /></MemoryRouter></RuntimeProvider>);

  await userEvent.click(await screen.findByRole('button', { name: 'Delete classroom' }));
  await waitFor(() => expect(screen.queryByText('Econ 101')).toBeNull());
  expect(calls.filter(c => c.method === 'DELETE')).toHaveLength(1);
  queries.clear();
});
