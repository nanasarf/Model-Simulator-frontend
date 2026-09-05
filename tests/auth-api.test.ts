import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../src/lib/api/client';
import { AuthSession, userFromTokens } from '../src/lib/auth/session';
import { tokens, vault, json, userId } from './helpers';
import { logicalOperation } from '../src/lib/idempotency';
function setup(responses: Response[], initial = null as ReturnType<typeof tokens> | null) {
  const transport = vi.fn<typeof fetch>(); responses.forEach(r => transport.mockResolvedValueOnce(r));
  const api = new ApiClient('', undefined, transport); const storage = vault(initial); const auth = new AuthSession(api, storage);
  return { api, auth, storage, transport };
}
describe('authentication lifecycle', () => {
  it('logs in and uses only backend user/role claims', async () => {
    const s = setup([json(tokens('Instructor'))]); await s.auth.initialize();
    await s.auth.login({ email: 'teacher@example.test', password: 'password' });
    expect(s.auth.snapshot()).toMatchObject({ status: 'authenticated', user: { id: userId, roles: ['Instructor'] } });
    expect(s.storage.read()?.refreshToken).toBe('first');
    expect(s.transport.mock.calls[0][1]?.headers).not.toHaveProperty('Authorization');
  });
  it('preserves failed-login Problem Details without refreshing', async () => {
    const s = setup([json({ title: 'authentication.invalid_credentials' }, 401)]); await s.auth.initialize();
    await expect(s.auth.login({ email: 'a@b.test', password: 'bad' })).rejects.toMatchObject({ errorCode: 'authentication.invalid_credentials' });
    expect(s.transport).toHaveBeenCalledTimes(1); expect(s.auth.snapshot().user).toBeNull();
  });
  it('startup stays loading until persisted refresh validates the current user', async () => {
    let finish!: (r: Response) => void;
    const transport = vi.fn<typeof fetch>(() => new Promise(r => { finish = r; }));
    const auth = new AuthSession(new ApiClient('', undefined, transport), vault(tokens()));
    const startup = auth.initialize(); expect(auth.snapshot().status).toBe('loading');
    finish(json(tokens('Student', 'rotated'))); await startup; expect(auth.snapshot().status).toBe('authenticated');
    expect(transport.mock.calls[0][0]).toBe('/api/v1/auth/refresh');
  });
  it('refreshes expired access before an authenticated request and rotates the secret', async () => {
    const s = setup([json(tokens('Student', 'old', Date.now() - 1)), json(tokens('Student', 'new')), json({ ok: true })]);
    await s.auth.login({ email: 'a@b.test', password: 'p' });
    await s.api.json('/api/v1/sessions/x/state');
    expect(s.transport.mock.calls.map(c => c[0])).toEqual(['/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/sessions/x/state']);
    expect(s.storage.read()?.refreshToken).toBe('new');
  });
  it('retries an explicit 401 once, with the same idempotency key and body', async () => {
    const s = setup([json(tokens()), json({}, 401), json(tokens('Student', 'new')), json({ id: 'ok' }, 202)]);
    await s.auth.login({ email: 'a@b.test', password: 'p' }); const operation = logicalOperation('action.submit', { actionCode: 'SUBMIT_BUYER_BID' });
    await s.api.json('/api/v1/sessions/x/actions', { method: 'POST', serializedBody: operation.body, idempotencyKey: operation.key });
    const first = s.transport.mock.calls[1][1]!, retry = s.transport.mock.calls[3][1]!;
    expect(first.body).toBe(retry.body); expect(new Headers(first.headers).get('Idempotency-Key')).toBe(new Headers(retry.headers).get('Idempotency-Key'));
    expect(new Headers(retry.headers).get('Authorization')).toBe(`Bearer ${tokens('Student', 'new').accessToken}`);
  });
  it('clears credentials when refresh fails, including security-stamp invalidation', async () => {
    const s = setup([json(tokens()), json({}, 401), json({ title: 'authentication.invalid_token' }, 401)]);
    await s.auth.login({ email: 'a@b.test', password: 'p' }); await expect(s.api.json('/api/v1/models')).rejects.toMatchObject({ status: 401 });
    expect(s.auth.snapshot().status).toBe('expired'); expect(s.storage.read()).toBeNull(); expect(s.transport).toHaveBeenCalledTimes(3);
  });
  it('a second 401 never creates a refresh loop', async () => {
    const s = setup([json(tokens()), json({}, 401), json(tokens('Student', 'new')), new Response(null, { status: 401 })]);
    await s.auth.login({ email: 'a@b.test', password: 'p' }); await expect(s.api.json('/api/v1/models')).rejects.toMatchObject({ status: 401 });
    expect(s.auth.snapshot().status).toBe('expired'); expect(s.transport).toHaveBeenCalledTimes(4);
  });
  it('coalesces concurrent refreshes', async () => {
    const s = setup([json(tokens()), json(tokens('Student', 'rotated'))]); await s.auth.login({ email: 'a@b.test', password: 'p' });
    const [a, b] = await Promise.all([s.auth.refresh(), s.auth.refresh()]); expect(a).toBe(b); expect(s.transport).toHaveBeenCalledTimes(2);
  });
  it('logs out with the refresh token and clears local credentials', async () => {
    const s = setup([json(tokens()), new Response(null, { status: 204 })]); await s.auth.login({ email: 'a@b.test', password: 'p' });
    await s.auth.logout(); expect(s.auth.snapshot().status).toBe('anonymous'); expect(s.storage.read()).toBeNull();
    expect(s.transport.mock.calls[1][1]?.body).toBe(JSON.stringify({ refreshToken: 'first' }));
  });
  it('logout still clears local state on network failure', async () => {
    const s = setup([json(tokens())]); await s.auth.login({ email: 'a@b.test', password: 'p' }); s.transport.mockRejectedValueOnce(new TypeError('offline'));
    await expect(s.auth.logout()).rejects.toThrow(); expect(s.storage.read()).toBeNull(); expect(s.auth.snapshot().status).toBe('anonymous');
  });
  it('does not infer display name or unknown platform roles', () => { expect(userFromTokens(tokens('GOVERNMENT'))).toEqual({ id: userId, roles: [], accessTokenExpiresAt: expect.any(String) }); });
});
describe('central transport', () => {
  it('supports authenticated CSV downloads', async () => {
    const s = setup([json(tokens()), new Response('column\nvalue', { headers: { 'Content-Type': 'text/csv' } })]); await s.auth.login({ email: 'a@b.test', password: 'p' });
    const blob = await s.api.download('/api/v1/economics/macro/sessions/x/report?format=csv'); expect(await blob.text()).toBe('column\nvalue'); expect(new Headers(s.transport.mock.calls[1][1]?.headers).has('Authorization')).toBe(true);
  });
  it('cancels requests without sending them', async () => { const s = setup([]); const controller = new AbortController(); controller.abort(); await expect(s.api.json('/api/v1/models', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' }); expect(s.transport).not.toHaveBeenCalled(); });
  it('does not retry ambiguous network failures on mutations', async () => { const s = setup([]); s.transport.mockRejectedValue(new TypeError('offline')); await expect(s.api.json('/api/v1/courses', { method: 'POST', body: { code: 'X' } })).rejects.toThrow(); expect(s.transport).toHaveBeenCalledTimes(1); });
});
