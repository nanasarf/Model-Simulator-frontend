import { Component, type ReactNode } from 'react';
import { ApiProblem } from '../lib/errors/problem';
export function LoadingState({ label = 'Loading your workspace' }: { label?: string }) { return <div className="state" role="status"><span className="loading-mark" aria-hidden="true"/><h2>{label}</h2><p>Please wait while we recover the latest information.</p></div>; }
export function BackgroundStatus({ active }: { active: boolean }) { return <span className="background-status" role="status">{active ? 'Updating from server…' : ''}</span>; }
export function EmptyState({ title, children }: { title: string; children: ReactNode }) { return <section className="state"><h2>{title}</h2><div>{children}</div></section>; }
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const problem = error instanceof ApiProblem ? error : null;
  const headings: Record<string, string> = { 'not-found': 'Resource unavailable', unauthorized: 'Access denied', unauthenticated: 'Sign in required', concurrency: 'A newer version is available', validation: 'Check your information', publication: 'Scenario is not ready to publish', readiness: 'Readiness requirement not met', idempotency: 'Submission conflict', 'missing-capability': 'This action is unavailable', lifecycle: 'Session state changed', duplicate: 'Already submitted', 'submission-limit': 'Submission limit reached' };
  return <section className="state error" role="alert"><h2>{problem ? headings[problem.kind] || problem.title : 'Unable to connect'}</h2>
    <p>{problem?.detail || (problem?.kind === 'not-found' ? 'This resource does not exist or is not available to your account.' : problem?.title) || 'The server could not be reached. Check your connection and try again.'}</p>
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
