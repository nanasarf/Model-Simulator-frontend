import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth, useRuntime } from '../../app/runtime';
import { courseService } from '../courses/service';
import { keys } from '../../lib/api/query';
import { ErrorState, LoadingState } from '../../components/states';
import { SessionAdmissionQueue } from './session-admission';

export function Pagination({ page, pageSize, totalCount, onPage }: { page: number; pageSize: number; totalCount: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(totalCount / pageSize));
  return <nav className="pagination" aria-label="Pagination"><button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button></nav>;
}

export function InstructorSessionsPage() {
  const { api } = useRuntime(); const { user } = useAuth(); const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: keys.sessionLists(user!.id, page, 25, '', '', ''), queryFn: ({ signal }) => courseService(api).sessions({ page, pageSize: 25 }, signal) });
  if (q.isPending) return <LoadingState label="Loading sessions" />;
  if (q.isError) return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return <main><header className="page-heading"><h1>Sessions</h1><p>Manage classroom simulation sessions.</p></header>{q.data.items.length === 0 ? <p className="muted">No sessions yet.</p> : <div className="card-grid">{q.data.items.map(s => <article className="card" key={s.sessionId}><h2>{s.scenarioTitle}</h2><p>{s.classroomName} · {s.status}</p><p>Round {s.currentRound} · {s.currentPhase}</p><Link className="button-link" to={s.status === 'Setup' ? `/instructor/sessions/${s.sessionId}/setup` : `/simulation/${s.sessionId}`}>{s.status === 'Setup' ? 'Open setup' : 'Open session'}</Link></article>)}</div>}<Pagination page={q.data.page} pageSize={q.data.pageSize} totalCount={q.data.totalCount} onPage={setPage} /></main>;
}

