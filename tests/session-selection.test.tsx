import { expect,it,vi } from 'vitest';
import { render,screen,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RuntimeProvider } from '../src/app/runtime';
import { SessionSelection } from '../src/features/student/session-selection';
import { ApiClient } from '../src/lib/api/client';
import { AuthSession } from '../src/lib/auth/session';
import { createQueryClient,keys } from '../src/lib/api/query';
import { json,sessionId,sessionTransport,tokens,vault } from './helpers';
import type { SessionLobbyView } from '../src/types/classrooms';

function initial():SessionLobbyView{return {sessionId,status:'Draft',phase:'Briefing',isOpen:true,isReadOnly:false,version:1,classroomId:'class-1',classroomName:'Economics',scenarioTitle:'Demand and supply',modelIdentifier:'Economics.CompetitiveMarket',modelVersion:'1.0.0',canJoin:false,canChangeSelection:true,participationStatus:'Active',participation:{participantId:'p1',teamId:null,roleCode:null,isReady:false},roleTemplate:[{code:'BUYER',name:'Buyer',minimum:1,maximum:1}],teams:[{teamId:'team-a',name:'Team A',capacity:2,memberCount:0,isFull:false,isMine:false,members:[],roles:[{code:'BUYER',name:'Buyer',maximum:1,taken:0,available:1}]}]};}
async function mount(data=initial(),rejectRole=false){
  let latest=data;const calls:{path:string;method:string;body:unknown}[]=[];
  const transport=vi.fn<typeof fetch>(async(input,init)=>{const path=String(input),method=init?.method??'GET';const body=init?.body?JSON.parse(String(init.body)):undefined;calls.push({path,method,body});
    if(path.endsWith('/auth/login'))return json(tokens('Student'));
    if(path.endsWith('/lobby'))return json(latest);
    if(path.endsWith('/participants/me/team')){latest={...latest,participation:{...latest.participation!,teamId:body.teamId,roleCode:null,isReady:false}};return json(latest);}
    if(path.endsWith('/participants/me/role')){if(rejectRole){latest={...latest,teams:latest.teams.map(t=>({...t,roles:t.roles.map(r=>({...r,taken:1,available:0}))}))};return json({title:'role.capacity_reached',detail:'That role is already taken on your team.'},409);}latest={...latest,participation:{...latest.participation!,roleCode:body.roleCode,isReady:false}};return json(latest);}
    throw Error(`Unexpected ${method} ${path}`);
  });
  const api=new ApiClient('',undefined,sessionTransport(transport)),auth=new AuthSession(api,vault()),queries=createQueryClient();await auth.login({email:'student@example.test',password:'fixture-only'});
  const view=render(<RuntimeProvider runtime={{api,auth,queries}}><SessionSelection sessionId={sessionId}/></RuntimeProvider>);
  await screen.findByLabelText('Your team');return {calls,queries,view,uid:auth.snapshot().user!.id,setLatest:(value:SessionLobbyView)=>{latest=value;}};
}
it('lets a joined student choose a team and then a role using self-service endpoints',async()=>{
  const s=await mount();expect(screen.getByLabelText('Your role')).toBeDisabled();await userEvent.selectOptions(screen.getByLabelText('Your team'),'team-a');await waitFor(()=>expect(screen.getByLabelText('Your role')).toBeEnabled());await userEvent.selectOptions(screen.getByLabelText('Your role'),'BUYER');await waitFor(()=>expect(screen.getByLabelText('Your role')).toHaveValue('BUYER'));
  expect(s.calls.find(c=>c.path.endsWith('/participants/me/team'))?.body).toEqual({teamId:'team-a'});expect(s.calls.find(c=>c.path.endsWith('/participants/me/role'))?.body).toEqual({roleCode:'BUYER'});expect(s.calls.some(c=>c.path.includes('/role-assignments'))).toBe(false);s.view.unmount();s.queries.clear();
});
it('disables full teams and taken roles while retaining the student’s own current role',async()=>{
  const data=initial();data.participation!.teamId='team-a';data.teams[0].roles[0].available=0;data.teams.push({...data.teams[0],teamId:'team-full',name:'Full team',isFull:true});const s=await mount(data);expect(screen.getByRole('option',{name:/Full team/})).toBeDisabled();expect(screen.getByRole('option',{name:'Buyer · Taken'})).toBeDisabled();s.view.unmount();s.queries.clear();
  data.participation!.roleCode='BUYER';const own=await mount(data);expect(screen.getByRole('option',{name:'Buyer · Your role'})).toBeEnabled();own.view.unmount();own.queries.clear();
});
it('locks selection when the server closes configuration after launch',async()=>{
  const data=initial();data.status='Running';data.canChangeSelection=false;const s=await mount(data);expect(screen.getByLabelText('Your team')).toBeDisabled();expect(screen.getByLabelText('Your role')).toBeDisabled();expect(s.calls.every(c=>c.method!=='PUT')).toBe(true);s.view.unmount();s.queries.clear();
});
it('recovers authoritative availability after another student takes a role',async()=>{
  const data=initial();data.participation!.teamId='team-a';const s=await mount(data,true);await userEvent.selectOptions(screen.getByLabelText('Your role'),'BUYER');expect(await screen.findByRole('alert')).toHaveTextContent('That role is already taken');await waitFor(()=>expect(screen.getByRole('option',{name:'Buyer · Taken'})).toBeDisabled());expect(screen.getByLabelText('Your role')).toHaveValue('');s.view.unmount();s.queries.clear();
});
it('shows an instructor-assigned role after authoritative lobby recovery',async()=>{
  const data=initial();data.participation!.teamId='team-a';const s=await mount(data);s.setLatest({...data,participation:{...data.participation!,roleCode:'BUYER'}});await s.queries.invalidateQueries({queryKey:keys.lobby(s.uid,sessionId)});await waitFor(()=>expect(screen.getByLabelText('Your role')).toHaveValue('BUYER'));s.view.unmount();s.queries.clear();
});
