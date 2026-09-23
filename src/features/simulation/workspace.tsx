import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, type UseMutationResult } from '@tanstack/react-query';
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
import type { JsonValue } from '../../types/platform';
import { isInstructor } from '../../lib/permissions';
import { resolveModelUI } from './registry';
export function SimulationWorkspace() {
  const { sessionId = '' } = useParams();
  return isSessionId(sessionId) ? <ActiveSession key={sessionId} id={sessionId}/> : <section className="state"><h1>Invalid session ID</h1><p>Use the complete session ID provided by your instructor.</p></section>;
}
function ActiveSession({ id }: { id: string }) {
  const { api, auth, queries } = useRuntime(); const { user } = useAuth(); const uid = user!.id;
  const setShellStatus = useConnectionStatus(); const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [connectionError, setConnectionError] = useState<unknown>(); const [attempt, setAttempt] = useState(0); const [eventFilter, setEventFilter] = useState('All');
  const service = sessionService(api);
  const state = useQuery({ queryKey: keys.state(uid, id), queryFn: ({ signal }) => service.state(id, signal) });
  const history = useQuery({ queryKey: keys.history(uid, id), queryFn: ({ signal }) => service.history(id, signal), enabled: !!state.data });
  const command = useMutation({ mutationFn: (name: 'start'|'pause'|'resume') => service.command(id, name), onSuccess: () => void state.refetch() });
  const advance = useMutation({ mutationFn: (targetPhase: string) => service.advancePhase(id, { targetPhase }), onSuccess: () => void state.refetch() });
  const execute = useMutation({ mutationFn: (teamId: string) => service.executeRound(id, { teamId, executionId: crypto.randomUUID() }), onSuccess: () => void state.refetch() });
  const participantReady = useMutation({ mutationFn: (ready: boolean) => service.participantReadiness(id, { ready }), onSuccess: () => void state.refetch() });
  const roundReady = useMutation({ mutationFn: (ready: boolean) => service.roundReadiness(id, { ready }), onSuccess: () => void state.refetch() });
  const hasState = !!state.data;
  const eventTypes = useMemo(() => ['All', ...Array.from(new Set((history.data ?? []).map(x => x.type)))], [history.data]);
  const filteredHistory = (history.data ?? []).filter(x => eventFilter === 'All' || x.type === eventFilter);
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
  const waitingForLaunch = !isInstructor(user) && ['setup', 'lobby', 'created', 'ready'].includes(context.status.toLowerCase());
  return <SessionProvider value={context}><header className="page-heading"><p className="eyebrow">Live classroom</p><h1>Simulation session</h1><p className="support-id">{id}</p><ConnectionLabel status={status}/><BackgroundStatus active={state.isFetching}/></header>
    {state.isError && <ErrorState error={state.error} retry={() => void state.refetch()}/>}
    {status !== 'connected' && <section className="notice" role="status"><h2>{status === 'reconnecting' ? 'Restoring live updates' : 'Live updates disconnected'}</h2><p>The last recovered state is shown. Your classroom session is preserved on the server.</p>{status === 'disconnected' && <button className="secondary" onClick={() => setAttempt(x => x + 1)}>Reconnect</button>}</section>}
    {connectionError !== undefined && <ErrorState error={connectionError}/>}
    {waitingForLaunch ? <StudentLobby context={context} participantReady={participantReady} /> : <dl className="session-facts"><div><dt>Status</dt><dd>{context.status}</dd></div><div><dt>Round</dt><dd>{context.roundNumber}</dd></div><div><dt>Phase</dt><dd>{context.phase}</dd></div><div><dt>Team ID</dt><dd>{context.teamId || 'Not assigned'}</dd></div><div><dt>Role</dt><dd>{context.roleCodes.join(', ') || 'Not assigned'}</dd></div><div><dt>Participant readiness</dt><dd>{context.participantReady === null ? 'Not a participant' : context.participantReady ? 'Ready' : 'Not ready'}</dd></div></dl>}
    {context.participant && <section className="card"><h2>Readiness</h2><div className="button-row"><button className="secondary" disabled={participantReady.isPending} onClick={() => participantReady.mutate(!context.participantReady)}>Mark {!context.participantReady ? 'ready' : 'not ready'}</button><button className="secondary" disabled={roundReady.isPending} onClick={() => roundReady.mutate(true)}>Mark round ready</button></div>{(participantReady.error || roundReady.error) && <ErrorState error={participantReady.error || roundReady.error}/>}</section>}
    {isInstructor(user) && <section className="card"><h2>Instructor controls</h2><div className="button-row"><button disabled={command.isPending} onClick={() => command.mutate('start')}>Start</button><button className="secondary" disabled={command.isPending} onClick={() => command.mutate('pause')}>Pause</button><button className="secondary" disabled={command.isPending} onClick={() => command.mutate('resume')}>Resume</button>{context.teamId && <button className="secondary" disabled={execute.isPending} onClick={() => execute.mutate(context.teamId!)}>Execute round</button>}</div><label htmlFor="next-phase">Advance to phase</label><div className="input-row"><input id="next-phase" placeholder="Manifest phase"/><button className="secondary" disabled={advance.isPending} onClick={() => { const value=(document.getElementById('next-phase') as HTMLInputElement).value.trim(); if(value) advance.mutate(value); }}>Advance</button></div>{(command.error || advance.error || execute.error) && <ErrorState error={command.error || advance.error || execute.error}/>}</section>}
    {!isInstructor(user) && context.availableActions.length > 0 && <ActionPanel context={context} service={service} sessionId={id} onSubmitted={() => void state.refetch()}/>} 
    {(() => { const ui = resolveModelUI(context.modelIdentifier, context.modelVersion); return ui ? <ui.Workspace projection={context.visibleState as never} /> : <section className="card"><h2>{context.modelIdentifier}:{context.modelVersion}</h2><p className="notice">This simulation model is not available in this client.</p><p className="muted">Model-specific gameplay controls will appear when this model adapter is registered.</p></section>; })()}
    <section className="recovery-note"><h2>Event history</h2><p>Session revision {context.version}. Events are filtered from the authorized server history.</p>{history.isPending ? <p role="status">Recovering history…</p> : history.isError ? <ErrorState error={history.error} retry={() => void history.refetch()}/> : <><label htmlFor="history-filter">Event type</label><select id="history-filter" value={eventFilter} onChange={e => setEventFilter(e.target.value)}>{eventTypes.map(type => <option key={type}>{type}</option>)}</select><p>{filteredHistory.length} authorized event{filteredHistory.length === 1 ? '' : 's'} shown.</p><ul>{filteredHistory.slice(0, 20).map(event => <li key={`${event.sequence}-${event.occurredAt}`}><strong>{event.type}</strong> · round {event.roundNumber} · {new Date(event.occurredAt).toLocaleString()}</li>)}</ul></>}</section>
  </SessionProvider>;
}

