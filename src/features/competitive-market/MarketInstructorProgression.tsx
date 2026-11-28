import { useRef } from 'react';
import { useMutation,useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth,useRuntime } from '../../app/runtime';
import { keys,invalidateSession } from '../../lib/api/query';
import { ApiProblem } from '../../lib/errors/problem';
import { ErrorState,LoadingState } from '../../components/states';
import { instructorService } from '../instructor/service';
import { courseService } from '../courses/service';
import { sessionService } from '../sessions/service';
import { D3_TEXT } from './PairedQuotationWorkspace';
import { instructorDecisionReadiness,reopenSlot } from './laboratory-service';
import type { InstructorDecisionReadiness,DecisionSlotView } from './paired-quotation-v2-contracts';
import { useState } from 'react';

function readableBlocker(code:string){
 const [side,reason]=code.includes(':')?code.split(':',2):['',code];
 const descriptions:Record<string,string>={'confirmation-missing':'confirmation is still missing','correction-pending':'student must submit a new confirmation','not-ready':'period readiness is missing','designation-invalid':'designated participant or role is no longer valid','execution-started':'execution has already started','already-executed':'period has already executed','slots-unavailable':'designated quotation slots are unavailable'};
 return `${side?`${side}: `:''}${descriptions[reason]??reason}`;
}

