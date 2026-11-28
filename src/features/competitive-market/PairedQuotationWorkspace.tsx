import { useRef,useState,type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth,useRuntime } from '../../app/runtime';
import { ErrorState,LoadingState } from '../../components/states';
import { ApiProblem } from '../../lib/errors/problem';
import { invalidateSession,keys } from '../../lib/api/query';
import { courseService } from '../courses/service';
import { sessionService } from '../sessions/service';
import { academicKey,quotationBody,readWorkspace,sendQuotation,type AcademicData } from './laboratory-service';
import type { MarketWorkspaceV2 } from './paired-quotation-v2-contracts';
import { readPendingQuotation,writePendingQuotation,clearPendingQuotation } from './quotation-storage';
import { decimalToken,withinBounds } from './quotation-decimal';
import type { MarketWorkspace,MarketWorkspaceAction } from './paired-quotation-contracts';
import './laboratory.css';

export const D3_TEXT='D3 submission policy is unresolved. Quantities retain the native 1–1000 bounds. Distinct additional quotations are not amendments and can block laboratory execution. There is no cancellation or amendment workflow; ask your instructor before taking further action.';
type Attempt={key:string;body:string;price:string;quantity:string;status:'sending'|'unknown'|'accepted'|'rejected';receiptId?:string;error?:unknown;recovered?:boolean};
type FormState={price:string;quantity:string;attempt:Attempt|null};
type QuotationNotice={period:number;code:string;message:string};
const noticeKey=(uid:string,id:string,teamId:string)=>['user',uid,'session',id,'quotation-notice',teamId] as const;
const decisionLabels:Record<MarketWorkspace['decisionStatus'],string>={
  'not-started':'Session not started',paused:'Session paused',reflection:'Reflection',completed:'Session completed',
  'current-period-results-released':'Current-period results released','current-period-executed':'Execution completed; awaiting release',
  'decision-submitted':'Quotation accepted; not an executed trade','decision-period-open':'Decision period open',
  'awaiting-instructor-execution':'Awaiting instructor execution',observing:'Observe and prepare',
};
function quotationErrorMessage(error:ApiProblem){
  switch(error.errorCode){
    case 'market.quotation_already_confirmed':return 'This role and period already have a confirmed quotation. A distinct request cannot replace it; ask your instructor if a correction is needed.';
    case 'decision.confirmation_superseded':return 'This retry belongs to a quotation superseded by an instructor reopening. Refresh the slot and make a new deliberate confirmation with its current generation.';
    case 'decision.slot_stale':return 'The slot generation changed. This request was rejected; refresh the authoritative workspace before submitting a new confirmation.';
    case 'decision.correction_closed':return 'The period is closed or executed. This slot cannot be reopened for another quotation.';
    case 'market.quantity_fixed':return 'Policy v2 accepts exactly one unit per quotation.';
    case 'idempotency.conflict':return 'This request key was already used with different quotation details. Recover the current slot before creating a new confirmation.';
    default:return error.detail||error.title;
  }
}

