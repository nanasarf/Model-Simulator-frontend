import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth, useRuntime } from '../../app/runtime';
import { courseService } from '../courses/service';
import { keys } from '../../lib/api/query';
import { ErrorState, LoadingState } from '../../components/states';
import { SessionAdmissionQueue } from './session-admission';
import '../../app/session-setup.css';

export function Pagination({ page, pageSize, totalCount, onPage }: { page: number; pageSize: number; totalCount: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(totalCount / pageSize));
  return <nav className="pagination" aria-label="Pagination"><button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button></nav>;
}

export function InstructorSessionsPage() {
  const { api } = useRuntime(); const { user } = useAuth(); const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: keys.sessionLists(user!.id, page, 25, '', '', ''), queryFn: ({ signal }) => courseService(api).sessions({ page, pageSize: 25 }, signal) });
  if (q.isPending) return <LoadingState label="Loading sessions" />;
  if (q.isError) return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return <main><header className="page-heading"><h1>Sessions</h1><p>Manage classroom simulation sessions.</p></header>{q.data.items.length === 0 ? <p className="muted">No sessions yet.</p> : <div className="card-grid">{q.data.items.map(s => <article className="card" key={s.sessionId}><h2>{s.scenarioTitle}</h2><p>{s.classroomName} · {s.status}</p><p>Round {s.currentRound} · {s.currentPhase}</p><Link className="button-link" to={s.status === 'Draft' ? `/instructor/sessions/${s.sessionId}/setup` : `/instructor/sessions/${s.sessionId}/runtime`}>{s.status === 'Draft' ? 'Open setup' : 'Open session'}</Link></article>)}</div>}<Pagination page={q.data.page} pageSize={q.data.pageSize} totalCount={q.data.totalCount} onPage={setPage} /></main>;
}