function StudentLobby({ context, participantReady }: { context: ReturnType<typeof recoverContext>; participantReady: UseMutationResult<void, Error, boolean, unknown> }) {
  const hasTeam = !!context.teamId; const hasRole = context.roleCodes.length > 0; const canReady = hasTeam && hasRole && context.participantReady !== null;
  return <section className="card" aria-labelledby="lobby-title"><h2 id="lobby-title">Waiting room</h2><p>Your instructor will start the simulation when setup is complete.</p><dl className="session-facts"><div><dt>Team</dt><dd>{hasTeam ? 'Assigned' : 'Waiting for your instructor to assign your team.'}</dd></div><div><dt>Role</dt><dd>{hasRole ? context.roleCodes.join(', ') : hasTeam ? 'Waiting for your instructor to assign your role.' : 'Waiting for team assignment.'}</dd></div><div><dt>Readiness</dt><dd>{context.participantReady ? 'Ready' : 'Not ready'}</dd></div></dl>{canReady && <button type="button" disabled={participantReady.isPending} onClick={() => participantReady.mutate(!context.participantReady)}>{participantReady.isPending ? 'Updating…' : context.participantReady ? 'Mark not ready' : 'Mark ready'}</button>}{!canReady && <p className="muted">Your team and role must be assigned before you can mark ready.</p>}</section>;
}

function ActionPanel({ context, service, sessionId, onSubmitted }: { context: ReturnType<typeof recoverContext>; service: ReturnType<typeof sessionService>; sessionId: string; onSubmitted: () => void }) {
  const [selected, setSelected] = useState(context.availableActions[0]?.code ?? ''); const [payload, setPayload] = useState('{}'); const [error, setError] = useState<unknown>(); const [sending, setSending] = useState(false);
  const action = context.availableActions.find(x => x.code === selected); const assignment = context.roleAssignments[0];
  async function submit() { if (!action || !assignment || !context.teamId) return; setSending(true); setError(undefined); try { const parsed = JSON.parse(payload) as JsonValue; await service.submitAction(sessionId, { teamId: context.teamId, roleAssignmentId: assignment.assignmentId, actionCode: action.code, payload: parsed }, crypto.randomUUID()); onSubmitted(); } catch (e) { setError(e); } finally { setSending(false); } }
  return <section className="card"><h2>Available actions</h2><p className="muted">Actions are authorized by the frozen session manifest and current phase.</p><label htmlFor="action-code">Action</label><select id="action-code" value={selected} onChange={e => setSelected(e.target.value)}>{context.availableActions.filter(x => x.availablePhases.includes(context.phase)).map(x => <option key={x.code}>{x.code}</option>)}</select><label htmlFor="action-payload">Payload (JSON)</label><textarea id="action-payload" value={payload} onChange={e => setPayload(e.target.value)} rows={4}/><button disabled={sending || !action || !assignment} onClick={() => void submit()}>{sending ? 'Submitting…' : 'Submit action'}</button>{error !== undefined ? <ErrorState error={error}/> : null}<h3>Current-round submissions</h3><p>{context.currentRoundSubmissions.length} authorized submission{context.currentRoundSubmissions.length === 1 ? '' : 's'} recovered.</p></section>;
}
