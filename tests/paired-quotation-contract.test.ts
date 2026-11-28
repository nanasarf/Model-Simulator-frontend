import { expect,it } from 'vitest';
import { readFileSync,existsSync } from 'node:fs';
import { decimalToken,withinBounds,numericTokens } from '../src/features/competitive-market/quotation-decimal';
import { parseWorkspace,quotationBody,worldTemplates } from '../src/features/competitive-market/laboratory-service';
import { laboratoryWorkspace } from './paired-quotation-fixtures';
import { sessionId,userId,json } from './helpers';
import { ApiClient } from '../src/lib/api/client';

it('consumes the unchanged backend TypeScript consumer contract when the checkout is available',()=>{
 const backend='../../ModelSimulator-backend/docs/contracts/paired-quotation-v1.ts';const source=readFileSync('src/features/competitive-market/paired-quotation-contracts.ts','utf8').replaceAll('\r\n','\n');expect(source).toContain('interface QuotationRequest');if(existsSync(backend))expect(source).toBe(readFileSync(backend,'utf8').replaceAll('\r\n','\n'));
});
it('preserves exact decimal input as a JSON number, with native quantity bounds independent from configured units',()=>{
 const value='100.1234567890123456789012345',token=decimalToken(value)!;expect(token).toBe(value);expect(withinBounds(token,0,10000)).toBe(true);const w=laboratoryWorkspace();const body=quotationBody(w,w.roles[0].assignmentId,w.actions[0].code,token,1000);expect(body).toContain(`"price":${value}`);expect(JSON.parse(body)).toMatchObject({expectedRound:1,expectedPhase:'Decision',payload:{quantity:1000}});expect(decimalToken('0.0000000000000000000000000001')).not.toBeNull();expect(decimalToken('1e3')).toBeNull();expect(decimalToken('-1')).toBeNull();expect(decimalToken('NaN')).toBeNull();expect(decimalToken('0.00000000000000000000000000001')).toBeNull();expect(withinBounds('10000.1',0,10000)).toBe(false);
});
it('retains accepted quotation decimal lexemes independently from JSON.parse binary-number conversion',()=>{
 const w=laboratoryWorkspace({submissionStatus:'submitted',submissions:[{submissionId:'receipt',period:1,actionCode:'SUBMIT_BUYER_BID',status:'submitted',acceptedAt:'2026-11-21T12:00:00Z',payload:{price:0,quantity:1}}]});const source=JSON.stringify(w).replace('"price":0','"price":100.1234567890123456789012345');expect(parseWorkspace(source,sessionId,userId).prices.receipt).toBe('100.1234567890123456789012345');expect(numericTokens('{"a":[{},[],{"price":0.10}],"quoted":"price: 9"}').get('["a",2,"price"]')).toBe('0.10');
});
it('fails closed on foreign sessions, accounts, teams and unsupported input contracts',()=>{
 const w=laboratoryWorkspace();expect(()=>parseWorkspace(JSON.stringify(w),'foreign',userId)).toThrow();expect(()=>parseWorkspace(JSON.stringify(w),sessionId,'foreign')).toThrow();expect(()=>parseWorkspace(JSON.stringify(w),sessionId,userId,'foreign')).toThrow();w.actions[0].inputs[1].maximum=1;expect(()=>parseWorkspace(JSON.stringify(w),sessionId,userId)).toThrow('input contract');
});
it('never accepts unreleased result data and keeps previous-period attribution explicit',()=>{
 const result={period:1,matchStatus:'matched' as const,price:'60.000000000000000000000001',quantityExchanged:1,unmatchedBuyerOrderQuantity:0,unmatchedSellerOrderQuantity:0,priceInterpretation:'unweighted-mean-of-executed-pair-prices' as const};expect(()=>parseWorkspace(JSON.stringify(laboratoryWorkspace({releasedResult:result})),sessionId,userId)).toThrow('release');const previous=parseWorkspace(JSON.stringify(laboratoryWorkspace({decisionPeriod:2,releaseStatus:'previous-period-results',releasedResult:result})),sessionId,userId);expect(previous.workspace.releasedResult?.period).toBe(1);expect(()=>parseWorkspace(JSON.stringify(laboratoryWorkspace({releaseStatus:'previous-period-results',releasedResult:result})),sessionId,userId)).toThrow('period');
});
it('distinguishes no-trade null prices from actual matched zero-price results',()=>{
 const result={period:1,matchStatus:'no-trade' as const,price:null,quantityExchanged:0,unmatchedBuyerOrderQuantity:1,unmatchedSellerOrderQuantity:1,priceInterpretation:'unweighted-mean-of-executed-pair-prices' as const};expect(parseWorkspace(JSON.stringify(laboratoryWorkspace({releaseStatus:'current-period-released',releasedResult:result})),sessionId,userId).workspace.releasedResult?.price).toBeNull();expect(parseWorkspace(JSON.stringify(laboratoryWorkspace({releaseStatus:'current-period-released',releasedResult:{...result,matchStatus:'matched',price:'0',quantityExchanged:1}})),sessionId,userId).workspace.releasedResult?.price).toBe('0');
});
it('removes unexpected counterpart schedules from student presentation data',()=>{const data=parseWorkspace(JSON.stringify(laboratoryWorkspace({sellerInformation:[{cost:98765,quantityAvailable:1}]})),sessionId,userId);expect(data.workspace.sellerInformation).toBeNull();});
it('rejects malformed catalog bindings instead of automatically binding a scenario',async()=>{const api=new ApiClient('',undefined,async()=>json([{name:'bad',modelIdentifier:'Economics.CompetitiveMarket',modelVersion:'1.0.0',binding:{schemaVersion:2}}]));await expect(worldTemplates(api)).rejects.toThrow('invalid binding');});