export function PairedQuotationWorkspace({sessionId,teamId,legacy}:{sessionId:string;teamId?:string;legacy?:ReactNode}){
  const {api}=useRuntime();const {user}=useAuth();const uid=user!.id;
  const query=useQuery({queryKey:[...academicKey(uid,sessionId),teamId??'self'],queryFn:({signal})=>readWorkspace(api,sessionId,uid,teamId,signal),refetchInterval:10000,staleTime:0});
  const context=useQuery({queryKey:keys.lobby(uid,sessionId),queryFn:({signal})=>courseService(api).lobby(sessionId,signal)});
  if(query.isPending)return <LoadingState label="Recovering your academic workspace"/>;
  if(query.isError){
    if(query.error instanceof ApiProblem&&['market.lab_required','market.session_required'].includes(query.error.errorCode??''))return <>{legacy??<p className="notice">This scenario is not opted into the Paired Quotation Laboratory. Use its existing session workspace.</p>}</>;
    return <section className="card"><h2>Academic workspace unavailable</h2><p>Accepted work remains on the server. Recover current authorization and status before submitting; map or presence recovery is not required.</p><ErrorState error={query.error} retry={()=>void query.refetch()}/>{!(query.error instanceof ApiProblem)&&<p role="alert">{query.error.message}</p>}</section>;
  }
  const {workspace:w,prices}=query.data;const lobby=context.data?.sessionId===sessionId?context.data:undefined;
  const team=lobby?.teams.find(t=>t.teamId===w.teamId);
  const authorizedActions=w.actions.filter(action=>w.roles.some(role=>role.code===(action.code==='SUBMIT_BUYER_BID'?'BUYER':'SELLER')));
  return <section className="academic-lab" aria-labelledby="academic-title" data-testid="academic-workspace">
    <header className="academic-heading"><div><p className="eyebrow">ACADEMIC DECISION WORKSPACE</p><h2 id="academic-title">Honeyville Paired Quotation Laboratory</h2><p>{lobby?.scenarioTitle??`Scenario version ${w.scenarioVersionId}`}</p></div><button type="button" className="secondary" disabled={query.isFetching} onClick={()=>void query.refetch()}>{query.isFetching?'Refreshing…':'Refresh academic status'}</button></header>
    <dl className="session-facts"><div><dt>Decision period</dt><dd>{w.decisionPeriod}</dd></div><div><dt>Your role</dt><dd>{w.roles.map(r=>r.code).join(', ')||'No assigned role'}</dd></div><div><dt>Your team</dt><dd>{team?.name??w.teamId}</dd></div><div><dt>Session</dt><dd>{w.sessionStatus} · {w.phase}</dd></div><div><dt>Model</dt><dd>{w.modelIdentifier} {w.modelVersion}</dd></div><div><dt>Market scope</dt><dd>Independent team market</dd></div></dl>
    <p className="academic-status" role="status">{w.decisionStatus==='correction-pending'?'Instructor reopened your quotation slot; resubmission is required.':decisionLabels[w.decisionStatus]}</p>
    <QuotationNotices workspace={w}/>
    <section className="card"><h3>Your role objectives</h3>{!w.roles.length?<p>No role objectives were supplied.</p>:w.roles.map(role=><div key={role.assignmentId}><h4>{role.code}</h4>{role.objectives===null?<p>No authored objectives were provided for this role.</p>:!role.objectives.length?<p>No objectives were configured for this role.</p>:<ul>{role.objectives.map((objective,index)=><li key={index}>{objective}</li>)}</ul>}</div>)}</section>
    <section className="card"><h3>Authorized economic information</h3><p>Schedules are model-generated own-side information, not a personal endowment, account, or assigned inventory. Counterpart information is not shown.</p>
      {w.buyerInformation===null&&w.sellerInformation===null&&<p>No role-private schedule is available under the frozen information settings.</p>}
      {w.buyerInformation!==null&&<table className="academic-table"><caption>Configured buyer schedule</caption><thead><tr><th scope="col">Valuation</th><th scope="col">Configured quantity</th></tr></thead><tbody>{w.buyerInformation.map((entry,i)=><tr key={i}><td>{entry.valuation}</td><td>{entry.quantityAvailable}</td></tr>)}</tbody></table>}
      {w.sellerInformation!==null&&<table className="academic-table"><caption>Configured seller schedule</caption><thead><tr><th scope="col">Cost</th><th scope="col">Configured quantity</th></tr></thead><tbody>{w.sellerInformation.map((entry,i)=><tr key={i}><td>{entry.cost}</td><td>{entry.quantityAvailable}</td></tr>)}</tbody></table>}
    </section>
    {w.protocolVersion===2?<section className="notice" aria-label="Policy v2 confirmation rules"><h3>Introductory laboratory policy · v2</h3><p>Each designated role may confirm one quotation of one unit for this period. Confirmation seals that slot. Only your instructor can reopen it; reopening does not change the quotation and requires you to submit a new confirmation. A quotation is not an executed trade.</p></section>:<section className="notice academic-d3" aria-labelledby="d3-title"><h3 id="d3-title">Laboratory limitation — D3</h3><p>{D3_TEXT}</p><p>This laboratory is not classroom-ready until D3 is resolved and tested. A quotation is recorded input, not an executed trade, an equilibrium price, or a personal settlement.</p></section>}
    <section className="card"><h3>Your quotation history</h3>{!w.submissions.length?<p>No quotation is currently reported for you in this decision period.</p>:<ul className="academic-receipts">{w.submissions.map(s=><li key={s.submissionId}><strong>Period {s.period} · {s.actionCode==='SUBMIT_BUYER_BID'?'Buyer bid':'Seller ask'}{w.protocolVersion===2&&s.status==='superseded'?' · superseded by instructor reopening':''}</strong><p>Price {prices[s.submissionId]} · quantity {s.payload.quantity} · recorded <time dateTime={s.acceptedAt}>{s.acceptedAt}</time></p><small>Receipt {s.submissionId}. Recorded input; not evidence of a trade or individual authorship.</small></li>)}</ul>}
      {w.submissions.length>1&&<p role="alert">Multiple accepted quotations are present. None is discarded or treated as the winning amendment. Laboratory execution may be blocked; ask your instructor.</p>}
    </section>
    {authorizedActions.length?authorizedActions.map(action=><QuotationForm key={`${w.teamId}:${w.decisionPeriod}:${action.code}:${w.roles.map(r=>r.assignmentId).join(':')}:${w.protocolVersion===2?w.decisionSlots.find(s=>s.actionCode===action.code)?.generation??'no-slot':'v1'}`} workspace={w} action={action} refreshing={query.isFetching} recover={async()=>{const result=await query.refetch();if(result.error)throw result.error;return result.data!;}}/>):<section className="card"><h3>No authorized quotation action</h3><p>Your current role has no supported buyer or seller quotation action. Contact your instructor if your assignment is incorrect.</p></section>}
    <AcademicReadiness key={`${w.teamId}:${w.decisionPeriod}:${w.roles.map(role=>role.assignmentId).join(':')}`} workspace={w}/>
    <ReleasedResult workspace={w}/>
    <section className="card"><h3>Interpretation and reflection</h3><p>Compare the released matching and price outcomes with your expectations in instructor-led discussion. This interface does not store individual reasoning or assess academic performance.</p><p>The reported price is the model’s unweighted mean of executed pair prices. This paired exercise does not establish a perfectly competitive equilibrium. Welfare, personal profits and counterpart quotations are not displayed.</p>{w.limitations.length>0&&<details><summary>Backend-reported limitations</summary><ul>{w.limitations.map(value=><li key={value}>{value}</li>)}</ul></details>}</section>
  </section>;
}

