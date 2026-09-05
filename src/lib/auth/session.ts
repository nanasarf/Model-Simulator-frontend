import type { CurrentUser, IssuedTokens, LoginRequest, RegisteredUser, RegisterRequest } from '../../types/auth';
import type { PlatformRole } from '../../types/platform';
import { ApiClient, sessionExpired, type Credentials } from '../api/client';

export interface TokenVault { read(): IssuedTokens | null; write(tokens: IssuedTokens): void; clear(): void }
export function browserTokenVault(storage: Storage): TokenVault {
  const key = 'simulation.auth.v1';
  return {
    read() { try { const v = JSON.parse(storage.getItem(key) || 'null'); return validTokens(v) ? v : null; } catch { return null; } },
    write(tokens) { storage.setItem(key, JSON.stringify(tokens)); },
    clear() { storage.removeItem(key); },
  };
}
function validTokens(value: unknown): value is IssuedTokens {
  const v = value as IssuedTokens | null;
  return !!v && typeof v.accessToken === 'string' && typeof v.refreshToken === 'string' && typeof v.accessTokenExpiresAt === 'string' && Number.isFinite(Date.parse(v.accessTokenExpiresAt));
}
export function userFromTokens(tokens: IssuedTokens): CurrentUser {
  const part = tokens.accessToken.split('.')[1];
  const bytes = Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const claims = JSON.parse(new TextDecoder().decode(bytes));
  if (typeof claims.sub !== 'string') throw sessionExpired();
  // TokenService uses ClaimTypes.Role, serialized as this URI by JwtSecurityToken.
  const raw = claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
  const roles = (Array.isArray(raw) ? raw : [raw]).filter((r): r is PlatformRole => ['Instructor', 'Student', 'PlatformAdministrator'].includes(r));
  return { id: claims.sub, roles, accessTokenExpiresAt: tokens.accessTokenExpiresAt };
}
export type AuthState = { status: 'loading' | 'anonymous' | 'expired' | 'authenticated'; user: CurrentUser | null };
export class AuthSession implements Credentials {
  private state: AuthState = { status: 'loading', user: null };
  private tokens: IssuedTokens | null = null;
  private listeners = new Set<() => void>();
  private rotation: Promise<string> | null = null;
  private startup: Promise<void> | null = null;
  private generation = 0;
  constructor(private api: ApiClient, private vault: TokenVault) { api.attach(this); }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  private emit(status: AuthState['status'], user: CurrentUser | null = null) { this.state = { status, user }; this.listeners.forEach(f => f()); }
  private accept(tokens: IssuedTokens) {
    if (!validTokens(tokens)) throw sessionExpired();
    const user = userFromTokens(tokens);
    this.vault.write(tokens); this.tokens = tokens; this.emit('authenticated', user);
  }
  initialize() {
    return this.startup ??= (async () => {
      this.tokens = this.vault.read();
      if (!this.tokens) { this.emit('anonymous'); return; }
      // No /me exists. Rotation validates persisted credentials before protected UI appears.
      try { await this.refresh(); } catch { /* refresh invalidates */ }
    })();
  }
  async login(request: LoginRequest) {
    const generation = ++this.generation;
    const tokens = await this.api.json<IssuedTokens>('/api/v1/auth/login', { method: 'POST', body: request, anonymous: true });
    if (generation === this.generation) this.accept(tokens);
  }
  register(request: RegisterRequest) {
    return this.api.json<RegisteredUser>('/api/v1/auth/register', { method: 'POST', body: request, anonymous: true });
  }
  async getAccessToken() {
    if (!this.tokens) return null;
    if (Date.parse(this.tokens.accessTokenExpiresAt) <= Date.now() + 30_000) return this.refresh();
    return this.tokens.accessToken;
  }
  refresh(): Promise<string> {
    if (this.rotation) return this.rotation;
    if (!this.tokens) { this.invalidate(); return Promise.reject(sessionExpired()); }
    const refreshToken = this.tokens.refreshToken;
    const generation = this.generation;
    this.rotation = (async () => {
      try {
        const tokens = await this.api.json<IssuedTokens>('/api/v1/auth/refresh', { method: 'POST', body: { refreshToken }, anonymous: true });
        if (generation !== this.generation) throw sessionExpired();
        this.accept(tokens); return tokens.accessToken;
      } catch (error) { if (generation === this.generation) this.invalidate(); throw error; }
      finally { this.rotation = null; }
    })();
    return this.rotation;
  }
  invalidate() { this.generation++; this.tokens = null; this.vault.clear(); this.emit('expired'); }
  async logout() {
    // Finish any already-started rotation so logout revokes the replacement, not its predecessor.
    try { await this.rotation; } catch { /* already invalidated */ }
    const token = this.tokens?.refreshToken;
    this.generation++; this.tokens = null; this.vault.clear(); this.emit('anonymous');
    if (token) await this.api.json<void>('/api/v1/auth/logout', { method: 'POST', body: { refreshToken: token }, anonymous: true });
  }
}
