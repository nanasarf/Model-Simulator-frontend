import { test,expect,type Page } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const navigation=JSON.parse(fs.readFileSync(new URL('../src/features/world/navigation-v1.json',import.meta.url),'utf8'));
const geometryVersion=createHash('sha256').update(JSON.stringify(navigation)).digest('hex');
const raw=JSON.parse(fs.readFileSync(new URL('../src/features/world/honeyville.json',import.meta.url),'utf8'));
const meta=Object.fromEntries(raw.properties.map((p:{name:string;value:unknown})=>[p.name,p.value]));
const SESSION='22222222-2222-2222-2222-222222222222',SECOND='44444444-4444-4444-4444-444444444444',USER='11111111-1111-1111-1111-111111111111',TEAM='33333333-3333-3333-3333-333333333333';
const path=(id=SESSION)=>`/student/sessions/${id}/world`;
type Options={role?:string;status?:string;denied?:boolean;anonymous?:boolean;sessionStatus?:string;peers?:number;observer?:boolean};
async function fixtures(page:Page,options:Options={}){
  const role=options.role??'Student';const payload={sub:USER,'http://schemas.microsoft.com/ws/2008/06/identity/claims/role':role};const token='header.'+Buffer.from(JSON.stringify(payload)).toString('base64')+'.signature';
  const tokens={accessToken:token,refreshToken:'test-only',accessTokenExpiresAt:new Date(Date.now()+3600000).toISOString()};
  if(!options.anonymous)await page.addInitScript(t=>sessionStorage.setItem('simulation.auth.v1',JSON.stringify(t)),tokens);
  const requests:{path:string;method:string}[]=[];
  await page.route('**/api/v1/**',async route=>{
    const url=new URL(route.request().url());requests.push({path:url.pathname,method:route.request().method()});
    const id=url.pathname.includes(SECOND)?SECOND:SESSION;
    const response=(body:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(url.pathname.endsWith('/auth/refresh'))return response(tokens);
    if(url.pathname.endsWith('/auth/me'))return response({id:USER,email:'student@example.test',platformRoles:[role]});
    if(options.denied&&url.pathname.includes('/sessions/'))return response({title:'session.not_found',detail:'Session was not found.'},404);
    if(url.pathname.endsWith('/state'))return response({sessionId:id,status:options.sessionStatus??'Running',phase:'Results',roundNumber:2,teamId:TEAM,modelIdentifier:'Economics.CompetitiveMarket',modelVersion:'1.0.0',roleAssignments:[{assignmentId:'66666666-6666-6666-6666-666666666666',teamId:TEAM,roleCode:'BUYER',capabilities:['MARKET_SUBMIT_BID']}],availableActions:[],currentRoundSubmissions:[],visibleState:null,version:12,participants:[{userId:USER,teamId:TEAM,isReady:true,roles:['BUYER']}]});
    if(url.pathname.endsWith('/world/bootstrap'))return response({protocolVersion:1,status:options.status??'ready',snapshot:options.status&&options.status!=='ready'?null:{schemaVersion:1,sessionId:id,teamId:TEAM,sourceStamp:'b'.repeat(64),contentHash:'a'.repeat(64),binding:{templateId:meta.projectionTemplateId,templateVersion:meta.projectionTemplateVersion,templateHash:meta.projectionTemplateHash,projectorId:meta.projectorId,projectorVersion:meta.projectorVersion,schemaVersion:1},regions:[{id:'town',x:0,y:0,width:2048,height:1536}],entities:[{id:'market.hall',kind:'building',regionId:'town',transform:{x:768,y:640,rotation:0},visual:{prefabKey:'market-board',variantKey:'default'},indicators:[{key:'round',value:'2',unitKey:'round'},{key:'price',value:'73.125',unitKey:'model-price'},{key:'quantityExchanged',value:'12',unitKey:'units'}]}]}});
    if(url.pathname.endsWith('/history')||url.pathname.startsWith('/api/v1/me/'))return response([]);
    return response({title:'not_found'},404);
  });
  await page.route('**/hubs/sessions/negotiate*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({negotiateVersion:1,connectionId:'test-connection',connectionToken:'test-connection',availableTransports:[{transport:'WebSockets',transferFormats:['Text']}]})}));
  const sockets:{send:(message:string)=>void}[]=[];
  await page.routeWebSocket('**/hubs/sessions*',ws=>{sockets.push(ws);ws.onMessage(message=>{for(const part of String(message).split('\u001e').filter(Boolean)){const m=JSON.parse(part);if(m.protocol)ws.send('{}\u001e');else if(m.invocationId)ws.send(JSON.stringify({type:3,invocationId:m.invocationId})+'\u001e');}});});
  const actor=(index:number)=>({playerId:`${index.toString(16).padStart(4,'0')}0000-0000-0000-0000-${String(index).padStart(12,'0')}`,teamId:TEAM,x:760+(index%6)*95,y:850+Math.floor(index/6)*90,facing:'south',movement:'idle',sequence:0,serverTimestamp:new Date().toISOString()});
  const own={...actor(0),x:1008,y:980};const secondOwn={...actor(99),x:1008,y:980};const players=[own,...Array.from({length:options.peers??0},(_,i)=>actor(i+1))];let revision=1;
  await page.route('**/hubs/world/negotiate*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({negotiateVersion:1,connectionId:'world-test',connectionToken:'world-test',availableTransports:[{transport:'WebSockets',transferFormats:['Text']}]})}));
  const worldSockets:{send:(message:string)=>void;close:()=>void}[]=[];let movementMessages=0;
  await page.routeWebSocket('**/hubs/world*',ws=>{requests.push({path:'/hubs/world',method:'CONNECT'});worldSockets.push(ws);ws.onClose(()=>{const index=worldSockets.indexOf(ws);if(index>=0)worldSockets.splice(index,1);});ws.onMessage(message=>{for(const part of String(message).split('\u001e').filter(Boolean)){const m=JSON.parse(part);if(m.protocol){ws.send('{}\u001e');continue;}if(!m.invocationId)continue;
    const sessionId=typeof m.arguments?.[0]==='string'?m.arguments[0]:m.arguments?.[0]?.sessionId??SESSION;
    const local=sessionId===SECOND?secondOwn:own;
    let result:unknown;if(m.target==='EnterWorld'||m.target==='RecoverWorld')result={protocolVersion:1,sessionId,epoch:SECOND,revision,geometryVersion,playerId:local.playerId,leaseId:options.observer?'00000000-0000-0000-0000-000000000000':TEAM,players:sessionId===SECOND?[secondOwn]:players};
    if(m.target==='MoveWorld'){movementMessages++;Object.assign(local,m.arguments[0],{serverTimestamp:new Date().toISOString()});result=local;ws.send(JSON.stringify({type:1,target:'WorldPresenceChanged',arguments:[{protocolVersion:1,sessionId,epoch:SECOND,revision:++revision,kind:'moved',player:local,serverTimestamp:local.serverTimestamp}]})+'\u001e');}
    ws.send(JSON.stringify({type:3,invocationId:m.invocationId,result})+'\u001e');
  }});});
  return {requests,movementMessages:()=>movementMessages,disconnectWorld:()=>worldSockets[0]?.close(),animatePeers:(step:number)=>{for(const [index,peer] of players.slice(1).entries()){peer.x=760+((index+1)%6)*95+Math.sin(step/8)*12;peer.facing=step%50<25?'east':'west';peer.movement='moving';peer.sequence++;peer.serverTimestamp=new Date().toISOString();for(const ws of worldSockets)ws.send(JSON.stringify({type:1,target:'WorldPresenceChanged',arguments:[{protocolVersion:1,sessionId:SESSION,epoch:SECOND,revision:++revision,kind:'moved',player:peer,serverTimestamp:peer.serverTimestamp}]})+'\u001e');}},removePeer:()=>{const peer=players.pop();if(peer)for(const ws of worldSockets)ws.send(JSON.stringify({type:1,target:'WorldPresenceChanged',arguments:[{protocolVersion:1,sessionId:SESSION,epoch:SECOND,revision:++revision,kind:'left',player:peer,serverTimestamp:new Date().toISOString()}]})+'\u001e');},revoke:()=>sockets.forEach(ws=>ws.send(JSON.stringify({type:1,target:'SessionAccessRevoked',arguments:[{sessionId:SESSION,status:'Removed'}]})+'\u001e'))};
}
const viewport=(page:Page)=>page.getByTestId('honeyville-canvas');
async function ready(page:Page){await expect(viewport(page)).toHaveAttribute('data-scene-ready','true');await expect(viewport(page)).toHaveAttribute('data-local-x',/^\d+\.\d$/);await expect(viewport(page).locator('canvas')).toHaveCount(1);}
async function position(page:Page){return viewport(page).evaluate(e=>({x:Number(e.getAttribute('data-local-x')),y:Number(e.getAttribute('data-local-y'))}));}
async function move(page:Page,key:string,milliseconds:number){await viewport(page).locator('canvas').focus();await page.keyboard.down(key);await page.waitForTimeout(milliseconds);await page.keyboard.up(key);await page.waitForTimeout(130);}
async function moveTo(page:Page,axis:'x'|'y',target:number,key:string){
  await viewport(page).locator('canvas').focus();const start=(await position(page))[axis];
  if(Math.abs(start-target)<5)return;
  key=axis==='x'?(start>target?'a':'d'):(start>target?'w':'s');
  await page.keyboard.down(key);try{await expect.poll(async()=>{const current=(await position(page))[axis];return start>target?current<=target:current>=target;},{timeout:20000,intervals:[40]}).toBe(true);}finally{await page.keyboard.up(key);}await page.waitForTimeout(130);
}
async function market(page:Page){await moveTo(page,'y',900,'w');await moveTo(page,'x',768,'a');await moveTo(page,'y',690,'w');await expect(viewport(page)).toHaveAttribute('data-nearby','market.hall');await page.keyboard.press('e');await expect(page.getByRole('heading',{name:'Market board'})).toBeVisible();}

test('a student explores a real map, inspects facilities and sees only supplied market information',async({page})=>{
  const {requests}=await fixtures(page);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(path());await ready(page);
  await moveTo(page,'y',900,'w');await expect(viewport(page)).toHaveAttribute('data-nearby','public.square');await page.keyboard.press('e');await expect(page.getByRole('heading',{name:'Public Square',exact:true})).toBeVisible();
  const before=await position(page);await page.keyboard.press('w');await page.waitForTimeout(180);expect(await position(page)).toEqual(before);
  await page.getByRole('button',{name:'Close facility panel'}).click();
  await market(page);await expect(page.getByText('73.125',{exact:true})).toBeVisible();
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/honeyville-desktop.png',fullPage:true});
  expect(requests.filter(r=>r.path.includes('/sessions/')&&r.method!=='GET')).toEqual([]);expect(errors).toEqual([]);
  await page.getByRole('link',{name:'Return to session'}).click();await expect(page.getByRole('heading',{name:'Simulation session',exact:true})).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0);
});
test('building and perimeter collisions constrain movement without hijacking interface focus',async({page})=>{
  await fixtures(page);await page.goto(path());await ready(page);await market(page);await page.getByRole('button',{name:'Close facility panel'}).click();
  await move(page,'w',1600);const first=await position(page);expect(first.y).toBeGreaterThan(638);await move(page,'w',700);expect(Math.abs((await position(page)).y-first.y)).toBeLessThan(2);
  // Multiplayer snapshots can retain the accepted market position across a refresh.
  // Return to the clear central path before approaching the north perimeter.
  await moveTo(page,'y',900,'s');await moveTo(page,'x',1008,'d');await moveTo(page,'y',50,'w');expect((await position(page)).y).toBeGreaterThan(32);expect((await position(page)).y).toBeLessThan(55);
  await page.getByRole('link',{name:'Return to session'}).focus();const p=await position(page);await page.keyboard.press('ArrowDown');await page.waitForTimeout(200);expect(await position(page)).toEqual(p);
});
test('SPA navigation destroys the previous scene and creates one fresh session-local instance',async({page})=>{
  await fixtures(page);await page.goto(path());await ready(page);await moveTo(page,'x',1060,'d');expect((await position(page)).x).toBeGreaterThan(1030);
  await page.evaluate(url=>{history.pushState({},'',url);dispatchEvent(new PopStateEvent('popstate'));},path(SECOND));await ready(page);await expect(page).toHaveURL(new RegExp(SECOND));await expect(viewport(page)).toHaveAttribute('data-local-x','1008.0');await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('link',{name:'Return to session'}).click();await expect(page.locator('canvas')).toHaveCount(0);await page.getByRole('link',{name:/Enter Honeyville/}).click();await ready(page);await expect(page.locator('canvas')).toHaveCount(1);
});
test('missing assets have a recoverable error rather than a broken canvas',async({page})=>{
  await fixtures(page);await page.route('**/world/honeyville/market.svg',route=>route.abort());await page.goto(path());await expect(page.getByRole('alert')).toContainText('World assets unavailable');
  await page.unroute('**/world/honeyville/market.svg');await page.getByRole('button',{name:'Retry world'}).click();await ready(page);await expect(page.getByRole('alert')).toHaveCount(0);
});
test('unbound sessions remain informational with no invented market outcome',async({page})=>{await fixtures(page,{status:'not-bound'});await page.goto(path());await ready(page);await expect(page.getByRole('status').filter({hasText:'no world projection'})).toBeVisible();await market(page);await expect(page.getByText(/No released market result is available/)).toBeVisible();await expect(page.getByText('73.125',{exact:true})).toHaveCount(0);});
test('session and platform authorization prevent rendering unauthorized worlds',async({page})=>{await fixtures(page,{denied:true});await page.goto(path());await expect(page.getByRole('heading',{name:'Session access unavailable'})).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0);});
test('anonymous direct entry returns to sign-in without loading a game',async({page})=>{await fixtures(page,{anonymous:true});await page.goto(path());await expect(page.getByRole('heading',{name:'Student and instructor sign in'})).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0);});
test('instructor-only accounts cannot enter the student world route',async({page})=>{await fixtures(page,{role:'Instructor'});await page.goto(path());await expect(page.getByRole('heading',{name:'This workspace is unavailable to your account'})).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0);});
test('an initially paused session cannot move or inspect before the renderer has loaded',async({page})=>{
  await fixtures(page,{sessionStatus:'Paused'});await page.goto(path());await ready(page);await expect(page.getByText('Your instructor has paused the session.',{exact:false})).toBeVisible();
  const before=await position(page);await move(page,'w',400);expect(await position(page)).toEqual(before);await expect(page.getByRole('button',{name:/Inspect facility/})).toBeDisabled();
});
test('server access revocation destroys the world and clears contextual information',async({page})=>{
  const server=await fixtures(page);await page.goto(path());await ready(page);await expect(page.getByText('Session linked',{exact:true})).toBeVisible();server.revoke();
  await expect(page.getByRole('heading',{name:'Session access unavailable'})).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Market board'})).toHaveCount(0);
});
test('bootstrap failure exposes a retry path without inventing a world snapshot',async({page})=>{
  await fixtures(page);await page.route('**/world/bootstrap',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({protocolVersion:1,status:'projection-unavailable',snapshot:null})}));
  await page.goto(path());await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:'Try again'})).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0);
});
test('responsive layout and accessible on-screen controls work in a narrow viewport',async({page})=>{await page.setViewportSize({width:390,height:1100});await fixtures(page);await page.goto(path());await ready(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.getByText('On-screen movement controls',{exact:true}).click();const button=page.getByRole('button',{name:'Move north'});await button.scrollIntoViewIfNeeded();const box=(await button.boundingBox())!;const before=await position(page);await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(350);await page.mouse.up();await page.waitForTimeout(150);expect((await position(page)).y).toBeLessThan(before.y-20);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/honeyville-mobile.png',fullPage:true});});

test('renders thirty bees in one Phaser scene and records browser frame timing',async({page})=>{
  const server=await fixtures(page,{peers:29});await page.goto(path());await ready(page);await expect(viewport(page)).toHaveAttribute('data-remote-count','29');await expect(page.getByText('30 bees connected')).toBeVisible();
  let step=0;const animation=setInterval(()=>server.animatePeers(++step),100);
  const metrics=await page.evaluate(async()=>{const frames:number[]=[];let previous=performance.now();const start=previous;await new Promise<void>(resolve=>{function frame(now:number){frames.push(now-previous);previous=now;if(now-start<5000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});frames.sort((a,b)=>a-b);return {frames:frames.length,fps:1000/(frames.reduce((a,b)=>a+b,0)/frames.length),p95ms:frames[Math.floor(frames.length*.95)],heapBytes:(performance as Performance&{memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize,userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency};});
  clearInterval(animation);const measured={...metrics,simulatedEventBatches:step,simulatedActorEvents:step*29,simulatedIntervalMs:100};console.log('Honeyville 30-bee simulated rendering',JSON.stringify(measured));await fs.promises.mkdir('docs/bee-world-batch-3b',{recursive:true});await fs.promises.writeFile('docs/bee-world-batch-3b/rendering-metrics.json',JSON.stringify(measured,null,2));await page.screenshot({path:'docs/bee-world-batch-3b/thirty-bees.png',fullPage:true});
  server.removePeer();await expect(viewport(page)).toHaveAttribute('data-remote-count','28');
  await page.getByRole('link',{name:'Return to session'}).click();await expect(page.locator('canvas')).toHaveCount(0);
});
test('a secondary tab observes the existing actor and cannot move it',async({page})=>{await fixtures(page,{peers:1,observer:true});await page.goto(path());await ready(page);await expect(page.getByText(/Observing; another tab/)).toBeVisible();const before=await position(page);await move(page,'d',400);expect(await position(page)).toEqual(before);await expect(viewport(page)).toHaveAttribute('data-remote-count','1');});
test('world transport reconnects and recovers one authoritative roster',async({page})=>{const server=await fixtures(page,{peers:2});await page.goto(path());await ready(page);await expect(viewport(page)).toHaveAttribute('data-remote-count','2');server.disconnectWorld();await expect.poll(()=>server.requests.filter(r=>r.method==='CONNECT').length).toBeGreaterThanOrEqual(2);await expect(page.getByText('3 bees connected')).toBeVisible();await expect(viewport(page)).toHaveAttribute('data-remote-count','2');await expect(page.locator('canvas')).toHaveCount(1);});
test('records a one-bee rendering baseline',async({page})=>{
  await fixtures(page);await page.goto(path());await ready(page);await expect(page.getByText('1 bee connected')).toBeVisible();
  const metrics=await page.evaluate(async()=>{const frames:number[]=[];let previous=performance.now();const start=previous;await new Promise<void>(resolve=>{function frame(now:number){frames.push(now-previous);previous=now;if(now-start<5000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});frames.sort((a,b)=>a-b);return {frames:frames.length,fps:1000/(frames.reduce((a,b)=>a+b,0)/frames.length),p95ms:frames[Math.floor(frames.length*.95)],heapBytes:(performance as Performance&{memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize};});
  await fs.promises.mkdir('docs/bee-world-batch-3b',{recursive:true});await fs.promises.writeFile('docs/bee-world-batch-3b/baseline-metrics.json',JSON.stringify(metrics,null,2));console.log('Honeyville one-bee simulated baseline',JSON.stringify(metrics));
});
