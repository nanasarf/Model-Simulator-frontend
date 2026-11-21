import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate,useParams } from 'react-router-dom';
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
  const q = useQuery({ queryKey: keys.classroomSessions(user!.id, classroomId), queryFn: ({ signal }) => courseService(api).classroomSessions(classroomId, signal), refetchOnWindowFocus: true, refetchOnReconnect: true,refetchInterval:5000 });
  const join = useMutation({ mutationFn: (sessionId: string) => courseService(api).joinOpenSession(sessionId), onSuccess: (_, sessionId) => { void qc.invalidateQueries({ queryKey: keys.classroomSessions(user!.id, classroomId) });void qc.invalidateQueries({ queryKey: keys.mySessions(user!.id) }); navigate(`/student/sessions/${sessionId}`); } });
  return <section className="card"><h2>Sessions in <Link to={`/student/classrooms/${classroomId}`}>{classroomName}</Link></h2>
    {q.isPending?<LoadingState label="Loading classroom sessions"/>:q.isError?<ErrorState error={q.error} retry={()=>void q.refetch()}/>:!q.data.length?<p className="muted">Your instructor has not opened a session yet. Available games will appear here.</p>:<div className="card-grid">{q.data.map(s=><article className="card" key={s.sessionId}><p className="eyebrow">{s.status}</p><h3>{s.scenarioTitle}</h3><p>{s.phase} · Round {s.currentRound}</p>{s.teamName&&<p>{s.teamName}{s.roleCode?` · ${s.roleCode}`:' · Choose a role after entering'}</p>}{s.canJoin?<button disabled={join.isPending} onClick={()=>join.mutate(s.sessionId)}>{join.isPending&&join.variables===s.sessionId?'Joining…':'Join session'}</button>:s.participationStatus==='Active'?<Link className="button-link" to={`/student/sessions/${s.sessionId}`}>{s.status.toLowerCase()==='draft'?'Choose role / enter session':'Open game'}</Link>:<p className="muted">Session entry is closed.</p>}</article>)}</div>}
    {join.error&&<p role="alert">{getSessionAdmissionMessage(join.error)}</p>}</section>;
}
export function StudentClassroomsPage(){
  const {api}=useRuntime();const {user}=useAuth();const classes=useQuery({queryKey:keys.myClassrooms(user!.id),queryFn:({signal})=>courseService(api).myClassrooms(signal)});
  return <><header className="page-heading"><h1>My classrooms</h1><p>Enter your classroom to find available sessions and games.</p><Link to="/student">Classroom access</Link></header>{classes.isPending?<LoadingState label="Loading your classrooms"/>:classes.isError?<ErrorState error={classes.error} retry={()=>void classes.refetch()}/>:!classes.data.length?<EmptyState title="No classrooms yet"><p>Use your instructor’s classroom code to request membership.</p></EmptyState>:<div className="card-grid">{classes.data.map(c=><article className="card" key={c.classroomId}><h2>{c.name}</h2><Link className="button-link" to={`/student/classrooms/${c.classroomId}`}>Open classroom</Link></article>)}</div>}</>;
}
export function StudentClassroomPage(){
  const {classroomId=''}=useParams();const {api}=useRuntime();const {user}=useAuth();
  const classes=useQuery({queryKey:keys.myClassrooms(user!.id),queryFn:({signal})=>courseService(api).myClassrooms(signal)});
  if(classes.isPending)return <LoadingState label="Confirming classroom membership"/>;
  if(classes.isError)return <ErrorState error={classes.error} retry={()=>void classes.refetch()}/>;
  const classroom=classes.data.find(c=>c.classroomId===classroomId);
  if(!classroom)return <section className="state"><h1>Classroom unavailable</h1><p>Join this classroom and wait for instructor approval before entering.</p><Link to="/student">Return to your workspace</Link></section>;
  return <><header className="page-heading"><Link to="/student/classrooms">← My classrooms</Link><h1>{classroom.name}</h1><p>Join an available session, then choose a role or receive one from your instructor.</p></header><OpenSessions key={classroomId} classroomId={classroomId} classroomName={classroom.name}/></>;
}
export function SessionsPage() { const { api } = useRuntime(); const { user } = useAuth(); const q = useQuery({ queryKey: keys.mySessions(user!.id), queryFn: ({ signal }) => courseService(api).mySessions(signal), refetchOnWindowFocus: true, refetchOnReconnect: true }); if (q.isPending) return <LoadingState label="Loading your sessions"/>; if (q.isError) return <ErrorState error={q.error} retry={() => void q.refetch()}/>; return <section><div className="section-heading"><h2>My sessions</h2></div>{q.data.length === 0 ? <EmptyState title="No assigned sessions"><p>Your instructor will add you to a classroom simulation.</p></EmptyState> : <div className="card-grid">{q.data.map(s => <article className="card" key={s.sessionId}><p className="eyebrow">{s.status}</p><h3>{s.scenarioTitle}</h3><p>{s.classroomName} · {s.modelIdentifier}:{s.modelVersion}</p><p>Round {s.currentRound} · {s.currentPhase}</p><Link to={`/student/sessions/${s.sessionId}`}>Open session</Link></article>)}</div>}</section>; }
