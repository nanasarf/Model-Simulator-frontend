import { isProblem } from '../errors/problem';
export type SaveResult<T, D> = { kind: 'saved'; resource: T } | { kind: 'conflict'; draft: D; authoritative: T | null; recoveryError?: unknown };
/** The caller explicitly merges a conflict and starts another save; never auto-overwrite. */
export async function saveVersioned<T, D>(resourceVersion: number, draft: D,
  mutate: (draft: D, expectedVersion: number) => Promise<T>, refetch: () => Promise<T>): Promise<SaveResult<T, D>> {
  const preserved = structuredClone(draft);
  try { return { kind: 'saved', resource: await mutate(preserved, resourceVersion) }; }
  catch (error) {
    if (!isProblem(error, 'concurrency')) throw error;
    try { return { kind: 'conflict', draft: preserved, authoritative: await refetch() }; }
    catch (recoveryError) { return { kind: 'conflict', draft: preserved, authoritative: null, recoveryError }; }
  }
}
