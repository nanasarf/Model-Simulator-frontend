import { test,expect,type BrowserContext } from '@playwright/test';

const STUDENT='11111111-1111-1111-1111-111111111111',INSTRUCTOR='99999999-9999-9999-9999-999999999999';
const SESSION='22222222-2222-2222-2222-222222222222',CLASSROOM='33333333-3333-3333-3333-333333333333',TEAM='44444444-4444-4444-4444-444444444444',PARTICIPANT='55555555-5555-5555-5555-555555555555';

test('classroom members enter a session, choose a role, and receive an instructor reassignment',async({browser,baseURL})=>{
  // Real React/SignalR-client browser acceptance against deterministic HTTP/WebSocket fixtures.
  // This is not a live-backend compatibility test.
  let entered=false,teamId:string|null=null,roleCode:string|null=null,ready=false,version=1;
  const calls:{path:string;method:string;body:Record<string,unknown>|null}[]=[];
  const sockets:{send:(message:string)=>void}[]=[];
  const roles=[{code:'BUYER',name:'Buyer',minimumParticipants:0,maximumParticipants:1,capabilities:[]},{code:'SELLER',name:'Seller',minimumParticipants:0,maximumParticipants:1,capabilities:[]}];
  const assignments=()=>roleCode?[{assignmentId:'66666666-6666-6666-6666-666666666666',participantId:PARTICIPANT,teamId:TEAM,userId:STUDENT,roleCode,effectiveCapabilities:[]}]:[];
  const lobby=()=>({sessionId:SESSION,status:'Draft',phase:'Briefing',isOpen:true,isReadOnly:false,version,classroomId:CLASSROOM,classroomName:'Economics 101',scenarioTitle:'Supply and demand',modelIdentifier:'Economics.CompetitiveMarket',modelVersion:'1.0.0',canJoin:!entered,canChangeSelection:entered,participationStatus:entered?'Active':'None',participation:entered?{participantId:PARTICIPANT,teamId,roleCode,isReady:ready}:null,roleTemplate:roles.map(r=>({code:r.code,name:r.name,minimum:0,maximum:1})),teams:[{teamId:TEAM,name:'Team A',capacity:2,memberCount:teamId?1:0,isFull:false,isMine:!!teamId,members:teamId?[{memberId:STUDENT,displayName:'Alice',roleCode}]:[],roles:roles.map(r=>({code:r.code,name:r.name,maximum:1,taken:roleCode===r.code?1:0,available:roleCode===r.code?0:1}))}]});
  const notify=()=>{version++;for(const socket of sockets)socket.send(JSON.stringify({type:1,target:'SessionStateChanged',arguments:[{messageId:String(version),payload:{sessionId:SESSION}}]})+'\u001e');};
  async function fixtures(context:BrowserContext,instructor:boolean){
    const userId=instructor?INSTRUCTOR:STUDENT,platformRole=instructor?'Instructor':'Student';
    const claims={sub:userId,'http://schemas.microsoft.com/ws/2008/06/identity/claims/role':platformRole};
    const tokens={accessToken:'header.'+Buffer.from(JSON.stringify(claims)).toString('base64')+'.signature',refreshToken:'fixture-only',accessTokenExpiresAt:new Date(Date.now()+3600000).toISOString()};
    await context.addInitScript(value=>sessionStorage.setItem('simulation.auth.v1',JSON.stringify(value)),tokens);
    await context.route('**/api/v1/**',async route=>{
      const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method(),body=request.postDataJSON() as Record<string,unknown>|null;calls.push({path,method,body});
      const respond=(value:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
      if(path.endsWith('/auth/refresh'))return respond(tokens);
      if(path.endsWith('/auth/me'))return respond({id:userId,email:instructor?'professor@example.test':'alice@example.test',platformRoles:[platformRole]});
      if(path.endsWith('/workspace'))return respond({title:'market.lab_required',errorCode:'market.lab_required'},422);
      if(path.endsWith('/me/classrooms'))return respond([{classroomId:CLASSROOM,name:'Economics 101',enrolledAt:new Date().toISOString()}]);
      if(path.endsWith('/me/sessions'))return respond([]);
      if(path===`/api/v1/classrooms/${CLASSROOM}`)return respond({classroomId:CLASSROOM,name:'Economics 101',courseId:'course-1',courseCode:'ECON101',courseName:'Economics'});
      if(path.endsWith('/roster'))return respond([{participantUserId:STUDENT,email:'alice@example.test',userName:'Alice',enrolledAt:new Date().toISOString()}]);
      if(path.endsWith('/join-code'))return respond({classroomId:CLASSROOM,joinCode:'CLASS123',active:true});
      if(path.endsWith('/join-requests'))return respond([]);
      if(path===`/api/v1/classrooms/${CLASSROOM}/sessions`)return respond([{sessionId:SESSION,classroomId:CLASSROOM,classroomName:'Economics 101',scenarioTitle:'Supply and demand',status:'Draft',phase:'Briefing',currentRound:1,isOpen:true,isReadOnly:false,canJoin:!entered,participationStatus:entered?'Active':'None',teamId,teamName:teamId?'Team A':null,roleCode,isReady:ready}]);
      if(path==='/api/v1/sessions')return respond({items:[{sessionId:SESSION,classroomId:CLASSROOM,classroomName:'Economics 101',scenarioTitle:'Supply and demand',status:'Draft',currentRound:1,currentPhase:'Briefing'}],page:1,pageSize:25,totalCount:1});
      if(path.endsWith('/join')){entered=true;notify();return respond(lobby());}
      if(path.endsWith('/participants/me/team')){teamId=String(body!.teamId);roleCode=null;ready=false;notify();return respond(lobby());}
      if(path.endsWith('/participants/me/role')){roleCode=String(body!.roleCode);ready=false;notify();return respond(lobby());}
      if(path.endsWith('/role-assignments')){roleCode=String(body!.roleCode);notify();return respond({id:'66666666-6666-6666-6666-666666666666'},201);}
      if(path.endsWith('/participants/me/readiness')){ready=!!body!.ready;notify();return route.fulfill({status:204});}
      if(path.endsWith('/lobby'))return respond(lobby());
      if(path.endsWith('/setup'))return respond({session:{id:SESSION,status:'Draft',currentRound:1,currentPhase:'Briefing',version,isOpen:true},classroom:{id:CLASSROOM,name:'Economics 101'},scenario:{id:'scenario-1',title:'Supply and demand',publishedVersion:1},model:{identifier:'Economics.CompetitiveMarket',version:'1.0.0'},teams:[{teamId:TEAM,name:'Team A',members:teamId?[STUDENT]:[]}],participants:entered?[{participantId:PARTICIPANT,userId:STUDENT,displayName:'Alice',teamId,isReady:ready}]:[],availableRoles:roles,roleAssignments:assignments(),readiness:{isReady:!!teamId&&!!roleCode&&ready,blockers:[]}});
      if(path.endsWith('/state'))return respond({sessionId:SESSION,status:'Draft',phase:'Briefing',roundNumber:1,teamId,modelIdentifier:'Economics.CompetitiveMarket',modelVersion:'1.0.0',roleAssignments:assignments(),availableActions:[],currentRoundSubmissions:[],visibleState:null,version,participants:entered?[{userId:STUDENT,teamId,isReady:ready,roles:roleCode?[roleCode]:[]}]:[]});
      if(path.endsWith('/history'))return respond([]);
      return respond({title:'not_found'},404);
    });
    await context.route('**/hubs/sessions/negotiate*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({negotiateVersion:1,connectionId:userId,connectionToken:userId,availableTransports:[{transport:'WebSockets',transferFormats:['Text']}]})}));
    await context.routeWebSocket('**/hubs/sessions*',socket=>{sockets.push(socket);socket.onClose(()=>{const index=sockets.indexOf(socket);if(index>=0)sockets.splice(index,1);});socket.onMessage(message=>{for(const part of String(message).split('\u001e').filter(Boolean)){const value=JSON.parse(part);if(value.protocol)socket.send('{}\u001e');else if(value.invocationId)socket.send(JSON.stringify({type:3,invocationId:value.invocationId})+'\u001e');}});});
  }
  const instructor=await browser.newContext({baseURL,viewport:{width:1440,height:1000}}),student=await browser.newContext({baseURL,viewport:{width:1280,height:900}});
  try{
    await fixtures(instructor,true);await fixtures(student,false);const professor=await instructor.newPage(),learner=await student.newPage();const errors:string[]=[];professor.on('pageerror',error=>errors.push(error.message));learner.on('pageerror',error=>errors.push(error.message));
    await professor.goto(`/instructor/classrooms/${CLASSROOM}`);await expect(professor.getByRole('heading',{name:'Economics 101',exact:true})).toBeVisible();await expect(professor.getByRole('heading',{name:'Supply and demand'})).toBeVisible();
    await learner.goto(`/student/classrooms/${CLASSROOM}`);await learner.getByRole('button',{name:'Join session'}).click();await expect(learner.getByRole('heading',{name:'Choose your team and role'})).toBeVisible();
    await learner.getByRole('combobox',{name:'Your team',exact:true}).selectOption(TEAM);await expect(learner.getByRole('combobox',{name:'Your role',exact:true})).toBeEnabled();await learner.getByRole('combobox',{name:'Your role',exact:true}).selectOption('BUYER');await expect(learner.getByRole('combobox',{name:'Your role',exact:true})).toHaveValue('BUYER');
    await professor.locator(`a[href="/instructor/sessions/${SESSION}/setup#roles"]`).click();await expect(professor.getByLabel('Simulation role for Alice')).toBeEnabled();await professor.getByLabel('Simulation role for Alice').selectOption('SELLER');
    await expect(learner.getByRole('combobox',{name:'Your role',exact:true})).toHaveValue('SELLER');await expect(professor.getByLabel('Simulation role for Alice')).toHaveValue('SELLER');
    expect(calls.find(c=>c.path.endsWith('/role-assignments'))?.body).toEqual({teamId:TEAM,userId:STUDENT,roleCode:'SELLER'});expect(calls.filter(c=>c.method==='PUT'&&c.path.endsWith('/participants/me/role'))).toHaveLength(1);expect(calls.some(c=>c.path.includes('session-join-requests')||c.path.includes('session-joins'))).toBe(false);expect(errors).toEqual([]);
    await professor.screenshot({path:'test-results/classroom-instructor-roles.png',fullPage:true});await learner.screenshot({path:'test-results/classroom-student-roles.png',fullPage:true});
  }finally{await instructor.close();await student.close();}
});
