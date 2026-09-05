export type ProblemKind = 'validation' | 'unauthenticated' | 'unauthorized' | 'not-found' | 'lifecycle' | 'readiness' | 'duplicate' | 'rule-denied' | 'idempotency' | 'concurrency' | 'publication' | 'missing-capability' | 'unexpected';
export class ApiProblem extends Error {
  constructor(public status: number, public type: string, public title: string, public detail: string,
    public errorCode?: string, public fieldErrors: Record<string, string[]> = {}, public traceId?: string) {
    super(detail || title); this.name = 'ApiProblem';
  }
  get kind(): ProblemKind {
    if (this.status === 401) return 'unauthenticated';
    if (this.errorCode === 'action.capability_denied' || this.errorCode === 'capability.denied') return 'missing-capability';
    if (this.status === 403) return 'unauthorized';
    if (this.status === 404) return 'not-found'; // Ownership is deliberately indistinguishable.
    if (this.errorCode === 'concurrency.conflict') return 'concurrency';
    if (this.errorCode?.startsWith('idempotency.')) return 'idempotency';
    if (this.errorCode === 'scenario.validation_failed') return 'publication';
    if (this.errorCode?.startsWith('readiness.') || ['session.not_ready', 'team.not_ready', 'round.not_ready'].includes(this.errorCode || '')) return 'readiness';
    if (this.errorCode === 'round.already_executed' || this.errorCode === 'persistence.duplicate') return 'duplicate';
    // rule.denied does not identify which rule failed; submission-count inference is unsafe.
    if (this.errorCode === 'rule.denied') return 'rule-denied';
    if (['session.frozen', 'session.status_conflict', 'action.phase_invalid', 'action.phase_denied', 'scenario_draft.immutable'].includes(this.errorCode || '')) return 'lifecycle';
    if (this.status === 400 || this.status === 422 || Object.keys(this.fieldErrors).length) return 'validation';
    return 'unexpected';
  }
}
const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const string = (v: unknown) => typeof v === 'string' ? v : undefined;
export async function parseProblem(response: Response): Promise<ApiProblem> {
  let body: Record<string, unknown> = {};
  try { body = object(await response.json()); } catch { /* Empty policy responses are implemented. */ }
  const extensions = object(body.extensions);
  const title = string(body.title) || ({ 401: 'Sign in required', 403: 'Access denied', 404: 'Resource unavailable', 409: 'Request conflict' }[response.status] ?? `Request failed (${response.status})`);
  const errors = object(body.errors ?? body.fieldErrors ?? extensions.errors);
  const fieldErrors: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(errors)) {
    if (Array.isArray(value)) fieldErrors[key] = value.filter((x): x is string => typeof x === 'string');
    else if (typeof value === 'string') fieldErrors[key] = [value];
  }
  return new ApiProblem(response.status, string(body.type) || 'about:blank', title, string(body.detail) || '',
    string(body.errorCode ?? extensions.errorCode) || (/^[a-z_]+\.[a-z_.]+$/.test(title) ? title : undefined), fieldErrors,
    string(body.traceId ?? extensions.traceId) || response.headers.get('traceparent') || response.headers.get('x-correlation-id') || undefined);
}
export const isProblem = (error: unknown, kind: ProblemKind) => error instanceof ApiProblem && error.kind === kind;
