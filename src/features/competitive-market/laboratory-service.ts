import type { ApiClient } from '../../lib/api/client';
import type { MarketWorkspace,QuotationAction,QuotationAcknowledgment,WorldBinding,WorldTemplateDescriptor } from './paired-quotation-contracts';
import type { DecisionSlotCorrection,InstructorDecisionReadiness,MarketWorkspaceV2,QuotationRequestV2,ReopenDecisionSlotRequest } from './paired-quotation-v2-contracts';
import { numericTokens } from './quotation-decimal';

export const academicKey=(userId:string,sessionId:string)=>['user',userId,'session',sessionId,'academic-workspace'] as const;
export type AcademicWorkspace=MarketWorkspace|MarketWorkspaceV2;
export type AcademicData={workspace:AcademicWorkspace;prices:Record<string,string>};
const actions=['SUBMIT_BUYER_BID','SUBMIT_SELLER_ASK'];
const statuses=['not-started','paused','reflection','completed','current-period-results-released','current-period-executed','decision-submitted','decision-period-open','awaiting-instructor-execution','observing'];
const integer=(value:number)=>Number.isSafeInteger(value)&&value>=0;
export function bindingEqual(a:WorldBinding|null|undefined,b:WorldBinding|null|undefined){return !!a&&!!b&&(['templateId','templateVersion','templateHash','projectorId','projectorVersion','schemaVersion'] as const).every(key=>a[key]===b[key]);}
export function validBinding(value:WorldBinding){return !!value&&value.schemaVersion===1&&/^[a-f\d]{64}$/i.test(value.templateHash)&&['templateId','templateVersion','projectorId','projectorVersion'].every(key=>typeof value[key as keyof WorldBinding]==='string'&&String(value[key as keyof WorldBinding]).length>0);}
export function parseWorkspace(source:string,sessionId:string,userId:string,teamId?:string):AcademicData{
  const raw=JSON.parse(source) as {protocolVersion?:number};
  if(raw?.protocolVersion===2)return parseV2Workspace(source,sessionId,userId,teamId);
  if(raw?.protocolVersion!==1)throw Error('Unsupported academic workspace protocol version. Refresh or contact your instructor.');
  const w=raw as MarketWorkspace;
  validateBase(w,sessionId,userId,teamId,1);
  for(const role of w.roles)if(typeof role.assignmentId!=='string'||typeof role.code!=='string'||(role.objectives!==null&&(!Array.isArray(role.objectives)||!role.objectives.every(v=>typeof v==='string'))))throw Error('Invalid role objectives.');
  for(const action of w.actions)if(!actions.includes(action.code)||typeof action.canSubmit!=='boolean'||!Array.isArray(action.allowedPhases)||!Array.isArray(action.inputs)||action.submissionPolicy!=='model-native-inputs;one-quote-per-side-required-for-execution;amendments-unresolved'||action.inputs.length!==2||!action.inputs.some(i=>i.name==='price'&&i.type==='decimal'&&i.minimum===0&&i.maximum===10000&&i.required)||!action.inputs.some(i=>i.name==='quantity'&&i.type==='integer'&&i.minimum===1&&i.maximum===1000&&i.required))throw Error('Unsupported quotation input contract.');
  for(const submission of w.submissions)if(!actions.includes(submission.actionCode)||submission.status!=='submitted'||!integer(submission.period)||!submission.payload||!Number.isFinite(submission.payload.price)||!Number.isSafeInteger(submission.payload.quantity)||typeof submission.submissionId!=='string')throw Error('Invalid submission receipt.');
  const result=w.releasedResult;
  const released=w.releaseStatus==='current-period-released'||w.releaseStatus==='previous-period-results';
  if(!!result!==released)throw Error('Result release could not be verified.');
  if(result&&(!integer(result.period)||!['matched','no-trade'].includes(result.matchStatus)||!integer(result.quantityExchanged)||!integer(result.unmatchedBuyerOrderQuantity)||!integer(result.unmatchedSellerOrderQuantity)||result.priceInterpretation!=='unweighted-mean-of-executed-pair-prices'||(w.releaseStatus==='current-period-released'?result.period!==w.decisionPeriod:result.period>=w.decisionPeriod)||(result.matchStatus==='no-trade'?(result.price!==null||result.quantityExchanged!==0):(typeof result.price!=='string'||!/^\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?$/.test(result.price)||result.quantityExchanged===0))))throw Error('The released result does not match its period or interpretation.');
  for(const side of ['buyerInformation','sellerInformation'] as const)if(w[side]!==null&&(!Array.isArray(w[side])||!w[side]!.every(row=>Number.isFinite('valuation' in row?row.valuation:row.cost)&&integer(row.quantityAvailable))))throw Error('Invalid authorized schedule.');
  // Render only the own-side schedule even if an unexpected counterpart field is supplied.
  if(!w.roles.some(r=>r.code==='BUYER'))w.buyerInformation=null;
  if(!w.roles.some(r=>r.code==='SELLER'))w.sellerInformation=null;
  const numbers=numericTokens(source);const prices:Record<string,string>={};
  w.submissions.forEach((s,i)=>{prices[s.submissionId]=numbers.get(JSON.stringify(['submissions',i,'payload','price']))??String(s.payload.price);});
  return {workspace:w,prices};
}
function validateBase(w:MarketWorkspace|MarketWorkspaceV2,sessionId:string,userId:string,teamId:string|undefined,version:1|2){
  const slotState=version===2&&(w.decisionStatus==='correction-pending'||w.submissionStatus==='correction-pending');
  if(w.protocolVersion!==version||w.sessionId!==sessionId||w.participantUserId!==userId||(teamId!==undefined&&w.teamId!==teamId)||typeof w.teamId!=='string'||w.modelIdentifier!=='Economics.CompetitiveMarket'||w.modelVersion!=='1.0.0'||w.gameplay?.identifier!=='Honeyville.PairedQuotation'||w.gameplay.version!==version||!integer(w.decisionPeriod)||!integer(w.sessionVersion)||(!statuses.includes(w.decisionStatus)&&!slotState)||(!['submitted','not-submitted'].includes(w.submissionStatus)&&!slotState)||!['executed','not-executed'].includes(w.executionStatus)||!['current-period-released','previous-period-results','awaiting-release','no-result'].includes(w.releaseStatus)||!Array.isArray(w.roles)||!Array.isArray(w.actions)||!Array.isArray(w.submissions)||!Array.isArray(w.limitations)||typeof w.informationPolicy!=='string')throw Error('The academic workspace contract or session identity could not be verified. Refresh or contact your instructor.');
  for(const role of w.roles)if(typeof role.assignmentId!=='string'||typeof role.code!=='string'||(role.objectives!==null&&(!Array.isArray(role.objectives)||!role.objectives.every(v=>typeof v==='string'))))throw Error('Invalid role objectives.');
  for(const action of w.actions){const policy=version===2?'single-unit-confirmation;instructor-reopen-only;commit-order-dependent':'model-native-inputs;one-quote-per-side-required-for-execution;amendments-unresolved';if(!actions.includes(action.code)||typeof action.canSubmit!=='boolean'||!Array.isArray(action.allowedPhases)||!Array.isArray(action.inputs)||action.submissionPolicy!==policy||action.inputs.length!==2||!action.inputs.some(i=>i.name==='price'&&i.type==='decimal'&&i.minimum===0&&i.maximum===10000&&i.required)||!action.inputs.some(i=>i.name==='quantity'&&i.type==='integer'&&i.minimum===1&&i.maximum===(version===2?1:1000)&&i.required))throw Error('Unsupported quotation input contract.');}
  for(const submission of w.submissions){if(!actions.includes(submission.actionCode)||!integer(submission.period)||!submission.payload||!Number.isFinite(submission.payload.price)||!Number.isSafeInteger(submission.payload.quantity)||typeof submission.submissionId!=='string')throw Error('Invalid submission receipt.');if(version===1&&submission.status!=='submitted')throw Error('Invalid v1 submission receipt.');if(version===2&&(!('executionEligibility' in submission)||(submission.status!=='submitted'&&submission.status!=='superseded')||(submission.executionEligibility!=='effective'&&submission.executionEligibility!=='superseded')||(submission.status==='superseded')!==(submission.executionEligibility==='superseded')))throw Error('Invalid v2 submission eligibility.');}
  if(version===2){const v=w as MarketWorkspaceV2;if(!Array.isArray(v.decisionSlots)||v.decisionSlots.length>2||new Set(v.decisionSlots.map(s=>s.actionCode)).size!==v.decisionSlots.length)throw Error('The authorized decision slots could not be verified.');for(const slot of v.decisionSlots){if(slot.teamId!==w.teamId||slot.period!==w.decisionPeriod||!actions.includes(slot.actionCode)||slot.designatedUserId!==userId||!integer(slot.generation)||!['BUYER','SELLER'].includes(slot.roleCode)||!['open','confirmed','reopened'].includes(slot.state)||typeof slot.correctionPending!=='boolean'||typeof slot.wasReopened!=='boolean'||typeof slot.canResubmit!=='boolean'||!Array.isArray(slot.corrections))throw Error('Invalid authorized decision slot.');if(slot.confirmationId===null&&slot.state==='confirmed'||slot.confirmationId!==null&&slot.state!=='confirmed'||slot.correctionPending!==(slot.state==='reopened'))throw Error('Decision slot status is inconsistent.');for(const correction of slot.corrections)if(correction.sessionId!==sessionId||correction.teamId!==w.teamId||correction.period!==w.decisionPeriod||correction.actionCode!==slot.actionCode||!integer(correction.generation)||typeof correction.reason!=='string')throw Error('Invalid authorized correction receipt.');}}
}
function parseV2Workspace(source:string,sessionId:string,userId:string,teamId?:string):AcademicData{
 const w=JSON.parse(source) as MarketWorkspaceV2;validateBase(w,sessionId,userId,teamId,2);
 const result=w.releasedResult,released=w.releaseStatus==='current-period-released'||w.releaseStatus==='previous-period-results';
 if(!!result!==released)throw Error('Result release could not be verified.');
 if(result){
   const validBase=integer(result.period)&&['matched','no-trade'].includes(result.matchStatus)&&integer(result.quantityExchanged)&&integer(result.unmatchedBuyerOrderQuantity)&&integer(result.unmatchedSellerOrderQuantity)&&result.priceInterpretation==='unweighted-mean-of-executed-pair-prices';
   const validPeriod=w.releaseStatus==='current-period-released'?result.period===w.decisionPeriod:result.period<w.decisionPeriod;
   const validPrice=result.matchStatus==='no-trade'?result.price===null&&result.quantityExchanged===0:typeof result.price==='string'&&/^\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?$/.test(result.price)&&result.quantityExchanged>0;
   if(!validBase||!validPeriod||!validPrice)throw Error('The released result does not match its period or interpretation.');
 }
 for(const side of ['buyerInformation','sellerInformation'] as const)if(w[side]!==null&&(!Array.isArray(w[side])||!w[side]!.every(row=>Number.isFinite('valuation' in row?row.valuation:row.cost)&&integer(row.quantityAvailable))))throw Error('Invalid authorized schedule.');
 if(!w.roles.some(r=>r.code==='BUYER'))w.buyerInformation=null;if(!w.roles.some(r=>r.code==='SELLER'))w.sellerInformation=null;
 const numbers=numericTokens(source),prices:Record<string,string>={};w.submissions.forEach((s,i)=>{prices[s.submissionId]=numbers.get(JSON.stringify(['submissions',i,'payload','price']))??String(s.payload.price);});return {workspace:w,prices};
}
export async function readWorkspace(api:ApiClient,sessionId:string,userId:string,teamId?:string,signal?:AbortSignal){return parseWorkspace(await api.text(`/api/v1/economics/competitive-market/sessions/${encodeURIComponent(sessionId)}/workspace`,{signal}),sessionId,userId,teamId);}
export async function worldTemplates(api:ApiClient,signal?:AbortSignal){
  const values=await api.json<WorldTemplateDescriptor[]>('/api/v1/world/templates?modelIdentifier=Economics.CompetitiveMarket&modelVersion=1.0.0',{signal});
  if(!Array.isArray(values)||!values.every(v=>v.modelIdentifier==='Economics.CompetitiveMarket'&&v.modelVersion==='1.0.0'&&typeof v.name==='string'&&validBinding(v.binding)))throw Error('The compatible world catalog returned an invalid binding. Retry discovery; no binding was selected.');
  return values;
}
export function quotationBody(w:AcademicWorkspace,assignmentId:string,actionCode:QuotationAction,price:string,quantity:number,generation?:number){
  if(w.protocolVersion===2&&!integer(generation!))throw Error('Current decision slot generation is required.');
  if(w.protocolVersion===2&&quantity!==1)throw Error('Policy v2 quotations have a fixed quantity of one unit.');
  const serialized=`{"teamId":${JSON.stringify(w.teamId)},"roleAssignmentId":${JSON.stringify(assignmentId)},"actionCode":${JSON.stringify(actionCode)},"payload":{"price":${price},"quantity":${quantity}},"expectedRound":${w.decisionPeriod},"expectedPhase":"Decision"`;
  return w.protocolVersion===2?`${serialized},"expectedSlotGeneration":${generation}}`:`${serialized}}`;
}
export async function sendQuotation(api:ApiClient,sessionId:string,body:string,key:string){
  const response=await api.json<QuotationAcknowledgment>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/actions`,{method:'POST',serializedBody:body,idempotencyKey:key});
  const request=JSON.parse(body);
  if(!response||response.sessionId!==sessionId||response.roundNumber!==request.expectedRound||response.teamId!==request.teamId||response.roleAssignmentId!==request.roleAssignmentId||response.actionCode!==request.actionCode||response.idempotencyKey!==key||typeof response.id!=='string')throw Error('Submission confirmation could not be verified. Recover authoritative status before retrying.');
  return response;
}
export async function instructorDecisionReadiness(api:ApiClient,sessionId:string,signal?:AbortSignal){
 const value=await api.json<InstructorDecisionReadiness>(`/api/v1/economics/competitive-market/sessions/${encodeURIComponent(sessionId)}/decision-readiness`,{signal});
 if(!value||value.protocolVersion!==2||value.sessionId!==sessionId||!Number.isSafeInteger(value.period)||!Array.isArray(value.teams))throw Error('The instructor decision readiness response could not be verified.');return value;
}
export async function reopenSlot(api:ApiClient,sessionId:string,instructorId:string,request:ReopenDecisionSlotRequest,key:string){
 const receipt=await api.json<DecisionSlotCorrection>(`/api/v1/economics/competitive-market/sessions/${encodeURIComponent(sessionId)}/quotation-slots/reopen`,{method:'POST',body:request,idempotencyKey:key});
 if(!receipt||receipt.sessionId!==sessionId||receipt.teamId!==request.teamId||receipt.period!==request.period||receipt.actionCode!==request.actionCode||receipt.generation!==request.expectedGeneration+1||receipt.instructorUserId!==instructorId||typeof receipt.id!=='string'||!receipt.id||typeof receipt.voidedSubmissionId!=='string'||!receipt.voidedSubmissionId||typeof receipt.reason!=='string'||!receipt.reason||typeof receipt.reopenedAt!=='string'||Number.isNaN(Date.parse(receipt.reopenedAt)))throw Error('The instructor correction acknowledgment could not be verified. Recover the authoritative readiness view before taking another action.');
 return receipt;
}
