import { describe, expect, it, vi } from 'vitest';
import { ApiProblem, parseProblem } from '../src/lib/errors/problem';
import { saveVersioned } from '../src/lib/api/concurrency';
import { logicalOperation } from '../src/lib/idempotency';
import { json } from './helpers';
describe('Problem Details', () => {
  it('preserves validation fields and trace IDs', async () => { const problem = await parseProblem(json({ type: 'https://example.test/problem', title: 'Validation failed', detail: 'Check fields', errors: { email: ['Required'] }, traceId: 'trace-42' }, 400)); expect(problem).toMatchObject({ status: 400, type: 'https://example.test/problem', fieldErrors: { email: ['Required'] }, traceId: 'trace-42', kind: 'validation' }); });
  it.each([[401, 'authentication.required', 'unauthenticated'], [403, '', 'unauthorized'], [404, 'session.not_found', 'not-found'], [409, 'concurrency.conflict', 'concurrency'], [409, 'idempotency.conflict', 'idempotency'], [422, 'scenario.validation_failed', 'publication'], [422, 'action.capability_denied', 'missing-capability'], [422, 'capability.denied', 'missing-capability'], [422, 'readiness.submission_required', 'readiness'], [422, 'round.not_ready', 'readiness'], [409, 'round.already_executed', 'duplicate'], [422, 'rule.denied', 'rule-denied'], [409, 'session.status_conflict', 'lifecycle'], [422, 'action.phase_denied', 'lifecycle']] as const)('classifies %s %s', async (status, title, kind) => { expect((await parseProblem(json({ title }, status))).kind).toBe(kind); });
  it('supports empty policy responses', async () => { expect((await parseProblem(new Response(null, { status: 403 }))).kind).toBe('unauthorized'); });
  it('does not claim to distinguish ownership-hiding 404s', async () => { expect((await parseProblem(json({ title: 'session.not_found' }, 404))).kind).toBe('not-found'); });
});
describe('optimistic concurrency', () => {
  it('preserves unsaved input and refetches exactly once without overwriting', async () => {
    const mutate = vi.fn().mockRejectedValue(new ApiProblem(409, '', 'concurrency.conflict', '', 'concurrency.conflict')); const refetch = vi.fn().mockResolvedValue({ version: 4, name: 'Other edit' });
    const result = await saveVersioned(3, { name: 'My edit' }, mutate, refetch);
    expect(result).toEqual({ kind: 'conflict', draft: { name: 'My edit' }, authoritative: { version: 4, name: 'Other edit' } }); expect(mutate).toHaveBeenCalledExactlyOnceWith({ name: 'My edit' }, 3); expect(refetch).toHaveBeenCalledTimes(1);
  });
  it('still preserves draft if authoritative refetch fails', async () => { const failure = new Error('offline'); const result = await saveVersioned(3, 'my edit', async () => { throw new ApiProblem(409, '', '', '', 'concurrency.conflict'); }, async () => { throw failure; }); expect(result).toMatchObject({ kind: 'conflict', draft: 'my edit', authoritative: null, recoveryError: failure }); });
  it('returns authoritative saved state', async () => { expect(await saveVersioned(1, 'edit', async (_, version) => ({ version: version + 1 }), vi.fn())).toEqual({ kind: 'saved', resource: { version: 2 } }); });
});
describe('logical idempotency', () => {
  it('new actions get different keys and an immutable serialized body', () => { const draft = { price: 10 }; const first = logicalOperation('action.submit', draft); const second = logicalOperation('action.submit', draft); draft.price = 20; expect(first.key).not.toBe(second.key); expect(first.body).toBe('{"price":10}'); expect(Object.isFrozen(first)).toBe(true); });
});
