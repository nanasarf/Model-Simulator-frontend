import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { useAuth,useRuntime } from '../../app/runtime';
import { courseService } from '../courses/service';
import { invalidateSession,keys } from '../../lib/api/query';
import { ErrorState,LoadingState } from '../../components/states';
import type { SessionLobbyView } from '../../types/classrooms';

/** Only self-service student endpoints. All availability/capacity comes from the lobby. */
export function SessionSelection({sessionId}:{sessionId:string}){
  const {api}=useRuntime();const {user}=useAuth();const qc=useQueryClient();const uid=user!.id;
  const key=keys.lobby(uid,sessionId);const service=courseService(api);
  const lobby=useQuery({queryKey:key,queryFn:({signal})=>service.lobby(sessionId,signal),refetchInterval:5000});
  const recover=()=>{void invalidateSession(qc,uid,sessionId);};
  const accepted=(value:SessionLobbyView)=>{qc.setQueryData(key,value);recover();void qc.invalidateQueries({queryKey:keys.mySessions(uid)});void qc.invalidateQueries({queryKey:keys.classroomSessions(uid,value.classroomId)});};
  const team=useMutation({mutationFn:(teamId:string)=>service.selectTeam(sessionId,teamId),onSuccess:accepted,onError:recover});
  const role=useMutation({mutationFn:(roleCode:string)=>service.selectRole(sessionId,roleCode),onSuccess:accepted,onError:recover});
  if(lobby.isPending)return <LoadingState label="Loading available teams and roles"/>;
  if(lobby.isError)return <ErrorState error={lobby.error} retry={()=>void lobby.refetch()}/>;
  const data=lobby.data;const mine=data.participation;const current=data.teams.find(t=>t.teamId===mine?.teamId);
  const disabled=!data.canChangeSelection||data.isReadOnly||team.isPending||role.isPending||lobby.isFetching;
  return <section className="card" aria-labelledby="session-selection-title"><h2 id="session-selection-title">Choose your team and role</h2>
    <p>Choose an available role for this game, or your instructor can assign one. Changing your team clears your role and readiness.</p>
    {!data.canChangeSelection&&<p role="status">Team and role selection is closed for this session.</p>}
    <div className="form-grid columns-2">
      <div className="form-field"><label htmlFor="student-team">Your team</label><select id="student-team" value={mine?.teamId??''} disabled={disabled||!mine} onChange={event=>event.target.value&&team.mutate(event.target.value)}><option value="" disabled>Choose a team</option>{data.teams.map(t=><option key={t.teamId} value={t.teamId} disabled={t.isFull&&t.teamId!==mine?.teamId}>{t.name} · {t.memberCount}/{t.capacity}{t.isFull?' · Full':''}</option>)}</select></div>
      <div className="form-field"><label htmlFor="student-role">Your role</label><select id="student-role" value={mine?.roleCode??''} disabled={disabled||!current} onChange={event=>event.target.value&&role.mutate(event.target.value)}><option value="" disabled>{current?'Choose a role':'Choose a team first'}</option>{current?.roles.map(r=><option key={r.code} value={r.code} disabled={r.available===0&&r.code!==mine?.roleCode}>{r.name}{r.code===mine?.roleCode?' · Your role':r.available===0?' · Taken':` · ${r.available} available`}</option>)}</select></div>
    </div>
    {!data.teams.length&&<p role="status">Your instructor needs to create a team before you can choose a role.</p>}
    {(team.error||role.error)&&<ErrorState error={team.error||role.error}/>}
  </section>;
}
