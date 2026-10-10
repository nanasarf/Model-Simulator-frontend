import { Component, type ReactNode } from 'react';
import { ApiProblem } from '../lib/errors/problem';
export function LoadingState({ label = 'Loading your workspace' }: { label?: string }) { return <div className="state" role="status"><span className="loading-mark" aria-hidden="true"/><h2>{label}</h2><p>Please wait while we recover the latest information.</p></div>; }
export function BackgroundStatus({ active }: { active: boolean }) { return <span className="background-status" role="status">{active ? 'Updating from server…' : ''}</span>; }
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) { return <section className="state"><h2>{title}</h2>{children && <div>{children}</div>}</section>; }
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const problem = error instanceof ApiProblem ? error : null;
  const headings: Record<string, string> = { 'not-found': 'Resource unavailable', unauthorized: 'Access denied', unauthenticated: 'Sign in required', concurrency: 'A newer version is available', validation: 'Check your information', publication: 'Scenario is not ready to publish', readiness: 'Readiness requirement not met', idempotency: 'Submission conflict', 'missing-capability': 'This action is unavailable', lifecycle: 'Session state changed', duplicate: 'Already submitted', 'submission-limit': 'Submission limit reached' };
  const codedTitle = (value: string | undefined) => !!value && /^[a-z_]+\.[a-z_.]+$/i.test(value);
  const heading = !problem ? 'Unable to connect'
    : headings[problem.kind]
      || (problem.kind === 'unexpected' && codedTitle(problem.title) ? 'An unexpected error occurred' : problem.title);
  const detail = problem?.detail
    || (problem?.kind === 'not-found'
      ? 'This resource does not exist or is not available to your account.'
      : problem && codedTitle(problem.title)
        ? 'Please try again. If the issue persists, contact support with the reference below.'
        : problem?.title)
    || 'The server could not be reached. Check your connection and try again.';
  return <section className="state error" role="alert"><h2>{heading}</h2>
    <p>{detail}</p>
    {problem && Object.entries(problem.fieldErrors).map(([field, errors]) => <p key={field}><strong>{field}: </strong>{errors.join(' ')}</p>)}
    {problem?.traceId && <p className="support-id">Support reference: <code>{problem.traceId}</code></p>}
    {retry && <button type="button" onClick={retry}>Try again</button>}
  </section>;
}
export function ConflictState({ children }: { children: ReactNode }) { return <section className="state error" role="alert"><h2>A newer version is available</h2><p>Your unsaved changes are preserved. Review the latest version and merge your changes before saving again.</p>{children}</section>; }
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main className="standalone"><h1>Workspace could not be displayed</h1><p>Reload to recover your session from the server.</p><button onClick={() => window.location.reload()}>Reload workspace</button></main> : this.props.children; }
}
