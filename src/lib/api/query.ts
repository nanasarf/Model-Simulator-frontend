import { QueryClient } from '@tanstack/react-query';
export const keys = {
  currentUser: ['current-user'] as const,
  models: ['models'] as const,
  scenarioLists: (userId: string, status: string, modelIdentifier: string, search: string, page: number, pageSize: number) => ['user', userId, 'scenarios', status, modelIdentifier, search, page, pageSize] as const,
  definitions: (userId: string) => ['user', userId, 'simulation-definitions'] as const,
  scenarioVersions: (userId: string, scenarioId: string) => ['user', userId, 'scenario', scenarioId, 'versions'] as const,
  definitionVersions: (userId: string, definitionId: string) => ['user', userId, 'definition', definitionId, 'versions'] as const,
  publishedVersion: (userId: string, versionId: string) => ['user', userId, 'published-version', versionId] as const,
  templates: (userId: string, modelIdentifier: string) => ['user', userId, 'templates', modelIdentifier] as const,
  classrooms: (userId: string, page: number, pageSize: number) => ['user', userId, 'classrooms', page, pageSize] as const,
  classroom: (userId: string, id: string) => ['user', userId, 'classroom', id] as const,
  roster: (userId: string, id: string) => ['user', userId, 'classroom', id, 'roster'] as const,
  sessionLists: (userId: string, page: number, pageSize: number, classroomId: string, status: string, modelIdentifier: string) => ['user', userId, 'sessions', page, pageSize, classroomId, status, modelIdentifier] as const,
  mySessions: (userId: string) => ['user', userId, 'my-sessions'] as const,
  setup: (userId: string, id: string) => ['user', userId, 'session', id, 'setup'] as const,
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
