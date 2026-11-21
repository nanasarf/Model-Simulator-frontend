import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth,useRuntime } from '../../app/runtime';
import { keys } from '../../lib/api/query';
import { courseService } from '../courses/service';
import { ErrorState,LoadingState } from '../../components/states';

export function ClassroomSessions({classroomId}:{classroomId:string}){
  const {api}=useRuntime();const {user}=useAuth();const [page,setPage]=useState(1);
  const sessions=useQuery({queryKey:keys.sessionLists(user!.id,page,25,classroomId,'',''),queryFn:({signal})=>courseService(api).sessions({classroomId,page,pageSize:25},signal),refetchInterval:10000});
  return <section id="classroom-sessions" aria-labelledby="classroom-sessions-title"><div className="section-heading"><h2 id="classroom-sessions-title">Classroom sessions</h2><Link className="button-link" to={`/instructor/scenarios?show=Ready&launchFor=${encodeURIComponent(classroomId)}`}>Add a session</Link></div>
    <p>Choose a scenario to play in this classroom. Each session keeps its own teams, student roles and results.</p>
    {sessions.isPending?<LoadingState label="Loading classroom sessions"/>:sessions.isError?<ErrorState error={sessions.error} retry={()=>void sessions.refetch()}/>:<>
      {!sessions.data.items.length?<p className="muted">No sessions yet. Add a scenario to create the first game for this classroom.</p>:<div className="card-grid">{sessions.data.items.map(session=><article className="card" key={session.sessionId}><p className="eyebrow">{session.status}</p><h3>{session.scenarioTitle}</h3><p>Round {session.currentRound} · {session.currentPhase}</p><div className="button-row"><Link className="button-link" to={`/instructor/sessions/${session.sessionId}/setup#roles`}>{session.status.toLowerCase()==='draft'?'Assign student roles':'View student roles'}</Link><Link to={session.status.toLowerCase()==='draft'?`/instructor/sessions/${session.sessionId}/setup`:`/instructor/sessions/${session.sessionId}/runtime`}>Open session</Link></div></article>)}</div>}
      {sessions.data.totalCount>25&&<nav className="button-row" aria-label="Classroom session pages"><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous sessions</button><span>Page {page}</span><button disabled={page*25>=sessions.data.totalCount} onClick={()=>setPage(p=>p+1)}>Next sessions</button></nav>}
    </>}
  </section>;
}