function QuotationForm({workspace:w,action,refreshing,recover}:{workspace:AcademicData['workspace'];action:MarketWorkspace['actions'][number]|MarketWorkspaceV2['actions'][number];refreshing:boolean;recover:()=>Promise<AcademicData>}){
  const {api,auth,queries}=useRuntime();const {user}=useAuth();const uid=user!.id;
  const assignment=w.roles.find(r=>r.code===(action.code==='SUBMIT_BUYER_BID'?'BUYER':'SELLER'));
  const slot=w.protocolVersion===2?w.decisionSlots.find(s=>s.actionCode===action.code):undefined;
  const generation=slot?.generation;
  const formKey=['user',uid,'session',w.sessionId,'quotation-form',w.teamId,w.decisionPeriod,assignment?.assignmentId??'none',action.code,...(w.protocolVersion===2?[generation??'no-slot']:[])] as const;
  const cached=useQuery<FormState>({queryKey:formKey,queryFn:()=>({price:'',quantity:'1',attempt:null}),enabled:false,initialData:()=>{
    const value=readPendingQuotation(formKey) as Attempt|null;const price=value&&typeof value.price==='string'?decimalToken(value.price):null;
    if(value&&typeof value.key==='string'&&/^[\da-f-]{36}$/i.test(value.key)&&price&&withinBounds(price,0,10000)&&typeof value.quantity==='string'&&/^\d+$/.test(value.quantity)&&Number.isSafeInteger(Number(value.quantity))&&Number(value.quantity)>=1&&Number(value.quantity)<=(w.protocolVersion===2?1:1000)&&assignment&&quotationBody(w,assignment.assignmentId,action.code,price,Number(value.quantity),generation)===value.body)return {price:value.price,quantity:value.quantity,attempt:{...value,status:'unknown',recovered:false}};
    return {price:'',quantity:'1',attempt:null};
  },gcTime:30*60*1000});
  const form=cached.data!;const [validation,setValidation]=useState('');const [recovering,setRecovering]=useState(false);const sending=useRef(false);
  const update=(patch:Partial<FormState>)=>queries.setQueryData<FormState>(formKey,old=>({...old!,...patch}));
  const confirmed=slot?.state==='confirmed'&&!!slot.confirmationId;
  const ownAccepted=(w.protocolVersion===2?confirmed:w.submissions.some(submission=>submission.actionCode===action.code)||(w.submissionStatus==='submitted'&&!w.submissions.length))||form.attempt?.status==='accepted';
  const canSubmit=!!assignment&&action.canSubmit&&action.allowedPhases.includes(w.phase)&&w.phase==='Decision'&&w.sessionStatus==='Running'&&(w.protocolVersion===1||!!slot?.canResubmit);
  const [reviewing,setReviewing]=useState(false);
  const pending=form.attempt?.status==='sending';const uncertain=form.attempt?.status==='unknown';
  const canRetry=uncertain&&form.attempt?.recovered===true&&canSubmit&&!ownAccepted&&!refreshing&&!recovering;
  async function recoverStatus(){
    setRecovering(true);try{await recover();const attempt=queries.getQueryData<FormState>(formKey)?.attempt;if(auth.snapshot().user?.id===uid&&attempt?.status==='unknown')update({attempt:{...attempt,recovered:true}});}catch{/* Keep retry fenced until an authoritative recovery succeeds. */}finally{setRecovering(false);}
  }
  async function send(retry=false){
    if(sending.current||pending||!canSubmit||ownAccepted||refreshing||(!retry&&uncertain))return;
    const price=decimalToken(form.price),quantity=w.protocolVersion===2?1:Number(form.quantity);
    const p=action.inputs.find(i=>i.name==='price')!,q=action.inputs.find(i=>i.name==='quantity')!;
    if(!retry&&(!price||!withinBounds(price,p.minimum,p.maximum)||!/^\d+$/.test(form.quantity)||!Number.isSafeInteger(quantity)||quantity<q.minimum||quantity>q.maximum)){setValidation(w.protocolVersion===2?'Enter a price from 0 to 10000. The policy fixes quotation quantity at one unit.':'Enter a decimal price from 0 to 10000 and an integer quantity from 1 to 1000. If the price has many decimal places, shorten it to fit the supported numeric precision (up to 28 decimal places).');return;}
    setValidation('');sending.current=true;
    const attempt:Attempt=retry?{...form.attempt!,status:'sending',error:undefined,recovered:false}:{key:crypto.randomUUID(),body:quotationBody(w,assignment!.assignmentId,action.code,price!,quantity,generation),price:form.price,quantity:String(quantity),status:'sending'};
    writePendingQuotation(formKey,{...attempt,status:'unknown',error:undefined,recovered:false});
    update({attempt});
    try{
      const ack=await sendQuotation(api,w.sessionId,attempt.body,attempt.key);
      if(ack.userId!==uid)throw Error('The acknowledgment identity could not be verified. Recover status before retrying.');
      if(auth.snapshot().user?.id===uid&&queries.getQueryData<FormState>(formKey)?.attempt?.key===attempt.key){clearPendingQuotation(formKey);queries.setQueryData(noticeKey(uid,w.sessionId,w.teamId),null);update({attempt:{...attempt,status:'accepted',receiptId:ack.id}});}
    }catch(error){
      const rejected=error instanceof ApiProblem&&[400,401,403,404,409,422].includes(error.status);
      if(auth.snapshot().user?.id===uid&&queries.getQueryData<FormState>(formKey)?.attempt?.key===attempt.key){
        if(rejected){clearPendingQuotation(formKey);const problem=error as ApiProblem;queries.setQueryData<QuotationNotice>(noticeKey(uid,w.sessionId,w.teamId),{period:w.decisionPeriod,code:problem.errorCode??problem.title,message:quotationErrorMessage(problem)});}
        update({attempt:{...attempt,status:rejected?'rejected':'unknown',error,recovered:false}});
      }
    }finally{sending.current=false;if(auth.snapshot().user?.id===uid)void invalidateSession(queries,uid,w.sessionId);}
  }
  return <section className="card"><h3>{action.code==='SUBMIT_BUYER_BID'?'Buyer quotation':'Seller quotation'}</h3>
    {w.protocolVersion===2&&<p role="status">{slot?.state==='confirmed'?`Confirmed for this period at ${w.submissions.find(s=>s.submissionId===slot.confirmationId)?.payload.price??'the recorded price'}. Slot sealed; instructor reopening is required for correction.`:slot?.correctionPending?'Your instructor reopened this slot. Submit a new deliberate confirmation.':slot?.wasReopened?'Slot reopened; resubmission is pending.':'One designated quotation slot · generation '+(generation??'unavailable')}</p>}
    {!canSubmit&&<p role="status">Quotation submission is closed for the current role, session status or phase.{w.protocolVersion===2&&!slot?.canResubmit?' The slot is sealed or no longer available.':''}</p>}
    {ownAccepted?<p role="status">{w.protocolVersion===2?'Your quotation is confirmed. It remains a recorded input awaiting instructor-controlled execution; it is not an executed trade. Changes require instructor intervention.':'Your quotation has been accepted. This interface avoids adding another distinct quotation because it can block execution under unresolved D3; this is a UI safeguard, not an authoritative one-submission rule. No amendment or cancellation is offered.'}</p>:<form onSubmit={event=>{event.preventDefault();if(w.protocolVersion===2&&!reviewing){const price=decimalToken(form.price);if(!price||!withinBounds(price,0,10000)){setValidation('Enter a price from 0 to 10000 before review.');return;}setValidation('');setReviewing(true);}else void send();}} noValidate>
      <div className="form-grid columns-2"><div className="form-field"><label htmlFor={`price-${action.code}`}>Quoted price</label><input id={`price-${action.code}`} inputMode="decimal" type="text" maxLength={64} value={form.price} disabled={!canSubmit||pending||uncertain} onChange={event=>update({price:event.target.value,attempt:form.attempt?.status==='rejected'?null:form.attempt})} aria-describedby={`requirements-${action.code}`} aria-invalid={!!validation}/></div>
        <div className="form-field"><label htmlFor={`quantity-${action.code}`}>Quotation quantity</label>{w.protocolVersion===2?<input id={`quantity-${action.code}`} type="text" value="1 unit (fixed by policy)" readOnly aria-describedby={`requirements-${action.code}`}/>:<input id={`quantity-${action.code}`} type="text" inputMode="numeric" maxLength={4} value={form.quantity} disabled={!canSubmit||pending||uncertain} onChange={event=>update({quantity:event.target.value,attempt:form.attempt?.status==='rejected'?null:form.attempt})} aria-describedby={`requirements-${action.code}`} aria-invalid={!!validation}/>}</div></div>
      <p id={`requirements-${action.code}`} className="field-help">Price: 0–10000, decimal. Quantity: {w.protocolVersion===2?'exactly one unit by the active policy.':'1–1000, whole units.'} Submission records a quotation and does not execute a trade.</p>
      {validation&&<p role="alert">{validation}</p>}{reviewing&&w.protocolVersion===2&&<div className="quotation-confirmation" role="group" aria-label="Review quotation"><h4>Review before confirmation</h4><p>{action.code==='SUBMIT_BUYER_BID'?'Buyer bid':'Seller ask'} · period {w.decisionPeriod} · price {form.price} · quantity 1 unit.</p><p>Confirmation seals this designated slot. You cannot amend it yourself; only an instructor can reopen it, after which you must confirm a new quotation. Confirmation does not execute a trade.</p><button type="submit" disabled={!canSubmit||pending||uncertain||refreshing}>{pending?'Confirming…':'Confirm quotation'}</button><button type="button" className="secondary" onClick={()=>setReviewing(false)}>Edit quotation</button></div>}
      {!(w.protocolVersion===2&&reviewing)&&<button type="submit" disabled={!canSubmit||pending||uncertain||refreshing}>{w.protocolVersion===2?'Review quotation':pending?'Submitting quotation…':'Submit quotation'}</button>}
    </form>}
    {form.attempt?.status==='accepted'&&<p className="academic-status" role="status">Accepted quotation receipt {form.attempt.receiptId}. Awaiting authoritative status/execution; not a trade.</p>}
    {uncertain&&!ownAccepted&&<div role="status"><p>Submission outcome is unconfirmed. Recover academic status first. Do not create a fresh quotation to work around a timeout.</p><button type="button" className="secondary" disabled={recovering||refreshing} onClick={()=>void recoverStatus()}>{recovering?'Recovering submission…':'Recover submission status'}</button><button type="button" className="secondary" disabled={!canRetry} onClick={()=>void send(true)}>Retry identical quotation with the same key</button></div>}
    {form.attempt?.status==='rejected'&&<p role="alert">Quotation rejected or conflicted. {form.attempt.error instanceof ApiProblem?quotationErrorMessage(form.attempt.error):'Review current authorization and slot status before submitting again.'}</p>}
    {form.attempt?.error!==undefined&&!(ownAccepted&&uncertain)&&<ErrorState error={form.attempt.error}/>}
    {ownAccepted&&uncertain&&<p>The server now reports accepted work. The unconfirmed request is not replayed and no additional quotation is created.</p>}
  </section>;
}

