import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { ApiClient } from '../lib/api/client';
import { AuthSession, browserTokenVault } from '../lib/auth/session';
import { createQueryClient } from '../lib/api/query';
export interface Runtime { api: ApiClient; auth: AuthSession; queries: QueryClient }
const Context = createContext<Runtime | null>(null);
export function createRuntime(): Runtime {
  const origin = (import.meta.env.VITE_API_ORIGIN || '').replace(/\/$/, '');
  const api = new ApiClient(origin);
  const auth = new AuthSession(api, browserTokenVault(sessionStorage));
  const queries = createQueryClient();
  let previousIdentity: string | null = null;
  auth.subscribe(() => {
    const user = auth.snapshot().user;
    const identity = user ? `${user.id}:${[...user.roles].sort().join(',')}` : null;
    if (identity !== previousIdentity || !identity) { void queries.cancelQueries(); queries.clear(); }
    previousIdentity = identity;
  });
  return { api, auth, queries };
}
export function RuntimeProvider({ runtime, children }: { runtime: Runtime; children: ReactNode }) {
  return <Context.Provider value={runtime}><QueryClientProvider client={runtime.queries}>{children}</QueryClientProvider></Context.Provider>;
}
export function useRuntime() { const runtime = useContext(Context); if (!runtime) throw new Error('RuntimeProvider required'); return runtime; }
export function useAuth() { const { auth } = useRuntime(); return useSyncExternalStore(auth.subscribe, auth.snapshot); }