/** Existing owned-instructor console, reduced to counts/status before caching. Never a student source. */
export function MarketInstructorProgression({sessionId,period,phase,status}:{sessionId:string;period:number;phase:string;status:string}){
  const {api,queries}=useRuntime();const {user}=useAuth();const uid=user!.id;
  const setup=useQuery({queryKey:keys.setup(uid,sessionId),queryFn:({signal})=>courseService(api).setup(sessionId,signal),refetchInterval:5000});
  const consoleQuery=useQuery({queryKey:keys.console(uid,sessionId,'market-participation-counts'),queryFn:async()=>{
    const value=await instructorService(api,user).marketConsole(sessionId);
    if(value.sessionId!==sessionId||!Array.isArray(value.teams))throw Error('The instructor market context could not be verified.');
    return {period:value.round,phase:value.phase,teams:value.teams.map(team=>({teamId:team.teamId,executedPeriod:team.state?.round??null,bids:team.submissions.filter(s=>s.roundNumber===value.round&&s.actionCode==='SUBMIT_BUYER_BID').length,asks:team.submissions.filter(s=>s.roundNumber===value.round&&s.actionCode==='SUBMIT_SELLER_ASK').length}))};
  },refetchInterval:5000});
  const readiness=useQuery({queryKey:['user',uid,'session',sessionId,'decision-readiness-v2'],queryFn:({signal})=>instructorDecisionReadiness(api,sessionId,signal),refetchInterval:q=>q.state.error instanceof ApiProblem&&q.state.error.errorCode==='decision.corrections_unavailable'?false:5000,retry:false});
  const executionIds=useRef(new Map<string,string>());
  const refresh=()=>{void invalidateSession(queries,uid,sessionId);};
  const execute=useMutation({mutationFn:(teamId:string)=>{const key=`${period}:${teamId}`;if(!executionIds.current.has(key))executionIds.current.set(key,crypto.randomUUID());return sessionService(api).executeRound(sessionId,{teamId,executionId:executionIds.current.get(key)!});},onSuccess:refresh,onError:refresh});
  const advance=useMutation({mutationFn:(targetPhase:string)=>sessionService(api).advancePhase(sessionId,{targetPhase}),onSuccess:refresh,onError:refresh});
  const transition=({Briefing:['Decision','Open decision period'],Decision:['Locked','Close decision period'],Results:['Reflection','Begin reflection'],Reflection:['Completed','Complete session']} as Record<string,string[]>)[phase];
  const error=execute.error||advance.error;
  const d3=error instanceof ApiProblem&&error.errorCode==='market.lab_ambiguous_quotations';
  const current=consoleQuery.data?.period===period&&consoleQuery.data.phase===phase;
  const isV2=readiness.data?.period===period&&readiness.data.phase===phase;
  const earlierPolicy=readiness.error instanceof ApiProblem&&readiness.error.errorCode==='decision.corrections_unavailable';
  const policyKnown=!!isV2||earlierPolicy;
  return <section className="card academic-lab" aria-labelledby="market-progression-title"><h2 id="market-progression-title">Market period progression</h2><p>Decision period {period} · {phase} · {status}. The paired laboratory is one period per independent team market. Existing non-laboratory markets retain their own rules; all transitions and execution are validated by the backend.</p>
    {isV2&&<V2ReadinessDashboard value={readiness.data!} api={api} sessionId={sessionId} uid={uid} refresh={refresh}/>}
    {!policyKnown&&readiness.isPending&&<LoadingState label="Identifying the authoritative gameplay policy"/>}
    {!policyKnown&&readiness.isFetching&&<p role="status">Refreshing the authoritative policy and readiness for this period. Execution controls are temporarily unavailable.</p>}
    {!policyKnown&&readiness.isError&&<section role="alert"><h3>Authoritative execution readiness unavailable</h3><p>Execution is disabled until the server confirms the active gameplay policy and current period readiness.</p><ErrorState error={readiness.error} retry={()=>void readiness.refetch()}/></section>}
    {earlierPolicy&&<p className="notice">{D3_TEXT}</p>}
    {earlierPolicy?<p>Counts below contain no quotation prices, payloads, private schedules or welfare indicators. For an opted-in laboratory, each side must have exactly one accepted quotation to execute. Counts are advisory; current roles, readiness and admissibility are checked by the server.</p>:isV2?<p>The v2 readiness view contains designated slot states, correction status and backend blockers, without quotation prices, private schedules or welfare indicators.</p>:null}
    {earlierPolicy&&(setup.isPending||consoleQuery.isPending)&&<LoadingState label="Recovering instructor participation status"/>}
    {earlierPolicy&&(setup.isError||consoleQuery.isError)&&<ErrorState error={setup.error||consoleQuery.error} retry={()=>{void setup.refetch();void consoleQuery.refetch();}}/>}
    {earlierPolicy&&setup.data&&consoleQuery.data&&!setup.isError&&!consoleQuery.isError&&<div className="market-progress-table">
      <table className="academic-table"><caption>Current-period quotation counts and team execution</caption>
        <thead><tr><th scope="col">Team</th><th scope="col">Buyer quotations</th><th scope="col">Seller quotations</th><th scope="col">Execution</th></tr></thead>
        <tbody>{setup.data.teams.map(team=>{
          const counts=consoleQuery.data!.teams.find(t=>t.teamId===team.teamId);
          const executed=counts?.executedPeriod===period;
          return <tr key={team.teamId}><th scope="row">{team.name}</th><td>{counts?.bids??0}</td><td>{counts?.asks??0}</td><td>
            {executed?'Current period executed':<button type="button" className="secondary" disabled={status!=='Running'||!['Locked','Simulation'].includes(phase)||execute.isPending||!current||consoleQuery.isFetching} onClick={()=>execute.mutate(team.teamId)}>{execute.isPending&&execute.variables===team.teamId?'Executing…':`Execute ${team.name}`}</button>}
            {!!counts&&(counts.bids>1||counts.asks>1)&&<p>Multiple quotations: an opted-in laboratory may be blocked by D3.</p>}
          </td></tr>;
        })}</tbody>
      </table>
    </div>}
    {transition&&<button type="button" disabled={status!=='Running'||advance.isPending||execute.isPending||!current} onClick={()=>advance.mutate(transition[0])}>{advance.isPending?'Updating period…':transition[1]}</button>}
    {phase==='Locked'||phase==='Simulation'?<p>Execute each team through the existing command. Results are released through the session lifecycle after all team markets execute; a single completed team does not imply released numeric outcomes.</p>:null}
    {d3&&<div role="alert"><h3>D3: laboratory execution blocked</h3><p>There is more than one distinct quotation on a side. None is silently discarded or chosen as first/last winner. No cancellation or amendment endpoint is available. Preserve the history and use instructor-led new-session recovery unless a revision workflow is separately approved.</p>{setup.data&&<Link to={`/instructor/classrooms/${setup.data.classroom.id}`}>Return to classroom for a new session</Link>}</div>}
    {error&&<ErrorState error={error}/>}
  </section>;
}

