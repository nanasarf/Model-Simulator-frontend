import { expect,it,vi } from 'vitest';
import { render,screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { RuntimeProvider } from '../src/app/runtime';
import { ClassroomListPage } from '../src/features/instructor/classrooms';
import { ApiClient } from '../src/lib/api/client';
import { createQueryClient } from '../src/lib/api/query';
import { AuthSession } from '../src/lib/auth/session';
import { json,sessionTransport,tokens,vault } from './helpers';

async function setup({existing=false,failOnce=false}={}){
  const calls:{path:string;method:string;body:unknown}[]=[];
  const transport=vi.fn<typeof fetch>(async(input,init)=>{
    const path=String(input),method=init?.method??'GET';calls.push({path,method,body:init?.body?JSON.parse(String(init.body)):undefined});
    if(path.endsWith('/auth/login'))return json(tokens('Instructor'));
    if(path.startsWith('/api/v1/classrooms?'))return json({items:existing?[{classroomId:'old-room',name:'Section A',courseId:'existing-course',courseCode:'ECON101',courseName:'Economics'}]:[],page:1,pageSize:25,totalCount:existing?1:0});
    if(path==='/api/v1/courses'&&method==='POST')return json({id:'new-course'},201);
    if(path.endsWith('/classrooms')&&method==='POST'){
      if(failOnce){failOnce=false;return json({title:'Temporarily unavailable',detail:'Try creating the classroom again.'},503);}
      return json({id:'new-room'},201);
    }
    throw Error(`Unexpected ${method} ${path}`);
  });
  const api=new ApiClient('',undefined,sessionTransport(transport));const auth=new AuthSession(api,vault());const queries=createQueryClient();
  await auth.login({email:'instructor@example.test',password:'fixture-only'});
  render(<RuntimeProvider runtime={{api,auth,queries}}><MemoryRouter initialEntries={['/instructor/classrooms']}><Routes><Route path="/instructor/classrooms" element={<ClassroomListPage/>}/><Route path="/instructor/classrooms/new-room" element={<h1>Created classroom</h1>}/></Routes></MemoryRouter></RuntimeProvider>);
  await screen.findByText(existing?'Section A':'No classrooms');
  await userEvent.click(screen.getByRole('button',{name:'Create classroom'}));
  await userEvent.type(screen.getByLabelText('Classroom name'),'Section B');
  return {calls,queries};
}
it('creates a first course and classroom from the empty classroom list',async()=>{
  const {calls,queries}=await setup();await userEvent.type(screen.getByLabelText('Course code'),'ECON101');await userEvent.type(screen.getByLabelText('Course name'),'Economics');
  await userEvent.click(screen.getByRole('button',{name:'Create classroom'}));await screen.findByRole('heading',{name:'Created classroom'});
  expect(calls.find(c=>c.path==='/api/v1/courses')?.body).toEqual({code:'ECON101',name:'Economics'});
  expect(calls.find(c=>c.path==='/api/v1/courses/new-course/classrooms')?.body).toEqual({name:'Section B'});queries.clear();
});
it('reuses an existing course without creating another course',async()=>{
  const {calls,queries}=await setup({existing:true});expect(screen.queryByLabelText('Course code')).toBeNull();await userEvent.click(screen.getByRole('button',{name:'Create classroom'}));
  await screen.findByRole('heading',{name:'Created classroom'});expect(calls.some(c=>c.path==='/api/v1/courses')).toBe(false);expect(calls.find(c=>c.path==='/api/v1/courses/existing-course/classrooms')?.body).toEqual({name:'Section B'});queries.clear();
});
it('preserves the created course when classroom creation fails and is retried',async()=>{
  const {calls,queries}=await setup({failOnce:true});await userEvent.type(screen.getByLabelText('Course code'),'ECON101');await userEvent.type(screen.getByLabelText('Course name'),'Economics');
  await userEvent.click(screen.getByRole('button',{name:'Create classroom'}));await screen.findByRole('alert');expect(screen.getByLabelText('Classroom name')).toHaveValue('Section B');
  await userEvent.click(screen.getByRole('button',{name:'Create classroom'}));await screen.findByRole('heading',{name:'Created classroom'});expect(calls.filter(c=>c.path==='/api/v1/courses')).toHaveLength(1);queries.clear();
});
