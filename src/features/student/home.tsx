import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth, useRuntime } from '../../app/runtime';
import { courseService } from '../courses/service';
import { keys } from '../../lib/api/query';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
export function StudentHome() { return <><header className="page-heading"><p className="eyebrow">Student workspace</p><h1>Ready for a new perspective?</h1><p>Open one of your assigned classroom sessions and recover your place from the server.</p></header><SessionsPage/></>; }
export function SessionsPage() { const { api } = useRuntime(); const { user } = useAuth(); const q = useQuery({ queryKey: keys.mySessions(user!.id), queryFn: ({ signal }) => courseService(api).mySessions(signal) }); if(q.isPending)return <LoadingState label="Loading your sessions"/>; if(q.isError)return <ErrorState error={q.error} retry={()=>void q.refetch()}/>; return <section><div className="section-heading"><h2>My sessions</h2></div>{q.data.length===0?<EmptyState title="No assigned sessions"><p>Your instructor will add you to a classroom simulation.</p></EmptyState>:<div className="card-grid">{q.data.map(s=><article className="card" key={s.sessionId}><p className="eyebrow">{s.status}</p><h3>{s.scenarioTitle}</h3><p>{s.classroomName} · {s.modelIdentifier}:{s.modelVersion}</p><p>Round {s.currentRound} · {s.currentPhase}{s.teamId?` · Team ${s.teamId}`:''}</p><Link to={`/simulation/${s.sessionId}`}>Open session</Link></article>)}</div>}</section>; }
