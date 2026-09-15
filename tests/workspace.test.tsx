import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RuntimeProvider } from '../src/app/runtime';
import { AppRoutes } from '../src/app/router';
import { ApiClient } from '../src/lib/api/client';
import { AuthSession } from '../src/lib/auth/session';
import { createQueryClient } from '../src/lib/api/query';
import { recovery, tokens, vault, json, sessionId } from './helpers';
const hub = vi.hoisted(() => ({ reconnect: () => {}, events: new Map<string, (...args: unknown[]) => void>(), invokes: [] as string[] }));
vi.mock('../src/lib/signalr/session-connection', async importOriginal => {
  const original = await importOriginal<typeof import('../src/lib/signalr/session-connection')>();
  return { ...original, createConnection: () => ({
    start: async () => {}, stop: async () => {}, invoke: async (name: string) => { hub.invokes.push(name); },
    on: (event: string, fn: (...args: unknown[]) => void) => { hub.events.set(event, fn); }, off: (event: string) => { hub.events.delete(event); },
    onreconnecting: () => {}, onreconnected: (fn: () => void) => { hub.reconnect = fn; }, onclose: () => {},
  }) };
});
describe('routed active workspace', () => {
  it('recovers Student context after browser refresh and refetches changed state after reconnect without console requests', async () => {
    let latest = recovery;
    const transport = vi.fn<typeof fetch>(async input => {
      const path = String(input);
      if (path.endsWith('/auth/refresh')) return json(tokens('Student', 'rotated'));
      if (path.endsWith('/state')) return json(latest);
      if (path.endsWith('/history')) return json([]);
      throw new Error(`Unexpected request: ${path}`);
    });
    const api = new ApiClient('', undefined, transport); const auth = new AuthSession(api, vault(tokens())); const queries = createQueryClient();
    const view = render(<RuntimeProvider runtime={{ api, auth, queries }}><MemoryRouter initialEntries={[`/simulation/${sessionId}`]}><AppRoutes/></MemoryRouter></RuntimeProvider>);
    expect(await screen.findByText('Decision')).toBeVisible(); expect(screen.getByText('BUYER')).toBeVisible(); expect(screen.getByText(recovery.teamId)).toBeVisible();
    expect(screen.getByText('Ready')).toBeVisible(); expect(screen.getByText(/Model-specific gameplay controls/)).toBeVisible();
    await waitFor(() => expect(screen.getAllByText('Connected').length).toBeGreaterThan(0));
    latest = { ...recovery, phase: 'Results', roundNumber: 3, version: 13 };
    hub.reconnect(); expect(await screen.findByText('Results')).toBeVisible(); expect(screen.getByText('3')).toBeVisible();
    expect(transport.mock.calls.every(([url]) => !String(url).includes('/console'))).toBe(true);
    expect(hub.invokes.filter(x => x === 'JoinSession').length).toBeGreaterThanOrEqual(2);
    view.unmount(); queries.clear(); expect(hub.events.size).toBe(0);
  });
});
