import {expect,it} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {parseWorkspace,quotationBody,instructorDecisionReadiness} from '../src/features/competitive-market/laboratory-service';
import {laboratoryWorkspaceV2,assignmentId,teamId} from './paired-quotation-fixtures';
import {sessionId,userId,json} from './helpers';
import {ApiClient} from '../src/lib/api/client';

it('consumes Batch 4C v1 and v2 TypeScript contract files without changing their definitions',()=>{
 const backend='../../ModelSimulator-backend/docs/contracts/paired-quotation-v2.ts';
 const local=readFileSync('src/features/competitive-market/paired-quotation-v2-contracts.ts','utf8').replaceAll('\r\n','\n');
 expect(local).toContain('expectedSlotGeneration');
 if(existsSync(backend))expect(local).toBe(readFileSync(backend,'utf8').replaceAll('\r\n','\n'));
 const backendV1='../../ModelSimulator-backend/docs/contracts/paired-quotation-v1.ts';
 if(existsSync(backendV1))expect(readFileSync('src/features/competitive-market/paired-quotation-v1.ts','utf8').replaceAll('\r\n','\n')).toBe(readFileSync(backendV1,'utf8').replaceAll('\r\n','\n'));
});
it('parses only designated v2 slots and binds confirmations to their durable generation',()=>{
 const w=laboratoryWorkspaceV2();const parsed=parseWorkspace(JSON.stringify(w),sessionId,userId);
 expect(parsed.workspace.protocolVersion).toBe(2);
 const request=JSON.parse(quotationBody(parsed.workspace,assignmentId,'SUBMIT_BUYER_BID','70.125',1,parsed.workspace.protocolVersion===2?parsed.workspace.decisionSlots[0].generation:undefined));
 expect(request).toMatchObject({actionCode:'SUBMIT_BUYER_BID',payload:{price:70.125,quantity:1},expectedSlotGeneration:0});
 expect(()=>quotationBody(parsed.workspace,assignmentId,'SUBMIT_BUYER_BID','70',1,undefined)).toThrow(/generation/);
 expect(()=>quotationBody(parsed.workspace,assignmentId,'SUBMIT_BUYER_BID','70',2,0)).toThrow(/fixed quantity/);
 w.decisionSlots[0].designatedUserId='another-user';expect(()=>parseWorkspace(JSON.stringify(w),sessionId,userId)).toThrow(/decision slot/i);
});
it('recovers a sealed v2 confirmation and does not expose superseded quotes as effective',()=>{
 const w=laboratoryWorkspaceV2({submissionStatus:'submitted',decisionStatus:'decision-submitted',decisionSlots:[{...laboratoryWorkspaceV2().decisionSlots[0],state:'confirmed',confirmationId:'receipt-current',canResubmit:false}],submissions:[{submissionId:'receipt-old',period:1,actionCode:'SUBMIT_BUYER_BID',status:'superseded',executionEligibility:'superseded',acceptedAt:'2026-11-26T12:00:00Z',payload:{price:20,quantity:1}},{submissionId:'receipt-current',period:1,actionCode:'SUBMIT_BUYER_BID',status:'submitted',executionEligibility:'effective',acceptedAt:'2026-11-26T12:01:00Z',payload:{price:70,quantity:1}}]});
 const parsed=parseWorkspace(JSON.stringify(w),sessionId,userId);expect(parsed.workspace.protocolVersion===2&&parsed.workspace.decisionSlots[0].state).toBe('confirmed');expect(parsed.workspace.submissions.filter(s=>'executionEligibility'in s&&s.executionEligibility==='effective')).toHaveLength(1);expect(parsed.prices['receipt-current']).toBe('70');
});
it('validates authoritative readiness identity and version instead of inferring from counts',async()=>{
 const api=new ApiClient('',undefined,async()=>json({protocolVersion:2,sessionId,period:1,phase:'Decision',sessionStatus:'Running',teams:[{teamId,period:1,slots:[],blockers:['BUYER:confirmation-missing'],executed:false,canExecute:false}]}));
 expect((await instructorDecisionReadiness(api,sessionId)).teams[0].canExecute).toBe(false);
 const wrong=new ApiClient('',undefined,async()=>json({protocolVersion:1,sessionId,teams:[]}));await expect(instructorDecisionReadiness(wrong,sessionId)).rejects.toThrow(/could not be verified/);
});