function V2ReadinessDashboard({value,api,sessionId,uid,refresh}:{value:InstructorDecisionReadiness;api:ReturnType<typeof useRuntime>['api'];sessionId:string;uid:string;refresh:()=>void}){
  const [selected,setSelected]=useState<{teamId:string;actionCode:DecisionSlotView['actionCode'];generation:number}|null>(null);
  const [reason,setReason]=useState('');const [review,setReview]=useState(false);const [error,setError]=useState<unknown>();
  const keysByRequest=useRef(new Map<string,string>());
  const reopen=useMutation({mutationFn:async(slot:DecisionSlotView)=>{
    const body={teamId:slot.teamId,period:slot.period,actionCode:slot.actionCode,expectedGeneration:slot.generation,reason:reason.trim()};
    const identity=JSON.stringify(body);if(!keysByRequest.current.has(identity))keysByRequest.current.set(identity,crypto.randomUUID());
    return reopenSlot(api,sessionId,uid,body,keysByRequest.current.get(identity)!);
  },onSuccess:()=>{setReview(false);setSelected(null);setReason('');setError(undefined);refresh();},onError:e=>{setError(e);refresh();}});
  const executeIds=useRef(new Map<string,string>());
  const execute=useMutation({mutationFn:(teamId:string)=>{const identity=`${value.period}:${teamId}`;if(!executeIds.current.has(identity))executeIds.current.set(identity,crypto.randomUUID());return sessionService(api).executeRound(sessionId,{teamId,executionId:executeIds.current.get(identity)!});},onSuccess:refresh,onError:e=>{setError(e);refresh();}});
  return <section className="card" aria-labelledby="v2-readiness-title"><h3 id="v2-readiness-title">Authoritative policy v2 readiness</h3><p>Period {value.period} · {value.phase} · {value.sessionStatus}. Readiness and blockers come from the server; no quotation prices are included.</p>
    {value.teams.map(team=><article className="card" key={team.teamId}><h4>Team {team.teamId}</h4><p>{team.executed?'Period executed':team.canExecute?'Execution ready':'Execution blocked'}</p>
      <table className="academic-table"><caption>Designated quotation slots</caption><thead><tr><th scope="col">Role</th><th scope="col">State</th><th scope="col">Generation</th><th scope="col">Readiness</th><th scope="col">Correction</th></tr></thead><tbody>{team.slots.map(slot=><tr key={slot.actionCode}><th scope="row">{slot.roleCode}</th><td>{slot.state==='confirmed'?'Confirmed':slot.correctionPending?'Correction pending':slot.wasReopened?'Reopened; resubmission pending':'Missing confirmation'}</td><td>{slot.generation}</td><td>{slot.correctionPending?'Pending resubmission':slot.state==='confirmed'?'Confirmed':'Missing'}</td><td>{slot.state==='confirmed'&&!team.executed&&value.phase==='Decision'&&['Running','Paused'].includes(value.sessionStatus)&&<button className="secondary" type="button" onClick={()=>{setSelected({teamId:slot.teamId,actionCode:slot.actionCode,generation:slot.generation});setReview(false);setReason('');}}>Reopen slot</button>}</td></tr>)}</tbody></table>
      {team.blockers.length>0&&<div role="status"><strong>Backend execution blockers</strong><ul>{team.blockers.map((b,i)=><li key={`${b}-${i}`}>{readableBlocker(b)}</li>)}</ul></div>}
      {!team.executed&&['Locked','Simulation'].includes(value.phase)&&<button type="button" disabled={!team.canExecute||value.sessionStatus!=='Running'||execute.isPending} onClick={()=>execute.mutate(team.teamId)}>{execute.isPending&&execute.variables===team.teamId?'Executing…':`Execute team ${team.teamId}`}</button>}
      {selected?.teamId===team.teamId&&<form onSubmit={e=>{e.preventDefault();if(!review){setReview(true);return;}const slot=team.slots.find(s=>s.actionCode===selected.actionCode&&s.generation===selected.generation);if(slot)reopen.mutate(slot);}}><h4>Instructor correction request</h4><label htmlFor={`correction-reason-${team.teamId}-${selected.actionCode}`}>Reason (recorded with the correction)</label><textarea id={`correction-reason-${team.teamId}-${selected.actionCode}`} maxLength={2000} required value={reason} onChange={e=>{setReason(e.target.value);setReview(false);}}/><p>Reopening supersedes the confirmed slot without editing the quotation. The student must deliberately confirm again. The other side’s private quotation is not shown.</p>{review&&<p role="alert">Confirm reopening {selected.actionCode} at generation {selected.generation} for period {value.period}? This action is recorded and cannot change an executed period.</p>}<button type="submit" disabled={!reason.trim()||reopen.isPending}>{review?'Confirm reopening':'Review reopening'}</button><button type="button" className="secondary" onClick={()=>{setSelected(null);setReview(false);}}>Cancel</button></form>}
    </article>)}
    {error!==undefined&&<ErrorState error={error}/>}
  </section>;
}
