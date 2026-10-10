import {expect,it,vi} from 'vitest';
import {render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {ApiClient} from '../src/lib/api/client';
import {AuthSession} from '../src/lib/auth/session';
import {RuntimeProvider} from '../src/app/runtime';
import {createQueryClient} from '../src/lib/api/query';
import {ClassroomDetailPage} from '../src/features/instructor/classrooms';
import {StudentHome} from '../src/features/student/home';
import {json,tokens,vault} from './helpers';

async function instructor(failure:number|null=null){
 let failed=!!failure,exists=failure!==404;const calls:string[]=[];
 const transport=vi.fn<typeof fetch>(async(input,init)=>{const path=String(input);calls.push(path);
  if(path.endsWith('/auth/login'))return json(tokens('Instructor'));
  if(path.endsWith('/join-code/rotate')){failed=false;exists=true;return json({classroomId:'class-1',joinCode:'LIVE1234',active:true});}
  if(path.endsWith('/join-code'))return failed?json({title:failure===404?'classroom.join_code_missing':'Temporary failure',detail:failure===404?'Generate a class code to accept student requests.':'Please retry.',traceId:'trace-admission'},failure!):json({classroomId:'class-1',joinCode:'LIVE1234',active:true});
  if(path.endsWith('/roster')||path.endsWith('/join-requests'))return json([]);
  return json({classroomId:'class-1',name:'251',courseCode:'203',courseName:'Microeconomics'});
 });
 const api=new ApiClient('',undefined,transport),auth=new AuthSession(api,vault()),queries=createQueryClient();await auth.login({email:'instructor@example.test',password:'test-fixture'});
 render(<RuntimeProvider runtime={{api,auth,queries}}><MemoryRouter initialEntries={['/instructor/classrooms/class-1']}><Routes><Route path='/instructor/classrooms/:classroomId' element={<ClassroomDetailPage/>}/></Routes></MemoryRouter></RuntimeProvider>);
 return{calls,transport,queries,recover:()=>{failed=false;exists=true;},exists:()=>exists};
}
it('loads the canonical code and provides copy/rotate controls',async()=>{const s=await instructor();expect(await screen.findByText('LIVE1234')).toBeVisible();expect(screen.getByRole('button',{name:'Copy code'})).toBeEnabled();expect(screen.getByRole('button',{name:'Rotate class code'})).toBeEnabled();expect(s.calls.filter(x=>x.endsWith('/join-code'))).toEqual(['/api/v1/classrooms/class-1/join-code']);s.queries.clear();});
it('shows missing-code ProblemDetails and generates through the existing rotate operation',async()=>{const s=await instructor(404);expect(await screen.findByRole('alert')).toHaveTextContent('Generate a class code');expect(screen.getByText('trace-admission')).toBeVisible();await userEvent.click(screen.getByRole('button',{name:'Generate class code'}));expect(await screen.findByText('LIVE1234')).toBeVisible();expect(s.calls.filter(x=>x.endsWith('/join-code/rotate'))).toHaveLength(1);s.queries.clear();});
it('does not automatically retry permanent failures and Retry issues one canonical GET',async()=>{const s=await instructor(404);await screen.findByRole('alert');window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('online'));await new Promise(r=>setTimeout(r,100));expect(s.calls.filter(x=>x.endsWith('/join-code'))).toHaveLength(1);s.recover();await userEvent.click(screen.getByRole('button',{name:'Retry'}));expect(await screen.findByText('LIVE1234')).toBeVisible();expect(s.calls.filter(x=>x.endsWith('/join-code'))).toHaveLength(2);s.queries.clear();});
it('preserves temporary error details and recovers after Retry',async()=>{const s=await instructor(500);expect(await screen.findByRole('alert')).toHaveTextContent('Please retry');expect(screen.queryByRole('button',{name:'Generate class code'})).toBeNull();s.recover();await userEvent.click(screen.getByRole('button',{name:'Retry'}));expect(await screen.findByText('LIVE1234')).toBeVisible();s.queries.clear();});

