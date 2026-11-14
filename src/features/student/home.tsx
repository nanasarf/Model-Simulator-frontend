import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useRuntime } from '../../app/runtime';
import { courseService } from '../courses/service';
import { keys } from '../../lib/api/query';
import { AdmissionStatusCard } from './admission';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { getClassroomAdmissionMessage, getSessionAdmissionMessage } from '../../lib/errors/admission';
const norm = (v: string) => v.trim().toLowerCase();

export function StudentHome() {
  const { api } = useRuntime(); const { user } = useAuth(); const qc = useQueryClient();
  const [classCode, setClassCode] = useState('');
  const req = useQuery({ queryKey: keys.myClassroomJoinRequests(user!.id), queryFn: ({ signal }) => courseService(api).myClassroomJoinRequests(signal), refetchOnWindowFocus: true, refetchOnReconnect: true });
  const classes = useQuery({ queryKey: keys.myClassrooms(user!.id), queryFn: ({ signal }) => courseService(api).myClassrooms(signal), refetchOnWindowFocus: true, refetchOnReconnect: true });
  const classroomJoin = useMutation({ mutationFn: () => courseService(api).requestClassroomJoin(classCode.trim()), onSuccess: async () => { setClassCode(''); await Promise.all([qc.invalidateQueries({ queryKey: keys.myClassroomJoinRequests(user!.id) }), qc.invalidateQueries({ queryKey: keys.myClassrooms(user!.id) })]); } });
  const latest = req.data?.[0]; const member = classes.data?.find(x => latest && x.classroomId === latest.classroomId) ?? classes.data?.[0];
  return <><header className="page-heading"><p className="eyebrow">Student workspace</p><h1>Ready for a new perspective?</h1><p>Request classroom access, then join an open simulation from your classroom.</p></header><section className="card"><h2>Join a classroom</h2><p>Use the <strong>classroom code</strong> shared by your instructor.</p>{req.isPending || classes.isPending ? <LoadingState label="Checking classroom access"/> : member ? <AdmissionStatusCard title="Classroom access" status="Approved">You are a member of {member.name}.</AdmissionStatusCard> : latest && norm(latest.status) === 'pending' ? <AdmissionStatusCard title="Classroom access" status="Pending">Waiting for instructor approval.</AdmissionStatusCard> : <form className="input-row" onSubmit={e => { e.preventDefault(); if (classCode.trim()) classroomJoin.mutate(); }}><label htmlFor="classroom-code">Classroom code</label><input id="classroom-code" value={classCode} onChange={e => setClassCode(e.target.value.toUpperCase())} required/><button disabled={classroomJoin.isPending}>{classroomJoin.isPending ? 'Sending…' : 'Request to join'}</button></form>}{!member && latest && norm(latest.status) === 'rejected' && <p role="status">Your classroom request was not approved. Check the code with your instructor and submit a new request.</p>}{classroomJoin.error && <p role="alert">{getClassroomAdmissionMessage(classroomJoin.error)}</p>}</section>{(classes.data ?? []).map(c => <OpenSessions key={c.classroomId} classroomId={c.classroomId} classroomName={c.name}/>)}<SessionsPage/></>;
}
function OpenSessions({ classroomId, classroomName }: { classroomId: string; classroomName: string }) {
  const { api } = useRuntime(); const { user } = useAuth(); const navigate = useNavigate(); const qc = useQueryClient();
  const q = useQuery({ queryKey: keys.classroomSessions(user!.id, classroomId), queryFn: ({ signal }) => courseService(api).classroomSessions(classroomId, signal), refetchOnWindowFocus: true, refetchOnReconnect: true });
  const join = useMutation({ mutationFn: (sessionId: string) => courseService(api).joinOpenSession(sessionId), onSuccess: async (_, sessionId) => { await Promise.all([qc.invalidateQueries({ queryKey: keys.classroomSessions(user!.id, classroomId) }), qc.invalidateQueries({ queryKey: keys.mySessions(user!.id) })]); navigate(`/student/sessions/${sessionId}`); } });
  const joinable = (q.data ?? []).filter(s => s.canJoin);
  if (q.isPending || q.isError || joinable.length === 0) return null;
  return <section className="card"><h2>Open sessions in {classroomName}</h2><div className="card-grid">{joinable.map(s => <article className="card" key={s.sessionId}><h3>{s.scenarioTitle}</h3><p>{s.phase} · Round {s.currentRound}</p><button disabled={join.isPending} onClick={() => join.mutate(s.sessionId)}>{join.isPending && join.variables === s.sessionId ? 'Joining…' : 'Join session'}</button></article>)}</div>{join.error && <p role="alert">{getSessionAdmissionMessage(join.error)}</p>}</section>;
}
export function SessionsPage() { const { api } = useRuntime(); const { user } = useAuth(); const q = useQuery({ queryKey: keys.mySessions(user!.id), queryFn: ({ signal }) => courseService(api).mySessions(signal), refetchOnWindowFocus: true, refetchOnReconnect: true }); if (q.isPending) return <LoadingState label="Loading your sessions"/>; if (q.isError) return <ErrorState error={q.error} retry={() => void q.refetch()}/>; return <section><div className="section-heading"><h2>My sessions</h2></div>{q.data.length === 0 ? <EmptyState title="No assigned sessions"><p>Your instructor will add you to a classroom simulation.</p></EmptyState> : <div className="card-grid">{q.data.map(s => <article className="card" key={s.sessionId}><p className="eyebrow">{s.status}</p><h3>{s.scenarioTitle}</h3><p>{s.classroomName} · {s.modelIdentifier}:{s.modelVersion}</p><p>Round {s.currentRound} · {s.currentPhase}</p><Link to={`/student/sessions/${s.sessionId}`}>Open session</Link></article>)}</div>}</section>; }
