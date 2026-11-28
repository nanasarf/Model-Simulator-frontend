import { test,expect,type Page } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { laboratoryWorkspace,laboratoryContent,binding,teamId,assignmentId } from '../tests/paired-quotation-fixtures';
import type { MarketWorkspace } from '../src/features/competitive-market/paired-quotation-contracts';

// Browser acceptance of actual React/Phaser interfaces against consumer-contract fixtures.
// This harness is not a live backend or a substitute for classroom acceptance.
const SESSION='22222222-2222-2222-2222-222222222222',BUYER='11111111-1111-1111-1111-111111111111',SELLER='66666666-6666-6666-6666-666666666666',TEACHER='77777777-7777-7777-7777-777777777777',DRAFT='88888888-8888-8888-8888-888888888888';
const navigation=JSON.parse(fs.readFileSync(new URL('../src/features/world/navigation-v1.json',import.meta.url),'utf8'));
const geometryVersion=createHash('sha256').update(JSON.stringify(navigation)).digest('hex');
const directory='docs/bee-world-batch-4b';
function harness(){
 let phase='Decision',version=1;let executed=false;let executionConflict=false;let invalidBinding=false;let rejectPublication=false;
 const submissions=new Map<string,MarketWorkspace['submissions']>();
 let draft={document:{id:DRAFT,simulationDefinitionId:DRAFT,name:'Paired Quotation Seminar',status:'Draft',version:1,createdAt:'2026-11-21T12:00:00Z',updatedAt:'2026-11-21T12:00:00Z',content:{}},content:laboratoryContent()};
 const operations:{path:string;body:unknown;key:string|undefined}[]=[];
 async function attach(page:Page,user:string,platform='Student'){
  const role=user===SELLER?'SELLER':'BUYER';const action=role==='BUYER'?'SUBMIT_BUYER_BID':'SUBMIT_SELLER_ASK';
  const token='header.'+Buffer.from(JSON.stringify({sub:user,'http://schemas.microsoft.com/ws/2008/06/identity/claims/role':platform})).toString('base64')+'.signature';const tokens={accessToken:token,refreshToken:'fixture-only',accessTokenExpiresAt:new Date(Date.now()+3600000).toISOString()};
  await page.addInitScript(value=>sessionStorage.setItem('simulation.auth.v1',JSON.stringify(value)),tokens);
  await page.route('**/api/v1/**',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname;const respond=(body:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(path.endsWith('/auth/refresh'))return respond(tokens);
   if(path.endsWith('/auth/me'))return respond({id:user,email:null,platformRoles:[platform]});
   if(path.endsWith('/world/templates'))return respond([{name:'Honeyville — Nectar Commons',modelIdentifier:'Economics.CompetitiveMarket',modelVersion:'1.0.0',binding}]);
   if(path.endsWith('/scenario-authoring/templates'))return respond([{code:'HONEYVILLE_PAIRED_QUOTATION',name:'Honeyville Paired Quotation Laboratory',content:laboratoryContent()}]);
   if(path.endsWith('/validate'))return respond({canPublish:!invalidBinding,blockers:invalidBinding?[{code:'WORLD_INCOMPATIBLE',message:'This model/version supports only the installed Honeyville binding.'}]:[],warnings:[{code:'LAB_OPPORTUNITY_POLICY_UNRESOLVED',message:'Native quantity bounds are retained. Multiple distinct quotations block execution pending explicit amendment/opportunity approval.'}]});
   if(path.endsWith('/publish')){operations.push({path,body:request.postDataJSON(),key:request.headers()['idempotency-key']});if(rejectPublication)return respond({title:'scenario.validation_failed',errorCode:'scenario.validation_failed',detail:'This model/version supports only the installed Honeyville binding.'},422);return respond({scenarioVersionId:'55555555-5555-5555-5555-555555555555'});}
   if(path.includes('/scenario-versions/'))return respond({publishedVersionId:'55555555-5555-5555-5555-555555555555',simulationDefinitionId:DRAFT,title:draft.document.name,modelIdentifier:'Economics.CompetitiveMarket',modelVersion:'1.0.0',scenarioVersionNumber:1,publishedAt:'2026-11-21T12:00:00Z',isLatest:true,immutable:true,sourceScenarioArchived:false,launchable:true,launchabilityReason:null});
   if(path==='/api/v1/classrooms')return respond({items:[],page:1,pageSize:100,totalCount:0});
   if(path.includes('/scenario-authoring/drafts/')){if(request.method()==='PUT'){const body=request.postDataJSON();operations.push({path,body,key:undefined});draft={...draft,document:{...draft.document,name:body.name,version:draft.document.version+1},content:body.content};}return respond(draft);}
   if(path.endsWith('/workspace')){
    const own=submissions.get(user)??[],released=['Results','Reflection','Completed'].includes(phase);
    const w=laboratoryWorkspace({participantUserId:user,phase,sessionStatus:phase==='Completed'?'Completed':'Running',sessionVersion:version,roles:[{assignmentId,code:role,objectives:[role==='BUYER'?'Formulate a buyer quotation and explain the matching condition.':'Formulate a seller quotation and interpret the resulting price.']}],actions:[{...laboratoryWorkspace().actions[0],code:action,requiredCapability:role==='BUYER'?'MARKET_SUBMIT_BID':'MARKET_SUBMIT_ASK',canSubmit:phase==='Decision'}],submissions:own,submissionStatus:own.length?'submitted':'not-submitted',decisionStatus:phase==='Completed'?'completed':phase==='Reflection'?'reflection':released?'current-period-results-released':executed?'current-period-executed':own.length?'decision-submitted':phase==='Decision'?'decision-period-open':'awaiting-instructor-execution',executionStatus:executed?'executed':'not-executed',releaseStatus:released?'current-period-released':executed?'awaiting-release':'no-result',buyerInformation:role==='BUYER'?[{valuation:120,quantityAvailable:1}]:null,sellerInformation:role==='SELLER'?[{cost:20,quantityAvailable:1}]:null,releasedResult:released?{period:1,matchStatus:'matched',price:'60',quantityExchanged:2,unmatchedBuyerOrderQuantity:0,unmatchedSellerOrderQuantity:0,priceInterpretation:'unweighted-mean-of-executed-pair-prices'}:null});return respond(w);
   }
   if(path.endsWith('/actions')){
    const body=request.postDataJSON();operations.push({path,body,key:request.headers()['idempotency-key']});const id='receipt-'+role;
    submissions.set(user,[{submissionId:id,period:1,actionCode:body.actionCode,status:'submitted',acceptedAt:'2026-11-21T12:00:00Z',payload:body.payload}]);version++;
    return respond({id,sessionId:SESSION,roundNumber:1,teamId,userId:user,roleAssignmentId:assignmentId,actionCode:body.actionCode,payload:body.payload,idempotencyKey:request.headers()['idempotency-key'],submittedAt:'2026-11-21T12:00:00Z',submittedPhase:'Decision'},202);
   }
   if(path.endsWith('/decision-readiness'))return respond({title:'decision.corrections_unavailable',errorCode:'decision.corrections_unavailable'},422);
   if(path.endsWith('/commands/advance-phase')){phase=request.postDataJSON().targetPhase;version++;return route.fulfill({status:204});}
   if(path.endsWith('/rounds/current/execute')){operations.push({path,body:request.postDataJSON(),key:undefined});if(executionConflict)return respond({title:'market.lab_ambiguous_quotations',errorCode:'market.lab_ambiguous_quotations',detail:'More than one distinct quotation on a side.'},409);executed=true;phase='Results';version++;return respond({sessionId:SESSION,teamId,roundNumber:1});}
   if(path.endsWith('/rounds/current/readiness'))return route.fulfill({status:204});
   if(path.endsWith('/console'))return respond({sessionId:SESSION,phase,round:1,teams:[{teamId,state:executed?{round:1,lastResult:{totalSurplus:999999}}:null,submissions:[...submissions.values()].flat().map(s=>({...s,roundNumber:s.period,payload:{private:'never displayed'}})),events:[]}],history:[]});
   if(path.endsWith('/setup'))return respond({session:{id:SESSION,status:'Running',phase,roundNumber:1,isOpen:true},classroom:{id:DRAFT,name:'Economics seminar'},teams:[{teamId,name:'Seminar A',members:[]}],participants:[],availableRoles:[],roleAssignments:[],readiness:{isReady:true,blockers:[]}});
   if(path.endsWith('/lobby'))return respond({sessionId:SESSION,scenarioTitle:'Paired Quotation Seminar',status:'Running',phase,roundNumber:1,canJoin:true,canSelectTeam:false,canSelectRole:false,canMarkReady:false,teams:[{teamId,name:'Seminar A',memberCount:2,availableRoles:[]}],availableRoles:[],participant:{userId:user,teamId,isReady:true,roleAssignments:[{assignmentId,roleCode:role}]}});
   if(path.endsWith('/state'))return respond({sessionId:SESSION,status:phase==='Completed'?'Completed':'Running',phase,roundNumber:1,teamId:platform==='Student'?teamId:null,modelIdentifier:'Economics.CompetitiveMarket',modelVersion:'1.0.0',roleAssignments:platform==='Student'?[{assignmentId,teamId,roleCode:role,capabilities:[role==='BUYER'?'MARKET_SUBMIT_BID':'MARKET_SUBMIT_ASK']}]:[],availableActions:[],currentRoundSubmissions:[],visibleState:null,version,participants:platform==='Student'?[{userId:user,teamId,isReady:true,roles:[role]}]:[]});
   if(path.endsWith('/world/bootstrap'))return respond({protocolVersion:1,status:'ready',snapshot:{schemaVersion:1,sessionId:SESSION,teamId,sourceStamp:'b'.repeat(64),contentHash:'a'.repeat(64),binding,regions:[{id:'town',x:0,y:0,width:2048,height:1536}],entities:[]}});
   if(path.endsWith('/history')||path.includes('/me/'))return respond([]);
   return respond({title:'not_found',detail:path},404);
  });
  for(const name of ['sessions','world']){
   await page.route(`**/hubs/${name}/negotiate*`,route=>route.fulfill({contentType:'application/json',body:JSON.stringify({negotiateVersion:1,connectionId:`test-${name}-${user}`,connectionToken:`test-${name}-${user}`,availableTransports:[{transport:'WebSockets',transferFormats:['Text']}]})}));
   await page.routeWebSocket(`**/hubs/${name}*`,ws=>ws.onMessage(message=>{for(const part of String(message).split('\u001e').filter(Boolean)){const m=JSON.parse(part);if(m.protocol){ws.send('{}\u001e');continue;}if(!m.invocationId)continue;const player={playerId:user,teamId,x:768,y:690,facing:'south',movement:'idle',sequence:0,serverTimestamp:new Date().toISOString()};const result=name==='world'&&['EnterWorld','RecoverWorld'].includes(m.target)?{protocolVersion:1,sessionId:SESSION,epoch:DRAFT,revision:1,geometryVersion,playerId:user,leaseId:teamId,players:[player]}:undefined;ws.send(JSON.stringify({type:3,invocationId:m.invocationId,result})+'\u001e');}}));
  }
 }
 return {attach,operations,conflict:()=>{executionConflict=true;},invalidBinding:(value=true)=>{invalidBinding=value;},rejectPublication:()=>{rejectPublication=true;}};
}
async function screenshot(page:Page,file:string){await fs.promises.mkdir(directory,{recursive:true});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${directory}/${file}.png`,fullPage:true});}
const studentPath=`/student/sessions/${SESSION}`,teacherPath=`/instructor/sessions/${SESSION}/runtime`;
async function submit(page:Page,price:string){await page.getByLabel('Quoted price',{exact:true}).fill(price);await page.getByLabel('Quotation quantity').fill('2');await page.getByRole('button',{name:'Submit quotation',exact:true}).click();await expect(page.getByText(/Accepted quotation receipt/)).toBeVisible();}

test('buyer and seller use equivalent direct/world access, instructor executes, outcomes release and reflection persists',async({browser})=>{
 const s=harness();const contexts=await Promise.all([browser.newContext(),browser.newContext(),browser.newContext()]);
 try{
  const [buyer,seller,teacher]=await Promise.all(contexts.map(c=>c.newPage()));await s.attach(buyer,BUYER);await s.attach(seller,SELLER);await s.attach(teacher,TEACHER,'Instructor');
  await buyer.goto(studentPath+'/world');await expect(buyer.getByTestId('honeyville-canvas')).toHaveAttribute('data-scene-ready','true');await expect(buyer.getByTestId('honeyville-canvas')).toHaveAttribute('data-nearby','market.hall');await buyer.locator('canvas').focus();await buyer.keyboard.press('e');await expect(buyer.getByTestId('academic-workspace')).toBeVisible();await screenshot(buyer,'honey-market-workspace');await submit(buyer,'80');await buyer.getByRole('link',{name:'Open decision workspace',exact:true}).click();await expect(buyer.locator('canvas')).toHaveCount(0);await expect(buyer.getByText(/Receipt receipt-BUYER/)).toBeVisible();await screenshot(buyer,'buyer-workspace');
  await seller.goto(studentPath);await expect(seller.getByRole('heading',{name:'Seller quotation'})).toBeVisible();await submit(seller,'40');await expect(seller.getByText('Configured buyer schedule',{exact:true})).toHaveCount(0);
  await teacher.goto(teacherPath);await teacher.getByRole('button',{name:'Close decision period',exact:true}).click();await expect(teacher.getByRole('button',{name:'Execute Seminar A'})).toBeEnabled();await screenshot(teacher,'instructor-progression');await teacher.getByRole('button',{name:'Execute Seminar A'}).click();await expect(teacher.getByRole('button',{name:'Begin reflection'})).toBeEnabled();
  await buyer.getByRole('button',{name:'Refresh academic status'}).click();await expect(buyer.getByRole('definition').filter({hasText:/^60$/})).toBeVisible();await expect(buyer.getByText(/Result period/)).toContainText('1');await screenshot(buyer,'released-outcomes');
  await teacher.getByRole('button',{name:'Begin reflection'}).click();await expect(teacher.getByRole('button',{name:'Complete session',exact:true})).toBeEnabled();await seller.getByRole('button',{name:'Refresh academic status'}).click();await expect(seller.getByTestId('academic-workspace')).toContainText('Reflection');await expect(seller.getByText('60',{exact:true})).toBeVisible();
  expect(s.operations.filter(o=>o.path.endsWith('/actions'))).toHaveLength(2);expect(s.operations.filter(o=>o.path.endsWith('/execute'))).toHaveLength(1);await expect(teacher.getByText('999999',{exact:true})).toHaveCount(0);
 }finally{await Promise.all(contexts.map(c=>c.close()));}
});
test('academic actions remain available when Phaser assets and world connectivity fail',async({page})=>{
 const s=harness();await s.attach(page,BUYER);await page.route('**/world/honeyville/market.svg',r=>r.abort());await page.route('**/hubs/world/negotiate*',r=>r.abort());await page.goto(studentPath+'/world');await expect(page.getByText(/World assets unavailable/)).toBeVisible();await page.getByRole('button',{name:'Open Honey Market workspace'}).click();await expect(page.getByLabel('Quoted price',{exact:true})).toBeEnabled();await submit(page,'75');await page.getByRole('link',{name:'Open decision workspace',exact:true}).click();await expect(page.locator('canvas')).toHaveCount(0);await expect(page.getByText(/Receipt receipt-BUYER/)).toBeVisible();
});
test('instructor reviews real binding, objectives and private-information options through existing authoring',async({page})=>{
 const s=harness();await s.attach(page,TEACHER,'Instructor');await page.goto(`/instructor/scenarios/market/${DRAFT}`);await page.getByRole('button',{name:/World & Events/}).click();await expect(page.getByLabel('World template')).toHaveValue('0');await expect(page.getByLabel('BUYER: show own-side schedule')).toBeChecked();await page.getByLabel('BUYER: show own-side schedule').uncheck();await screenshot(page,'scenario-binding');await page.getByRole('button',{name:'Save Draft',exact:true}).first().click();await expect(page.getByText('All changes saved',{exact:true})).toBeVisible();expect(s.operations.find(o=>(o.body as {content?:unknown})?.content)?.body).toMatchObject({content:{world:binding,pairedQuotationLaboratory:true,roles:[{code:'BUYER',seePrivateInformation:false},{code:'SELLER',seePrivateInformation:true}]}});
 await page.getByRole('button',{name:/Review/}).first().click();await page.getByRole('button',{name:'Run Scenario Check'}).click();await expect(page.getByText(/Native quantity bounds are retained. Multiple distinct quotations block execution pending explicit amendment/)).toBeVisible();
 await page.getByRole('button',{name:'Publish Scenario',exact:true}).first().click();await expect.poll(()=>s.operations.filter(o=>o.path.endsWith('/publish')).length).toBe(1);await expect(page.getByRole('heading',{name:'Use in Class'})).toBeVisible();
});
test('invalid binding validation blocks publication and backend publication rejection stays actionable',async({page})=>{
 const s=harness();s.invalidBinding();await s.attach(page,TEACHER,'Instructor');await page.goto(`/instructor/scenarios/market/${DRAFT}`);await page.getByRole('button',{name:/Review/}).first().click();await page.getByRole('button',{name:'Run Scenario Check'}).click();await expect(page.getByText('This model/version supports only the installed Honeyville binding.')).toBeVisible();await expect(page.getByRole('button',{name:'Publish Scenario',exact:true}).last()).toBeDisabled();expect(s.operations).toHaveLength(0);
 // A concurrent backend validation change may also reject an otherwise publishable draft.
 await page.reload();s.invalidBinding(false);s.rejectPublication();await page.getByRole('button',{name:'Publish Scenario',exact:true}).first().click();await expect(page.getByRole('alert')).toContainText('This model/version supports only the installed Honeyville binding.');await expect(page).toHaveURL(new RegExp(DRAFT));
});
test('direct workspace supports keyboard submission on a narrow screen without classroom live updates',async({page})=>{
 const s=harness();await s.attach(page,BUYER);await page.setViewportSize({width:390,height:1000});await page.emulateMedia({reducedMotion:'reduce'});await page.route('**/hubs/sessions/negotiate*',r=>r.abort());await page.goto(studentPath);const price=page.getByLabel('Quoted price',{exact:true});await price.focus();await page.keyboard.type('85.25');await page.keyboard.press('Tab');await expect(page.getByLabel('Quotation quantity')).toBeFocused();await page.getByLabel('Quotation quantity').fill('2');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await screenshot(page,'mobile-decision-workspace');await page.getByRole('button',{name:'Submit quotation',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByText(/Accepted quotation receipt/)).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0);expect(s.operations.filter(o=>o.path.endsWith('/actions'))).toHaveLength(1);
});
