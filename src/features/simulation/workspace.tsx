import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useAuth, useRuntime } from '../../app/runtime';
import { ConnectionLabel, useConnectionStatus } from '../../app/shell';
import { LoadingState, ErrorState, BackgroundStatus } from '../../components/states';
import { sessionService } from '../sessions/service';
import { isSessionId } from '../sessions/open-session';
import { invalidateSession, keys } from '../../lib/api/query';
import { createConnection, SessionConnection, type ConnectionStatus } from '../../lib/signalr/session-connection';
import { sessionExpired } from '../../lib/api/client';
import { recoverContext, SessionProvider } from './context';
export function SimulationWorkspace() {
  const { sessionId = '' } = useParams();
  return isSessionId(sessionId) ? <ActiveSession key={sessionId} id={sessionId}/> : <section className="state"><h1>Invalid session ID</h1><p>Use the complete session ID provided by your instructor.</p></section>;
}
function ActiveSession({ id }: { id: string }) {
  const { api, auth, queries } = useRuntime(); const { user } = useAuth(); const uid = user!.id;
  const setShellStatus = useConnectionStatus(); const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [connectionError, setConnectionError] = useState<unknown>(); const [attempt, setAttempt] = useState(0);
  const service = sessionService(api);
  const state = useQuery({ queryKey: keys.state(uid, id), queryFn: ({ signal }) => service.state(id, signal) });
  const history = useQuery({ queryKey: keys.history(uid, id), queryFn: ({ signal }) => service.history(id, signal), enabled: !!state.data });
  const hasState = !!state.data;
  useEffect(() => {
    if (!hasState) return;
    let active = true;
    const update = (value: ConnectionStatus) => { if (active) { setStatus(value); setShellStatus(value); } };
    const recover = async () => {
      await queries.invalidateQueries({ queryKey: ['user', uid, 'session', id], refetchType: 'none' });
      await queries.fetchQuery({ queryKey: keys.state(uid, id), queryFn: ({ signal }) => service.state(id, signal) });
      await queries.fetchQuery({ queryKey: keys.history(uid, id), queryFn: ({ signal }) => service.history(id, signal) });
      if (active) setConnectionError(undefined);
    };
    const connection = new SessionConnection(createConnection(api.origin, async () => {
      const token = await auth.getAccessToken(); if (!token) throw sessionExpired(); return token;
    }), id, () => invalidateSession(queries, uid, id), recover, update, error => { if (active) setConnectionError(error); });
    void connection.start();
    const onVisible = () => { if (document.visibilityState === 'visible') void recover().catch(error => { if (active) setConnectionError(error); }); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; document.removeEventListener('visibilitychange', onVisible); setShellStatus(null); void connection.dispose().catch(() => {}); };
  // Service is stateless; the connection lifetime follows user/session, not query revisions.
  }, [api, auth, queries, uid, id, hasState, attempt, setShellStatus]);
  if (state.isPending) return <LoadingState label="Recovering your session"/>;
  if (!state.data) return <ErrorState error={state.error} retry={() => void state.refetch()}/>;
  const context = recoverContext(state.data, uid);
  return <SessionProvider value={context}><header className="page-heading"><p className="eyebrow">Classroom workspace</p><h1>Simulation session</h1><p className="support-id">{id}</p><ConnectionLabel status={status}/><BackgroundStatus active={state.isFetching}/></header>
    {state.isError && <ErrorState error={state.error} retry={() => void state.refetch()}/>}
    {status !== 'connected' && <section className="notice" role="status"><h2>{status === 'reconnecting' ? 'Restoring live updates' : 'Live updates disconnected'}</h2><p>The last recovered state is shown. Your classroom session is preserved on the server.</p>{status === 'disconnected' && <button className="secondary" onClick={() => setAttempt(x => x + 1)}>Reconnect</button>}</section>}
    {connectionError !== undefined && <ErrorState error={connectionError}/>}
    <dl className="session-facts"><div><dt>Status</dt><dd>{context.status}</dd></div><div><dt>Round</dt><dd>{context.roundNumber}</dd></div><div><dt>Phase</dt><dd>{context.phase}</dd></div><div><dt>Team ID</dt><dd>{context.teamId || 'Not assigned'}</dd></div><div><dt>Assigned roles</dt><dd>{context.roleCodes.join(', ') || 'Not assigned'}</dd></div><div><dt>Participant readiness</dt><dd>{context.participantReady === null ? 'Not a participant' : context.participantReady ? 'Ready' : 'Not ready'}</dd></div><div><dt>Round readiness</dt><dd>Unavailable</dd></div><div><dt>Capabilities</dt><dd>Unavailable</dd></div></dl>
    <section className="card gameplay-placeholder"><p className="eyebrow">Session recovered</p><h2>Your classroom context is saved.</h2><p>Gameplay is coming in the next milestone.</p><p className="notice">The server does not yet identify this session’s simulation model. The model workspace cannot be opened until that information is available.</p></section>
    <section className="recovery-note"><h2>Recovery details</h2><p>Session revision {context.version}. Participant readiness is the pre-start readiness value; it does not indicate current-round readiness.</p>{history.isPending ? <p role="status">Recovering history…</p> : history.isError ? <ErrorState error={history.error} retry={() => void history.refetch()}/> : <p>{history.data.length} authorized history entries recovered.</p>}</section>
  </SessionProvider>;
}
