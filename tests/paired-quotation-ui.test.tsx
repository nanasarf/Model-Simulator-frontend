import { afterEach,expect,it,vi } from 'vitest';
import { render,screen,waitFor,fireEvent,cleanup } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MarketInstructorProgression } from '../src/features/competitive-market/MarketInstructorProgression';
import { RuntimeProvider } from '../src/app/runtime';
import { ApiClient } from '../src/lib/api/client';
import { AuthSession } from '../src/lib/auth/session';
import { createQueryClient } from '../src/lib/api/query';
import { PairedQuotationWorkspace } from '../src/features/competitive-market/PairedQuotationWorkspace';
import { WorldBindingEditor } from '../src/features/competitive-market/WorldBindingEditor';
import type { MarketWorkspace } from '../src/features/competitive-market/paired-quotation-contracts';
import type { CompetitiveMarketScenarioContent } from '../src/types/competitive-market';
import { laboratoryWorkspace,laboratoryContent,binding,teamId } from './paired-quotation-fixtures';
import { tokens,vault,json,sessionTransport,sessionId,userId } from './helpers';

const clients:ReturnType<typeof createQueryClient>[]=[];
afterEach(()=>{cleanup();clients.splice(0).forEach(q=>q.clear());sessionStorage.clear();});
async function mount(transport:typeof fetch,node:React.ReactNode,role='Student'){
 const wrapped:typeof fetch=(input,init)=>String(input).endsWith('/auth/refresh')?Promise.resolve(json(tokens(role))):transport(input,init);
 const api=new ApiClient('',undefined,sessionTransport(wrapped));const auth=new AuthSession(api,vault(tokens()));await auth.initialize();const queries=createQueryClient();clients.push(queries);
 const runtime={api,auth,queries};const view=render(<RuntimeProvider runtime={runtime}><MemoryRouter>{node}</MemoryRouter></RuntimeProvider>);return {...view,queries,auth,runtime};
}
function server(initial=laboratoryWorkspace()){
 let workspace=initial;let post:((init:RequestInit)=>Promise<Response>)|undefined;
 const requests:RequestInit[]=[];
 const transport:typeof fetch=async(input,init)=>{
  const path=String(input);if(path.endsWith('/auth/refresh'))return json(tokens());
  if(path.endsWith('/workspace'))return json(workspace);
  if(path.endsWith('/lobby'))return json({sessionId,scenarioTitle:'Paired quotation seminar',teams:[{teamId,name:'Seminar A'}]});
  if(path.endsWith('/actions')){requests.push(init!);if(post)return post(init!);const body=JSON.parse(String(init!.body));workspace={...workspace,submissionStatus:'submitted',decisionStatus:'decision-submitted',submissions:[{submissionId:'receipt-one',period:workspace.decisionPeriod,actionCode:body.actionCode,status:'submitted',acceptedAt:'2026-11-21T12:00:00Z',payload:body.payload}]};return json({id:'receipt-one',sessionId,roundNumber:workspace.decisionPeriod,userId,teamId,roleAssignmentId:body.roleAssignmentId,actionCode:body.actionCode,idempotencyKey:new Headers(init!.headers).get('Idempotency-Key'),payload:body.payload},202);}
  return json([]);
 };
 return {transport,requests,set:(value:MarketWorkspace)=>{workspace=value;},post:(value:typeof post)=>{post=value;}};
}
async function fill(price='85.125',quantity='2'){
 const priceInput=await screen.findByLabelText('Quoted price');await userEvent.type(priceInput,price);const quantityInput=screen.getByLabelText('Quotation quantity');await userEvent.clear(quantityInput);await userEvent.type(quantityInput,quantity);await waitFor(()=>expect(screen.getByRole('button',{name:'Submit quotation'})).toBeEnabled());
}
it('submits an authorized buyer quotation once, preserving exact numeric input and recovering the receipt',async()=>{
 const s=server();await mount(s.transport,<PairedQuotationWorkspace sessionId={sessionId} teamId={teamId}/>);await fill('85.12345678901234567890123456','7');const button=screen.getByRole('button',{name:'Submit quotation'});fireEvent.click(button);fireEvent.click(button);
 await screen.findByText(/Accepted quotation receipt receipt-one/);expect(s.requests).toHaveLength(1);expect(String(s.requests[0].body)).toContain('"price":85.12345678901234567890123456');expect(JSON.parse(String(s.requests[0].body))).toMatchObject({expectedRound:1,expectedPhase:'Decision',payload:{quantity:7},actionCode:'SUBMIT_BUYER_BID'});expect(new Headers(s.requests[0].headers).get('Idempotency-Key')).toMatch(/^[a-f\d-]{36}$/i);expect(screen.getByText(/UI safeguard, not an authoritative/)).toBeVisible();
});
it('rejects invalid decimal and fractional quantity before making an economic request',async()=>{
 const s=server();await mount(s.transport,<PairedQuotationWorkspace sessionId={sessionId}/>);await fill('10001','1.5');fireEvent.click(screen.getByRole('button',{name:'Submit quotation'}));expect(await screen.findByText(/Enter a decimal price/)).toBeVisible();expect(s.requests).toHaveLength(0);
});
it('uses the seller assignment and authorized action, with no buyer-private schedule',async()=>{
 const w=laboratoryWorkspace();w.roles=[{...w.roles[0],code:'SELLER',objectives:['Quote an ask.']}];w.actions=[{...w.actions[0],code:'SUBMIT_SELLER_ASK',requiredCapability:'MARKET_SUBMIT_ASK'}];w.buyerInformation=null;w.sellerInformation=[{cost:20,quantityAvailable:1}];const s=server(w);await mount(s.transport,<PairedQuotationWorkspace sessionId={sessionId}/>);await fill('40');expect(screen.getByRole('heading',{name:'Seller quotation'})).toBeVisible();expect(screen.queryByText('Configured buyer schedule')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Submit quotation'}));await waitFor(()=>expect(s.requests).toHaveLength(1));expect(JSON.parse(String(s.requests[0].body)).actionCode).toBe('SUBMIT_SELLER_ASK');
});
it('does not offer a buyer form to an unsupported role even if actions are inconsistent',async()=>{
 const w=laboratoryWorkspace({roles:[],buyerInformation:null});await mount(server(w).transport,<PairedQuotationWorkspace sessionId={sessionId}/>);expect(await screen.findByRole('heading',{name:'No authorized quotation action'})).toBeVisible();expect(screen.queryByLabelText('Quoted price')).toBeNull();
});
it('scopes the additional-quotation safeguard to its authorized action when an account has both assignments',async()=>{
 const w=laboratoryWorkspace({submissionStatus:'submitted',submissions:[{submissionId:'bid',period:1,actionCode:'SUBMIT_BUYER_BID',status:'submitted',acceptedAt:'2026-11-21T12:00:00Z',payload:{price:80,quantity:1}}]});w.roles.push({assignmentId:'seller-assignment',code:'SELLER',objectives:[]});w.actions.push({...w.actions[0],code:'SUBMIT_SELLER_ASK',requiredCapability:'MARKET_SUBMIT_ASK'});await mount(server(w).transport,<PairedQuotationWorkspace sessionId={sessionId}/>);expect(await screen.findByRole('heading',{name:'Seller quotation'})).toBeVisible();expect(screen.getByLabelText('Quoted price')).toHaveAttribute('id','price-SUBMIT_SELLER_ASK');
});
it('requires authoritative recovery before retrying an ambiguous request with the identical body and key',async()=>{
 const s=server();s.post(async()=>{throw Error('transport interrupted');});await mount(s.transport,<PairedQuotationWorkspace sessionId={sessionId}/>);await fill();fireEvent.click(screen.getByRole('button',{name:'Submit quotation'}));await screen.findByText(/Submission outcome is unconfirmed/);const retry=screen.getByRole('button',{name:'Retry identical quotation with the same key'});expect(retry).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Recover submission status'}));await waitFor(()=>expect(retry).toBeEnabled());fireEvent.click(retry);await waitFor(()=>expect(s.requests).toHaveLength(2));expect(s.requests[1].body).toBe(s.requests[0].body);expect(new Headers(s.requests[1].headers).get('Idempotency-Key')).toBe(new Headers(s.requests[0].headers).get('Idempotency-Key'));
});
it('restores uncertain request identity after page-style remount and never submits automatically',async()=>{
 const s=server();s.post(async()=>{throw Error('offline');});const first=await mount(s.transport,<PairedQuotationWorkspace sessionId={sessionId}/>);await fill();fireEvent.click(screen.getByRole('button',{name:'Submit quotation'}));await screen.findByText(/Submission outcome is unconfirmed/);first.unmount();first.queries.clear();await mount(s.transport,<PairedQuotationWorkspace sessionId={sessionId}/>);await screen.findByText(/Submission outcome is unconfirmed/);expect(s.requests).toHaveLength(1);fireEvent.click(screen.getByRole('button',{name:'Recover submission status'}));const retry=screen.getByRole('button',{name:'Retry identical quotation with the same key'});await waitFor(()=>expect(retry).toBeEnabled());fireEvent.click(retry);await waitFor(()=>expect(s.requests).toHaveLength(2));expect(s.requests[1].body).toBe(s.requests[0].body);expect(new Headers(s.requests[1].headers).get('Idempotency-Key')).toBe(new Headers(s.requests[0].headers).get('Idempotency-Key'));
});
it('keeps form state isolated when navigating to a different session',async()=>{
 const other='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';const transport:typeof fetch=async input=>String(input).endsWith('/workspace')?json(laboratoryWorkspace({sessionId:String(input).includes(other)?other:sessionId})):json({sessionId,teams:[]});const view=await mount(transport,<PairedQuotationWorkspace sessionId={sessionId}/>);await fill('12','8');view.rerender(<RuntimeProvider runtime={view.runtime}><PairedQuotationWorkspace sessionId={other}/></RuntimeProvider>);await waitFor(()=>expect(screen.getByLabelText('Quoted price')).toHaveValue(''));expect(screen.getByLabelText('Quotation quantity')).toHaveValue('1');
});
it('recovers accepted work after lost acknowledgment and does not replay it or add another quote',async()=>{
 const w=laboratoryWorkspace();const s=server(w);s.post(async()=>{s.set({...w,submissionStatus:'submitted',decisionStatus:'decision-submitted',submissions:[{submissionId:'recovered',period:1,actionCode:'SUBMIT_BUYER_BID',status:'submitted',acceptedAt:'2026-11-21T12:00:00Z',payload:{price:85,quantity:2}}]});throw Error('lost acknowledgment');});await mount(s.transport,<PairedQuotationWorkspace sessionId={sessionId}/>);await fill();fireEvent.click(screen.getByRole('button',{name:'Submit quotation'}));expect(await screen.findByText(/server now reports accepted work/)).toBeVisible();expect(screen.queryByRole('button',{name:'Submit quotation'})).toBeNull();expect(s.requests).toHaveLength(1);
});
it('retains stale-period rejection feedback after authoritative recovery moves to another period',async()=>{
 const w=laboratoryWorkspace();const s=server(w);s.post(async()=>{s.set({...w,decisionPeriod:2});return json({title:'Stale decision',detail:'Use current period.',errorCode:'decision.stale'},409);});await mount(s.transport,<PairedQuotationWorkspace sessionId={sessionId}/>);await fill();fireEvent.click(screen.getByRole('button',{name:'Submit quotation'}));expect(await screen.findByText(/Quotation attempt for period 1/)).toHaveTextContent('Current decision period: 2');
});
it.each(['Paused','Completed'])('keeps accepted work recoverable and submission disabled in %s',async status=>{
 const w=laboratoryWorkspace({sessionStatus:status,decisionStatus:status==='Paused'?'paused':'completed',submissionStatus:'submitted',submissions:[{submissionId:'retained',period:1,actionCode:'SUBMIT_BUYER_BID',status:'submitted',acceptedAt:'2026-11-21T12:00:00Z',payload:{price:70,quantity:1}}]});await mount(server(w).transport,<PairedQuotationWorkspace sessionId={sessionId}/>);expect(await screen.findByText(/Receipt retained/)).toBeVisible();expect(screen.queryByRole('button',{name:'Submit quotation'})).toBeNull();expect(screen.getByRole('button',{name:'Mark period ready'})).toBeDisabled();
});
it('renders released previous-period outcomes in Reflection without fabricated indicators',async()=>{
 const w=laboratoryWorkspace({phase:'Reflection',decisionStatus:'reflection',decisionPeriod:2,releaseStatus:'previous-period-results',releasedResult:{period:1,matchStatus:'matched',price:'60.000000000000000000000001',quantityExchanged:1,unmatchedBuyerOrderQuantity:0,unmatchedSellerOrderQuantity:0,priceInterpretation:'unweighted-mean-of-executed-pair-prices'}});await mount(server(w).transport,<PairedQuotationWorkspace sessionId={sessionId}/>);expect(await screen.findByText(/Previous-period result; current decision period is 2/)).toBeVisible();expect(screen.getByText(w.releasedResult!.price!)).toBeVisible();expect(screen.queryByRole('term',{name:'Welfare'})).toBeNull();expect(screen.queryByRole('img')).toBeNull();
});
it('fails closed on authorization errors and permits legacy fallback only for an explicit non-laboratory response',async()=>{
 const transport:typeof fetch=async input=>String(input).endsWith('/workspace')?json({title:'Forbidden',errorCode:'session.forbidden'},403):json([]);await mount(transport,<PairedQuotationWorkspace sessionId={sessionId} legacy={<p>Legacy actions</p>}/>);expect(await screen.findByRole('heading',{name:'Academic workspace unavailable'})).toBeVisible();expect(screen.queryByText('Legacy actions')).toBeNull();
});
function BindingHarness(){const [value,set]=useState<CompetitiveMarketScenarioContent>({...laboratoryContent(),world:null,pairedQuotationLaboratory:false});return <><WorldBindingEditor value={value} onChange={set}/><output data-testid="draft">{JSON.stringify(value)}</output></>;}
it('discovers compatible bindings without automatically binding, applies the backend template and preserves private options',async()=>{
 const transport:typeof fetch=async input=>String(input).includes('/world/templates')?json([{name:'Honeyville from catalog',modelIdentifier:'Economics.CompetitiveMarket',modelVersion:'1.0.0',binding}]):String(input).endsWith('/templates')?json([{id:'HONEYVILLE_PAIRED_QUOTATION',name:'Paired laboratory',content:laboratoryContent()}]):json([]);
 await mount(transport,<BindingHarness/>);const select=await screen.findByLabelText('World template');expect(select).toHaveValue('none');fireEvent.change(select,{target:{value:'0'}});expect(JSON.parse(screen.getByTestId('draft').textContent!).world).toEqual(binding);expect(JSON.parse(screen.getByTestId('draft').textContent!).pairedQuotationLaboratory).toBe(false);fireEvent.click(await screen.findByText('Review backend-provided laboratory template'));fireEvent.click(screen.getByRole('button',{name:'Apply backend laboratory template'}));expect(JSON.parse(screen.getByTestId('draft').textContent!)).toEqual(laboratoryContent());fireEvent.click(screen.getByLabelText('BUYER: show own-side schedule'));expect(JSON.parse(screen.getByTestId('draft').textContent!).roles[0].seePrivateInformation).toBe(false);fireEvent.change(select,{target:{value:'none'}});expect(JSON.parse(screen.getByTestId('draft').textContent!).world).toBeNull();
});
it('offers policy v2 only when the backend provides the compatible v2 template',async()=>{
 const contentV2={...laboratoryContent(),gameplayPolicyVersion:2 as const};const transport:typeof fetch=async input=>String(input).includes('/world/templates')?json([{name:'Honeyville from catalog',modelIdentifier:'Economics.CompetitiveMarket',modelVersion:'1.0.0',binding}]):String(input).endsWith('/templates')?json([{id:'HONEYVILLE_PAIRED_QUOTATION',name:'Existing policy',content:laboratoryContent()},{id:'HONEYVILLE_PAIRED_QUOTATION_V2',name:'Introductory policy v2',content:contentV2}]):json([]);
 await mount(transport,<BindingHarness/>);fireEvent.click(await screen.findByText('Review backend-provided laboratory template'));fireEvent.click(screen.getByRole('button',{name:'Apply backend laboratory template'}));const policy=await screen.findByLabelText('Laboratory gameplay policy');expect(policy).toHaveValue('1');fireEvent.change(policy,{target:{value:'2'}});expect(JSON.parse(screen.getByTestId('draft').textContent!)).toMatchObject({gameplayPolicyVersion:2,pairedQuotationLaboratory:true,world:binding});expect(await screen.findByText(/single-confirmation and one unit/)).toBeVisible();
});
it('shows instructor D3 execution conflicts without exposing console payloads and reuses the execution identity',async()=>{
 const requests:RequestInit[]=[];const transport:typeof fetch=async(input,init)=>{
  const path=String(input);if(path.endsWith('/setup'))return json({session:{},classroom:{id:'classroom'},teams:[{teamId,name:'Seminar A'}]});
  if(path.endsWith('/decision-readiness'))return json({title:'decision.corrections_unavailable',errorCode:'decision.corrections_unavailable'},422);
  if(path.endsWith('/console'))return json({sessionId,phase:'Locked',round:1,teams:[{teamId,state:null,submissions:[{roundNumber:1,actionCode:'SUBMIT_BUYER_BID',payload:{price:8765}},{roundNumber:1,actionCode:'SUBMIT_BUYER_BID',payload:{price:9876}}]}]});
  if(path.endsWith('/execute')){requests.push(init!);return json({title:'market.lab_ambiguous_quotations',errorCode:'market.lab_ambiguous_quotations',detail:'Multiple distinct quotations.'},409);}return json([]);
 };
 const view=await mount(transport,<MarketInstructorProgression sessionId={sessionId} period={1} phase="Locked" status="Running"/>,'Instructor');const execute=await screen.findByRole('button',{name:'Execute Seminar A'});await waitFor(()=>expect(execute).toBeEnabled());fireEvent.click(execute);expect(await screen.findByRole('heading',{name:'D3: laboratory execution blocked'})).toBeVisible();expect(screen.queryByText('8765')).toBeNull();expect(JSON.stringify(view.queries.getQueryCache().getAll().map(q=>q.state.data))).not.toContain('9876');await waitFor(()=>expect(execute).toBeEnabled());fireEvent.click(execute);await waitFor(()=>expect(requests).toHaveLength(2));expect(requests[1].body).toBe(requests[0].body);
});
it('disables instructor execution while paused',async()=>{
 const transport:typeof fetch=async input=>String(input).endsWith('/setup')?json({session:{},classroom:{id:'classroom'},teams:[{teamId,name:'Seminar A'}]}):String(input).endsWith('/decision-readiness')?json({title:'decision.corrections_unavailable',errorCode:'decision.corrections_unavailable'},422):json({sessionId,phase:'Locked',round:1,teams:[{teamId,state:null,submissions:[]}]});await mount(transport,<MarketInstructorProgression sessionId={sessionId} period={1} phase="Locked" status="Paused"/>,'Instructor');expect(await screen.findByRole('button',{name:'Execute Seminar A'})).toBeDisabled();
});