function QuotationNotices({workspace:w}:{workspace:AcademicData['workspace']}){
  const {user}=useAuth();const query=useQuery<QuotationNotice|null>({queryKey:noticeKey(user!.id,w.sessionId,w.teamId),queryFn:()=>null,enabled:false,initialData:null});
  return query.data?<p role="alert">Quotation attempt for period {query.data.period}: {query.data.message} Current decision period: {w.decisionPeriod}. Reference: {query.data.code}.</p>:null;
}

function AcademicReadiness({workspace:w}:{workspace:AcademicData['workspace']}){
  const {api,queries}=useRuntime();const {user}=useAuth();const [pending,setPending]=useState(false),[accepted,setAccepted]=useState(false),[error,setError]=useState<unknown>();
  async function ready(){if(pending)return;setPending(true);setError(undefined);try{await sessionService(api).roundReadiness(w.sessionId,{ready:true});setAccepted(true);void invalidateSession(queries,user!.id,w.sessionId);}catch(e){setError(e);}finally{setPending(false);}}
  return <section className="card"><h3>Decision-period readiness</h3><p>Accepted quotations still await instructor closure and execution. Initial session readiness is separate from readiness for this period.</p><button type="button" disabled={pending||w.submissionStatus!=='submitted'||w.sessionStatus!=='Running'||w.phase!=='Decision'} onClick={()=>void ready()}>{pending?'Recording readiness…':'Mark period ready'}</button>{accepted&&<p role="status">The server acknowledged period readiness. Your instructor controls the next phase.</p>}{error!==undefined&&<ErrorState error={error}/>}</section>;
}