export function SessionSetupPage() {
  const { api } = useRuntime(); const { user } = useAuth(); const { sessionId = '' } = useParams(); const qc = useQueryClient(); const s = courseService(api);
  const setupKey = keys.setup(user!.id, sessionId);
  const setup = useQuery({ queryKey: setupKey, queryFn: ({ signal }) => s.setup(sessionId, signal), enabled: !!sessionId });
  const code = useQuery({ queryKey: ['user', user!.id, 'session', sessionId, 'join-code'], queryFn: ({ signal }) => s.joinCode(sessionId, signal), enabled: !!sessionId });
  const [teamName, setTeamName] = useState('');
  const refresh = () => void qc.invalidateQueries({ queryKey: setupKey });
  const team = useMutation({ mutationFn: () => s.createTeam(sessionId, teamName), onSuccess: () => { setTeamName(''); refresh(); } });
  const assignTeam = useMutation({ mutationFn: ({ participantId, teamId, currentTeamId }: { participantId: string; teamId: string; currentTeamId: string | null }) => currentTeamId ? s.moveMember(sessionId, participantId, teamId, data.session.version) : s.addMember(sessionId, teamId, participantId), onSuccess: refresh });
  const removeTeam = useMutation({ mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) => s.removeMember(sessionId, teamId, userId, data.session.version), onSuccess: refresh });
  const role = useMutation({ mutationFn: ({ teamId, userId, roleCode }: { teamId: string; userId: string; roleCode: string }) => s.assignRole(sessionId, { teamId, userId, roleCode }), onSuccess: refresh });
  const unrole = useMutation({ mutationFn: (assignmentId: string) => s.unassignRole(sessionId, assignmentId, data.session.version), onSuccess: refresh });
  const start = useMutation({ mutationFn: () => s.startSession(sessionId), onSuccess: refresh });
  if (setup.isPending) return <LoadingState label="Loading session setup" />;
  if (setup.isError) return <ErrorState error={setup.error} retry={() => void setup.refetch()} />;
  const data = setup.data; const assignments = new Map(data.roleAssignments.map(a => [a.participantId, a]));
  const unassigned = data.participants.filter(p => !p.teamId);
  return <main>
    <header className="page-heading"><h1>{data.scenario.title}</h1><p>{data.classroom.name} · {data.session.status} · Round {data.session.currentRound} · {data.session.currentPhase}</p></header>
    <section className="card"><p className="eyebrow">Session code</p>{code.isPending ? <p>Loading code…</p> : code.isError ? <button type="button" onClick={() => void code.refetch()}>Retry</button> : <><strong className="join-code">{code.data.joinCode}</strong><button type="button" className="secondary" onClick={() => void navigator.clipboard?.writeText(code.data.joinCode)}>Copy code</button></>}<p>Students use this code to request access to this session.</p></section>
    <SessionAdmissionQueue sessionId={sessionId} />
    <section className="card"><h2>Unassigned Participants</h2>{unassigned.length === 0 ? <p className="muted">All participants have a team.</p> : unassigned.map(p => <div className="input-row" key={p.participantId}><strong>Participant</strong><span className="muted">Needs team</span><select aria-label="Assign participant to team" defaultValue="" onChange={e => e.target.value && assignTeam.mutate({ participantId: p.userId, teamId: e.target.value, currentTeamId: null })}><option value="">Assign to team</option>{data.teams.map(t => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}</select></div>)}</section>
    <section className="card"><h2>Teams</h2><form onSubmit={e => { e.preventDefault(); if (teamName.trim()) team.mutate(); }}><label>New team name<input value={teamName} onChange={e => setTeamName(e.target.value)} /></label><button type="submit" disabled={team.isPending || !teamName.trim()}>{team.isPending ? 'Creating…' : 'Create team'}</button></form>{data.teams.map(t => <article key={t.teamId}><h3>{t.name}</h3><p>{t.members.length} participants</p>{t.members.map(userId => { const p = data.participants.find(x => x.userId === userId); const a = p ? assignments.get(p.participantId) : undefined; return <div key={userId} className="input-row"><span>Participant</span>{a ? <span>{a.roleCode}</span> : <span className="muted">Needs role</span>}<select aria-label="Move participant to team" defaultValue={t.teamId} onChange={e => e.target.value !== t.teamId && assignTeam.mutate({ participantId: userId, teamId: e.target.value, currentTeamId: t.teamId })}><option value={t.teamId}>{t.name}</option>{data.teams.filter(x => x.teamId !== t.teamId).map(x => <option key={x.teamId} value={x.teamId}>{x.name}</option>)}</select><button type="button" className="secondary" onClick={() => removeTeam.mutate({ teamId: t.teamId, userId })}>Remove</button></div>; })}</article>)}</section>
    <section className="card"><h2>Roles</h2>{data.participants.filter(p => p.teamId).map(p => { const a = assignments.get(p.participantId); const t = data.teams.find(x => x.teamId === p.teamId); return <div className="input-row" key={p.participantId}><span>Participant · {t?.name}</span>{a && <button type="button" className="secondary" onClick={() => unrole.mutate(a.assignmentId)}>Unassign</button>}<select aria-label="Assign role" value={a?.roleCode ?? ''} onChange={e => e.target.value && role.mutate({ teamId: p.teamId!, userId: p.userId, roleCode: e.target.value })}><option value="">{a ? a.roleCode : 'Needs role'}</option>{data.availableRoles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</select></div>; })}</section>
    <section className="card"><h2>Readiness</h2><p>{data.participants.length} participants · {unassigned.length} need teams · {data.participants.filter(p => p.teamId && !assignments.has(p.participantId)).length} need roles · {data.participants.filter(p => !p.isReady).length} not ready</p>{data.readiness.isReady ? <p role="status">Ready to start</p> : <><p>Launch blockers</p><ul>{data.readiness.blockers.map((b, i) => <li key={`${b.code}-${i}`}>{b.code}</li>)}</ul></>}<button type="button" disabled={!data.readiness.isReady || start.isPending} onClick={() => window.confirm('Start this simulation?') && start.mutate()}>{start.isPending ? 'Starting…' : 'Start session'}</button></section>
    <Link className="button-link" to="/instructor/sessions">Back to sessions</Link>
  </main>;
}
