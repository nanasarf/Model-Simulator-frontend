import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth, useRuntime } from '../../app/runtime';
import { isInstructor, hasPlatformRole } from '../../lib/permissions';
import { LoadingState, ErrorState } from '../../components/states';
import type { PlatformRole } from '../../types/platform';
export function homeFor(user: ReturnType<typeof useAuth>['user']) { return isInstructor(user) ? '/instructor' : hasPlatformRole(user, 'Student') ? '/student' : '/forbidden'; }
export function Protected({ role }: { role?: PlatformRole }) {
  const state = useAuth(); const { auth } = useRuntime(); const location = useLocation();
  useEffect(() => { void auth.initialize(); }, [auth]);
  if (state.status === 'loading') return <LoadingState label="Checking your sign-in"/>;
  if (!state.user) return <Navigate to="/auth" state={{ returnTo: location.pathname }} replace/>;
  if (role && !(role === 'Instructor' ? isInstructor(state.user) : hasPlatformRole(state.user, role))) return <Forbidden/>;
  return <Outlet/>;
}
export function Forbidden() { const { user } = useAuth(); return <main className="standalone"><p className="eyebrow">Access restricted</p><h1>This workspace is unavailable to your account</h1><p>Your platform role does not grant access to this page.</p>{homeFor(user) !== '/forbidden' && <Link to={homeFor(user)}>Return to your home</Link>}</main>; }
export function LoginPage() {
  const { auth } = useRuntime(); const state = useAuth(); const location = useLocation();
  const [error, setError] = useState<unknown>(); const [pending, setPending] = useState(false);
  useEffect(() => { void auth.initialize(); }, [auth]);
  const returnTo = location.state?.returnTo;
  if (state.status === 'loading') return <LoadingState label="Checking your sign-in"/>;
  if (state.user) return <Navigate replace to={typeof returnTo === 'string' && /^\/(simulation|instructor|student)(\/|$)/.test(returnTo) ? returnTo : homeFor(state.user)}/>;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setPending(true); setError(undefined);
    try { await auth.login({ email: String(data.get('email')), password: String(data.get('password')) }); }
    catch (error) { setError(error); } finally { setPending(false); }
  }
  return <main className="login-layout"><section className="login-intro"><Link className="brand" to="/auth">S<span aria-hidden="true">/</span>P</Link><p className="eyebrow">Simulation Platform</p><h1>A shared space.<br/>A new perspective.</h1><p>Explore decisions, connect ideas, and learn together.</p><div className="orbit" aria-hidden="true"><span/><span/><span/></div></section>
    <section className="login-form"><p className="eyebrow">Your classroom starts here</p><h2>Student and instructor sign in</h2><p>Teachers and students sign in with their classroom account. Your platform role opens the right workspace automatically.</p>
      {state.status === 'expired' && <p role="status" className="notice">Your session expired. Sign in to return to your workspace.</p>}
      {location.state?.logoutError && <p role="alert" className="notice">You are signed out on this device. Server sign-out could not be confirmed.</p>}
      <form onSubmit={submit} aria-busy={pending}><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="username" required autoFocus/>
        <label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required/>
        <button disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button></form>
      {error !== undefined && <ErrorState error={error}/>}<aside className="notice instructor-access" aria-label="Instructor account access"><h3>Instructor access</h3><p>Use the form above to sign in as an instructor.</p><Link to="/auth/instructor/register">Register as an instructor</Link></aside><p className="muted"><Link to="/auth/register">Student account registration</Link></p>
    </section></main>;
}

export function InstructorRegistrationPage() {
  return <main className="standalone"><p className="eyebrow">Simulation Platform</p><h1>Instructor registration</h1><section className="notice" role="status"><h2>Instructor accounts are platform-provisioned</h2><p>Self-service instructor registration is not available. Contact your platform administrator to create an instructor account, then return here to sign in.</p></section><p><Link to="/auth">Continue to instructor sign in</Link></p><p className="muted">Student accounts use a separate <Link to="/auth/register">registration page</Link>.</p></main>;
}
export function RegisterPage() {
  const { auth } = useRuntime(); const [error, setError] = useState<unknown>(); const [pending, setPending] = useState(false); const [created, setCreated] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setPending(true); setError(undefined);
    try { await auth.register({ email: String(data.get('email')), password: String(data.get('password')) }); setCreated(true); }
    catch (error) { setError(error); } finally { setPending(false); }
  }
  return <main className="standalone"><p className="eyebrow">Simulation Platform</p><h1>Create a student account</h1>{created ? <section role="status"><h2>Your account is ready</h2><p>Sign in to continue. Your instructor will arrange classroom and session access.</p><Link to="/auth">Continue to sign in</Link></section> : <><p>Your instructor assigns classroom access separately.</p><form onSubmit={submit} aria-busy={pending}><label htmlFor="register-email">Email address</label><input id="register-email" name="email" type="email" autoComplete="username" required/><label htmlFor="register-password">Password</label><input id="register-password" name="password" type="password" autoComplete="new-password" required/><button disabled={pending}>{pending ? 'Creating account…' : 'Create account'}</button></form>{error !== undefined && <ErrorState error={error}/>}<p><Link to="/auth">Already have an account? Sign in</Link></p></>}</main>;
}