async function student(options:{member?:boolean;pending?:boolean;rejected?:boolean;sessionFailure?:boolean}={}){
 let requests=options.pending||options.rejected?[{requestId:'request-1',classroomId:'class-1',classroomName:'251',status:options.pending?'Pending':'Rejected',requestedAt:'2026-10-10T00:00:00Z'}]:[];
 let sessionRequests:object[]=[];const calls:{path:string;body:unknown}[]=[];
 const transport=vi.fn<typeof fetch>(async(input,init)=>{const path=String(input);calls.push({path,body:init?.body?JSON.parse(String(init.body)):null});
  if(path.endsWith('/auth/login'))return json(tokens('Student'));
  if(path.endsWith('/classroom-join-requests/mine'))return json(requests);
  if(path.endsWith('/session-join-requests/mine'))return json(sessionRequests);
  if(path.endsWith('/me/classrooms'))return json(options.member?[{classroomId:'class-1',name:'251',enrolledAt:'2026-10-10T00:00:00Z'}]:[]);
  if(path.endsWith('/me/sessions'))return json([]);
  if(path.endsWith('/classroom-join-requests')){requests=[{requestId:'new-request',classroomId:'class-1',classroomName:'251',status:'Pending',requestedAt:'2026-10-10T00:00:00Z'}];return json({requestId:'new-request',status:'Pending',classroomId:'class-1'},202);}
  if(path.endsWith('/session-join-requests')){if(options.sessionFailure)return json({title:'session.classroom_membership_required',detail:'Approved classroom membership is required.',traceId:'trace-session'},422);sessionRequests=[{requestId:'session-request',sessionId:'session-1',status:'Pending',requestedAt:'2026-10-10T00:00:00Z'}];return json({requestId:'session-request',status:'Pending',sessionId:'session-1'},202);}
  throw Error('Unexpected admission endpoint '+path);
 });
 const api=new ApiClient('',undefined,transport),auth=new AuthSession(api,vault()),queries=createQueryClient();await auth.login({email:'student@example.test',password:'test-fixture'});
 const view=render(<RuntimeProvider runtime={{api,auth,queries}}><MemoryRouter><StudentHome/></MemoryRouter></RuntimeProvider>);return{calls,queries,view};
}
async function request(kind:'classroom'|'session'){const area=within((await screen.findByRole('heading',{name:kind==='classroom'?'Join a classroom':'Join a live session'})).closest('section')!);await userEvent.type(await area.findByLabelText(kind==='classroom'?'Classroom code':'Session code'),kind==='classroom'?'code1234':'session1');await userEvent.click(area.getByRole('button',{name:'Request to join'}));return area;}
it('submits the correct classroom payload and recovers Pending from server requests',async()=>{const s=await student();const area=await request('classroom');expect(await area.findByText('Waiting for instructor approval.')).toBeVisible();expect(s.calls.find(x=>x.path.endsWith('/classroom-join-requests'))?.body).toEqual({code:'CODE1234'});s.queries.clear();});
it('maps the actual membership-required 422 to classroom approval guidance',async()=>{const s=await student({sessionFailure:true});await request('session');expect(await screen.findByRole('alert')).toHaveTextContent('Join this classroom and wait for instructor approval before requesting access to this session.');expect(screen.getByLabelText('Session code')).toHaveValue('SESSION1');s.queries.clear();});
it('explains the pending classroom prerequisite when session admission is rejected',async()=>{const s=await student({pending:true,sessionFailure:true});await request('session');expect(await screen.findByRole('alert')).toHaveTextContent('Your classroom request is waiting for instructor approval.');s.queries.clear();});
it('recovers authoritative membership without request history and allows session request',async()=>{const s=await student({member:true});expect(await screen.findByText('You are a member of 251.')).toBeVisible();const area=await request('session');expect(await area.findByText('Waiting for instructor approval.')).toBeVisible();s.queries.clear();});
it('membership wins over rejected history',async()=>{const s=await student({member:true,rejected:true});expect(await screen.findByText('You are a member of 251.')).toBeVisible();expect(screen.queryByText(/Your classroom request was not approved/)).toBeNull();s.queries.clear();});
it('allows rejected classroom requests to be retried under the existing backend policy',async()=>{const s=await student({rejected:true});const area=await request('classroom');expect(await area.findByText('Waiting for instructor approval.')).toBeVisible();s.queries.clear();});
it('routes backend Draft sessions to admission setup',async()=>{
 const {InstructorSessionsPage}=await import('../src/features/instructor/sessions');
 const transport=vi.fn<typeof fetch>(async(input)=>String(input).endsWith('/auth/login')?json(tokens('Instructor')):json({items:[{sessionId:'draft-session',scenarioTitle:'Live economics',classroomName:'251',status:'Draft',currentRound:1,currentPhase:'Briefing'}],page:1,pageSize:25,totalCount:1}));
 const api=new ApiClient('',undefined,transport),auth=new AuthSession(api,vault()),queries=createQueryClient();await auth.login({email:'instructor@example.test',password:'test-fixture'});
 render(<RuntimeProvider runtime={{api,auth,queries}}><MemoryRouter><InstructorSessionsPage/></MemoryRouter></RuntimeProvider>);
 expect(await screen.findByRole('link',{name:'Open setup'})).toHaveAttribute('href','/instructor/sessions/draft-session/setup');queries.clear();
});
