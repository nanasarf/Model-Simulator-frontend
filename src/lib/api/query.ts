import { QueryClient } from '@tanstack/react-query';
export const keys = {
  currentUser: ['current-user'] as const,
  models: ['models'] as const,
  scenarioLists: (userId: string) => ['user', userId, 'scenarios'] as const, // Reserved: no endpoint.
  scenario: (userId: string, model: string, id: string) => ['user', userId, 'scenario', model, id] as const,
  readiness: (userId: string, model: string, id: string) => ['user', userId, 'scenario', model, id, 'readiness'] as const,
  sessions: (userId: string) => ['user', userId, 'sessions'] as const, // Reserved: no endpoint.
  state: (userId: string, id: string) => ['user', userId, 'session', id, 'state'] as const,
  history: (userId: string, id: string) => ['user', userId, 'session', id, 'history'] as const,
  console: (userId: string, id: string, model: string) => ['user', userId, 'session', id, 'console', model] as const,
  analytics: (userId: string, id: string) => ['user', userId, 'session', id, 'analytics'] as const,
  replay: (userId: string, id: string, model: string) => ['user', userId, 'session', id, 'replay', model] as const,
};
export const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: false, refetchOnWindowFocus: true }, mutations: { retry: false } } });
export async function invalidateSession(client: QueryClient, userId: string, sessionId: string) {
  await client.invalidateQueries({ queryKey: ['user', userId, 'session', sessionId] });
}