export function ReleasedResult({workspace:w}:{workspace:AcademicData['workspace']}){
  const result=w.releasedResult;
  return <section className="card academic-results" aria-labelledby="results-title"><h3 id="results-title">Released market outcomes</h3>
    {!result?<p role="status">{w.releaseStatus==='awaiting-release'?'Execution is complete for your team; results are withheld until session release. No numeric outcome is available.':'No released market outcome is available for this view. No result does not mean a zero-price trade.'}</p>:<>
      <p className="academic-result-period">Result period <strong>{result.period}</strong>{w.releaseStatus==='previous-period-results'?` · Previous-period result; current decision period is ${w.decisionPeriod}`:' · Released for the current decision period'}</p>
      <p>{result.matchStatus==='no-trade'?'No trade occurred. A null price is not free nectar.':'The submitted quotations matched. These are team-market results, not personal settlements.'}</p>
      <dl className="session-facts"><div><dt>Match</dt><dd>{result.matchStatus==='matched'?'Matched':'No trade'}</dd></div><div><dt>Model-reported price</dt><dd>{result.price===null?'Not applicable (no trade)':result.price}</dd></div><div><dt>Quantity exchanged</dt><dd>{result.quantityExchanged}</dd></div><div><dt>Unfilled buyer order quantity</dt><dd>{result.unmatchedBuyerOrderQuantity}</dd></div><div><dt>Unfilled seller order quantity</dt><dd>{result.unmatchedSellerOrderQuantity}</dd></div></dl>
      <p>Unfilled order quantities do not establish economy-wide scarcity or persistent inventory. No welfare or individual profit is inferred.</p>
    </>}
  </section>;
}
