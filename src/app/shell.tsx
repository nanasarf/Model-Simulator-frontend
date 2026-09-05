import { createContext, useContext, useState, type Dispatch, type SetStateAction } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth, useRuntime } from './runtime';
import { isInstructor, hasPlatformRole } from '../lib/permissions';
import type { ConnectionStatus } from '../lib/signalr/session-connection';
const ConnectionContext = createContext<Dispatch<SetStateAction<ConnectionStatus | null>>>(() => {});
export const useConnectionStatus = () => useContext(ConnectionContext);
export function ConnectionLabel({ status }: { status: ConnectionStatus | null }) {
  const labels = { connected: 'Connected', reconnecting: 'Reconnecting…', disconnected: 'Disconnected', expired: 'Session expired' };
  return <span className={`connection ${status || ''}`} role="status"><span aria-hidden="true" className="dot"/>{status ? labels[status] : 'No live session'}</span>;
}
export function Shell() {
  const { user } = useAuth(); const { auth } = useRuntime(); const navigate = useNavigate();
  const [connection, setConnection] = useState<ConnectionStatus | null>(null); const [signingOut, setSigningOut] = useState(false);
  async function logout() { setSigningOut(true); try { await auth.logout(); navigate('/auth', { replace: true }); } catch { navigate('/auth', { replace: true, state: { logoutError: true } }); } finally { setSigningOut(false); } }
  return <ConnectionContext.Provider value={setConnection}><a className="skip-link" href="#main">Skip to content</a><div className="app-shell">
    <header className="topbar"><Link className="brand" to="/">S<span aria-hidden="true">/</span>P <span className="brand-name">Simulation Platform</span></Link><div className="account"><span className="identity">{user?.roles.join(' · ')}<small title={user?.id}>Account {user?.id}</small></span><button className="secondary" onClick={logout} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button></div></header>
    <div className="workspace"><aside className="sidebar"><p className="eyebrow">Workspace</p><nav aria-label="Primary navigation">
      {isInstructor(user) && <><NavLink end to="/instructor">Instructor home</NavLink><NavLink to="/instructor/scenarios">Scenarios</NavLink><NavLink to="/instructor/sessions">Instructor sessions</NavLink></>}
      {hasPlatformRole(user, 'Student') && <><NavLink end to="/student">Student home</NavLink><NavLink to="/student/sessions">My sessions</NavLink></>}
      </nav><div className="sidebar-foot"><ConnectionLabel status={connection}/><p>Learn through experience.</p></div></aside>
      <main id="main" tabIndex={-1}><Outlet/></main></div><footer className="mobile-connection"><ConnectionLabel status={connection}/></footer>
  </div></ConnectionContext.Provider>;
}
