import { vi } from 'vitest';
import type { IssuedTokens } from '../src/types/auth';
import type { TokenVault } from '../src/lib/auth/session';
export const userId = '11111111-1111-1111-1111-111111111111';
export const sessionId = '22222222-2222-2222-2222-222222222222';
export function tokens(role = 'Student', suffix = 'first', expires = Date.now() + 600_000): IssuedTokens {
  const claims = { sub: userId, 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': role, jti: suffix };
  return { accessToken: `header.${btoa(JSON.stringify(claims))}.signature`, refreshToken: suffix, accessTokenExpiresAt: new Date(expires).toISOString() };
}
export function vault(initial: IssuedTokens | null = null): TokenVault { let value = initial; return { read: () => value, write: v => { value = v; }, clear: vi.fn(() => { value = null; }) }; }
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
export const recovery = { sessionId, status: 'Running', phase: 'Decision', roundNumber: 2, teamId: '33333333-3333-3333-3333-333333333333', roleCodes: ['BUYER'], visibleState: null, version: 12, participants: [{ userId, teamId: '33333333-3333-3333-3333-333333333333', isReady: true, roles: ['BUYER'] }] };