export function SessionSetupPage() {
  const { api } = useRuntime(); const { user } = useAuth(); const { sessionId = '' } = useParams(); const qc = useQueryClient(); const s = courseService(api);
  const setupKey = keys.setup(user!.id, sessionId);
  const setup = useQuery({ queryKey: setupKey, queryFn: ({ signal }) => s.setup(sessionId, signal), enabled: !!sessionId });
  const code = useQuery({ queryKey: ['user', user!.id, 'session', sessionId, 'join-code'], queryFn: ({ signal }) => s.joinCode(sessionId, signal), enabled: !!sessionId });
  const [teamName, setTeamName] = useState('');
  const refresh = () => { void qc.invalidateQueries({ queryKey: setupKey }).catch(() => undefined); };
  // Keep mutation completion tied to the POST. Background setup recovery must
  // not keep the submit button pending if an unrelated GET stalls or fails.
  const team = useMutation({ mutationFn: () => s.createTeam(sessionId, teamName.trim()), onSuccess: () => { setTeamName(''); refresh(); } });
  const assignTeam = useMutation({ mutationFn: ({ participantId, teamId, currentTeamId }: { participantId: string; teamId: string; currentTeamId: string | null }) => currentTeamId ? s.moveMember(sessionId, participantId, teamId, data.session.version) : s.addMember(sessionId, teamId, participantId), onSuccess: refresh });
  const removeTeam = useMutation({ mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) => s.removeMember(sessionId, teamId, userId, data.session.version), onSuccess: refresh });
  const role = useMutation({ mutationFn: ({ teamId, userId, roleCode }: { teamId: string; userId: string; roleCode: string }) => s.assignRole(sessionId, { teamId, userId, roleCode }), onSuccess: refresh });
  const unrole = useMutation({ mutationFn: (assignmentId: string) => s.unassignRole(sessionId, assignmentId, data.session.version), onSuccess: refresh });
  const start = useMutation({ mutationFn: () => s.startSession(sessionId), onSuccess: refresh });
  if (setup.isPending) return <LoadingState label="Loading session setup" />;
  if (setup.isError) return <ErrorState error={setup.error} retry={() => void setup.refetch()} />;
  const data = setup.data;
  const participants = data.participants ?? [];
  const teams = data.teams ?? [];
  const availableRoles = data.availableRoles ?? [];
  const roleAssignments = data.roleAssignments ?? [];
  const blockers = data.readiness?.blockers ?? [];
  const assignments = new Map(roleAssignments.map(a => [a.participantId, a]));
  const unassigned = participants.filter(p => !p.teamId);
  const assignedRoleCount = participants.filter(p => assignments.has(p.participantId)).length;
  const readyCount = participants.filter(p => p.isReady).length;
  const displayName = (participant: typeof participants[number]) => participant.displayName || participant.name || participant.email || 'Student';
  const mutationError = assignTeam.error || removeTeam.error ? 'This student’s team assignment changed. Refreshing setup.' : role.error || unrole.error ? 'This role is not available for this session. Refreshing setup.' : undefined;
  return <main>
    <header className="page-heading"><h1>{data.scenario.title}</h1><p>{data.classroom.name} · {data.session.status} · Round {data.session.currentRound} · {data.session.currentPhase}</p></header>
    <section className="card"><p className="eyebrow">Session code</p>{code.isPending ? <p>Loading code…</p> : code.isError ? <button type="button" onClick={() => void code.refetch()}>Retry</button> : <><strong className="join-code">{code.data.joinCode}</strong><button type="button" className="secondary" onClick={() => void navigator.clipboard?.writeText(code.data.joinCode)}>Copy code</button></>}<p>Students use this code to request access to this session.</p></section>
    <SessionAdmissionQueue sessionId={sessionId} />
    {mutationError && <p role="alert">{mutationError}</p>}
    <section className="card"><h2>Setup summary</h2><p>{participants.length} participants · {participants.length - unassigned.length} assigned to teams · {assignedRoleCount} assigned roles · {readyCount} ready</p>{availableRoles.length === 0 && <p role="alert">No simulation roles are available for this session.</p>}</section>
    <section className="card"><h2>Unassigned Participants</h2>{participants.length === 0 ? <p className="muted">No students have joined this session yet.</p> : unassigned.length === 0 ? <p className="muted">All participants have been assigned to teams.</p> : <><p className="muted">Assign these students to teams.</p>{unassigned.map(p => <ParticipantRow key={p.participantId} name={displayName(p)} teamLabel="No team" roleLabel="No role" readiness={p.isReady} teams={teams} value="" onTeam={teamId => assignTeam.mutate({ participantId: p.userId, teamId, currentTeamId: null })} />)}</>}</section>
    <section className="card"><h2>Teams</h2><form onSubmit={e => { e.preventDefault(); if (teamName.trim() && !team.isPending) team.mutate(); }}><label htmlFor="new-team-name">New team name<input id="new-team-name" value={teamName} onChange={e => setTeamName(e.target.value)} /></label><button type="submit" disabled={team.isPending}>{team.isPending ? 'Creating…' : 'Create team'}</button></form>
      {team.error && <p role="alert">Team could not be created.</p>}
      {teams.length === 0 ? <p className="muted">Create your first team.</p> : teams.map(t => {
        const members = participants.filter(p => p.teamId === t.teamId);
        return <article className="team-card" key={t.teamId}><header><h3>{t.name}</h3><span className="status-chip">{members.length} {members.length === 1 ? 'participant' : 'participants'}</span></header>
          {members.length === 0 ? <p className="muted">No participants assigned yet.</p> : members.map(p => { const assignment = assignments.get(p.participantId); const roleName = assignment ? availableRoles.find(r => r.code === assignment.roleCode)?.name ?? assignment.roleCode : 'No role'; return <ParticipantRow key={p.participantId} name={displayName(p)} teamLabel={t.name} roleLabel={roleName} readiness={p.isReady} teams={teams} value={t.teamId} onTeam={teamId => { if (teamId !== t.teamId) assignTeam.mutate({ participantId: p.userId, teamId, currentTeamId: t.teamId }); }} onRemove={() => removeTeam.mutate({ teamId: t.teamId, userId: p.userId })} />; })}
        </article>;
      })}</section>
    <section className="card"><h2>Simulation role assignment</h2><p className="muted">Simulation roles do not change a student’s platform account role.</p>{participants.filter(p => p.teamId).map(p => { const assignment = assignments.get(p.participantId); const participantTeam = teams.find(t => t.teamId === p.teamId); return <div className="participant-row" key={p.participantId}><div><strong>{displayName(p)}</strong><span>{participantTeam?.name ?? 'Team unavailable'}</span></div><label>Simulation role<select aria-label={`Simulation role for ${displayName(p)}`} value={assignment?.roleCode ?? ''} onChange={e => e.target.value && role.mutate({ teamId: p.teamId!, userId: p.userId, roleCode: e.target.value })}><option value="">{assignment ? 'Choose a role' : 'Needs role'}</option>{availableRoles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</select></label>{assignment && <button type="button" className="secondary" onClick={() => unrole.mutate(assignment.assignmentId)}>Unassign role</button>}</div>; })}</section>
    <section className="card"><h2>Readiness</h2><p>{participants.length} participants · {unassigned.length} need teams · {participants.filter(p => p.teamId && !assignments.has(p.participantId)).length} need roles · {participants.length - readyCount} not ready</p>{data.readiness.isReady ? <p role="status">Ready to start</p> : <><p>Launch blockers</p>{blockers.length ? <ul>{blockers.map((b, i) => <li key={`${b.code}-${i}`}>{b.code}</li>)}</ul> : <p className="muted">The backend has not reported blockers.</p>}</>}<button type="button" disabled={!data.readiness.isReady || start.isPending} onClick={() => window.confirm('Start this simulation?') && start.mutate()}>{start.isPending ? 'Starting…' : 'Start session'}</button></section>
    <Link className="button-link" to="/instructor/sessions">Back to sessions</Link>
  </main>;
}

function ParticipantRow({ name, teamLabel, roleLabel, readiness, teams, value, onTeam, onRemove }: {
  name: string;
  teamLabel: string;
  roleLabel: string;
  readiness: boolean;
  teams: Array<{ teamId: string; name: string }>;
  value: string;
  onTeam: (teamId: string) => void;
  onRemove?: () => void;
}) {
  return <div className="participant-row">
    <div className="participant-summary"><span className="participant-avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase() || 'S'}</span><div><strong>{name}</strong><span>{teamLabel} · {roleLabel}</span></div><span className={`status-chip ${readiness ? 'is-ready' : ''}`}>{readiness ? 'Ready' : !value ? 'Needs team' : roleLabel === 'No role' ? 'Needs role' : 'Not ready'}</span></div>
    <label className="participant-team-control">Team<select aria-label={`Team for ${name}`} value={value} onChange={event => event.target.value && onTeam(event.target.value)}><option value="" disabled>Select a team</option>{teams.map(team => <option key={team.teamId} value={team.teamId}>{team.name}</option>)}</select></label>
    {onRemove && <button type="button" className="secondary" onClick={onRemove}>Remove from team</button>}
  </div>;
}
