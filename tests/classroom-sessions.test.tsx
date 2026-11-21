import { expect,it,vi } from 'vitest';
import { render,screen } from '@testing-library/react';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { ClassroomSessions } from '../src/features/instructor/classroom-sessions';
import { StudentClassroomPage } from '../src/features/student/home';
import { RuntimeProvider } from '../src/app/runtime';
import { ApiClient } from '../src/lib/api/client';
import { AuthSession } from '../src/lib/auth/session';
import { createQueryClient } from '../src/lib/api/query';
import { json,sessionId,sessionTransport,tokens,vault } from './helpers';

it('scopes instructor sessions to their classroom and links role assignment and scenario selection',async()=>{
  const calls:string[]=[];const transport=vi.fn<typeof fetch>(async input=>{const path=String(input);calls.push(path);if(path.endsWith('/auth/login'))return json(tokens('Instructor'));if(path.startsWith('/api/v1/sessions?'))return json({items:[{sessionId,scenarioTitle:'Supply and demand',status:'Draft',currentRound:1,currentPhase:'Briefing'}],totalCount:1,page:1,pageSize:25});throw Error(path);});
  const api=new ApiClient('',undefined,sessionTransport(transport)),auth=new AuthSession(api,vault()),queries=createQueryClient();await auth.login({email:'instructor@example.test',password:'fixture-only'});
  const view=render(<RuntimeProvider runtime={{api,auth,queries}}><MemoryRouter><ClassroomSessions classroomId="class-1"/></MemoryRouter></RuntimeProvider>);await screen.findByText('Supply and demand');expect(calls.some(p=>p.includes('classroomId=class-1'))).toBe(true);expect(screen.getByRole('link',{name:'Assign student roles'})).toHaveAttribute('href',`/instructor/sessions/${sessionId}/setup#roles`);expect(screen.getByRole('link',{name:'Add a session'})).toHaveAttribute('href','/instructor/scenarios?show=Ready&launchFor=class-1');view.unmount();queries.clear();
});
it('requires classroom membership before querying student sessions',async()=>{
  const calls:string[]=[];const transport=vi.fn<typeof fetch>(async input=>{const path=String(input);calls.push(path);if(path.endsWith('/auth/login'))return json(tokens('Student'));if(path.endsWith('/me/classrooms'))return json([]);throw Error(path);});
  const api=new ApiClient('',undefined,sessionTransport(transport)),auth=new AuthSession(api,vault()),queries=createQueryClient();await auth.login({email:'student@example.test',password:'fixture-only'});
  const view=render(<RuntimeProvider runtime={{api,auth,queries}}><MemoryRouter initialEntries={['/student/classrooms/foreign']}><Routes><Route path="/student/classrooms/:classroomId" element={<StudentClassroomPage/>}/></Routes></MemoryRouter></RuntimeProvider>);await screen.findByText('Classroom unavailable');expect(calls.some(p=>p.includes('/classrooms/foreign/sessions'))).toBe(false);view.unmount();queries.clear();
});
