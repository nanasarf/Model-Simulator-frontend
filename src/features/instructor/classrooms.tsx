import {ApiProblem} from '../../lib/errors/problem';
import { ClassroomSessions } from './classroom-sessions';
import {useRef,useState} from 'react';import {Link,useNavigate,useParams} from 'react-router-dom';import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';import {useAuth,useRuntime} from '../../app/runtime';import {courseService} from '../courses/service';import {keys} from '../../lib/api/query';import {ErrorState,EmptyState,LoadingState} from '../../components/states';import type {ClassroomSummary} from '../../types/classrooms';
export function ClassroomListPage(){
  const{api}=useRuntime();const{user}=useAuth();const[page,setPage]=useState(1);const[creating,setCreating]=useState(false);
  const q=useQuery({queryKey:keys.classrooms(user!.id,page,25),queryFn:({signal})=>courseService(api).classrooms(page,25,signal)});
  return <><header className="page-heading"><h1>Classrooms</h1><p>Your teaching classrooms.</p>{!creating&&<button type="button" aria-expanded={false} aria-controls="create-classroom" onClick={()=>setCreating(true)}>Create classroom</button>}</header>
    {creating&&<CreateClassroomForm classrooms={q.data?.items??[]} onCancel={()=>setCreating(false)}/>}
    {q.isPending?<LoadingState label="Loading classrooms"/>:q.isError?<ErrorState error={q.error} retry={()=>void q.refetch()}/>:<>{q.data.items.length===0?<EmptyState title="No classrooms"><p>Create a classroom to get started.</p></EmptyState>:<div className="card-grid">{q.data.items.map(c=><ClassroomCard key={c.classroomId} classroom={c}/>)}</div>}<Pagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.totalCount} onPage={setPage}/></>}
  </>;
}
function CreateClassroomForm({classrooms,onCancel}:{classrooms:ClassroomSummary[];onCancel:()=>void}){
  const{api}=useRuntime();const{user}=useAuth();const qc=useQueryClient();const navigate=useNavigate();
  const courses=[...new Map(classrooms.map(c=>[c.courseId,c])).values()];
  const[course,setCourse]=useState(courses[0]?.courseId??'new');const[name,setName]=useState('');
  const[code,setCode]=useState('');const[courseName,setCourseName]=useState('');const createdCourse=useRef<string|null>(null);
  const create=useMutation({mutationFn:async()=>{
    const service=courseService(api);let courseId=course;
    if(course==='new'){
      if(!createdCourse.current)createdCourse.current=(await service.create({code:code.trim(),name:courseName.trim()})).id;
      courseId=createdCourse.current!;
    }
    return service.createClassroom(courseId,{name:name.trim()});
  },onSuccess:result=>{void qc.invalidateQueries({queryKey:['user',user!.id,'classrooms']});navigate(`/instructor/classrooms/${result.id}`);}});
  return <section id="create-classroom" className="card session-form" aria-labelledby="create-classroom-title"><h2 id="create-classroom-title">New classroom</h2>
    <form className="form-grid" onSubmit={event=>{event.preventDefault();if(!create.isPending)create.mutate();}}>
      <div className="form-field"><label htmlFor="classroom-name">Classroom name</label><input id="classroom-name" autoFocus required pattern=".*\S.*" value={name} onChange={event=>setName(event.target.value)} disabled={create.isPending}/></div>
      <div className="form-field"><label htmlFor="classroom-course">Course</label><select id="classroom-course" value={course} onChange={event=>setCourse(event.target.value)} disabled={create.isPending||!!createdCourse.current}>{courses.map(c=><option key={c.courseId} value={c.courseId}>{c.courseCode} · {c.courseName}</option>)}<option value="new">Create a new course</option></select></div>
      {course==='new'&&<><div className="form-field"><label htmlFor="new-course-code">Course code</label><input id="new-course-code" required pattern=".*\S.*" placeholder="ECON101" value={code} onChange={event=>setCode(event.target.value)} disabled={create.isPending||!!createdCourse.current}/></div>
        <div className="form-field"><label htmlFor="new-course-name">Course name</label><input id="new-course-name" required pattern=".*\S.*" placeholder="Introduction to Economics" value={courseName} onChange={event=>setCourseName(event.target.value)} disabled={create.isPending||!!createdCourse.current}/></div></>}
      {create.error&&<ErrorState error={create.error}/>}
      <div className="button-row"><button type="submit" disabled={create.isPending}>{create.isPending?'Creating…':'Create classroom'}</button><button type="button" className="secondary" disabled={create.isPending} onClick={onCancel}>Cancel</button></div>
    </form></section>;
}
const deleteWarning='Delete this classroom? Students will no longer see it, its class code will stop working, and its sessions will become unavailable.';
function useDeleteClassroom(onDeleted?:()=>void){const{api}=useRuntime();const{user}=useAuth();const qc=useQueryClient();return useMutation({mutationFn:(id:string)=>courseService(api).deleteClassroom(id),onSuccess:async(_,id)=>{qc.removeQueries({queryKey:keys.classroom(user!.id,id)});await Promise.all([qc.invalidateQueries({queryKey:['user',user!.id,'classrooms']}),qc.invalidateQueries({queryKey:['user',user!.id,'sessions']})]);onDeleted?.();}});}
function ClassroomCard({classroom:c}:{classroom:ClassroomSummary}){const del=useDeleteClassroom();return <article className="card"><p>{c.courseCode}</p><h2>{c.name}</h2><p>{c.courseName}</p><div className="button-row"><Link to={`/instructor/classrooms/${c.classroomId}`}>Open classroom</Link><button type="button" className="secondary" disabled={del.isPending} onClick={()=>{if(window.confirm(deleteWarning))del.mutate(c.classroomId);}}>{del.isPending?'Deleting…':'Delete classroom'}</button></div>{del.error&&<ErrorState error={del.error}/>}</article>}
export function ClassroomDetailPage() {
  const { api } = useRuntime(); const { user } = useAuth(); const id = useParams().classroomId ?? '';
  const qc = useQueryClient(); const s = courseService(api);
  const classroom = useQuery({ queryKey: keys.classroom(user!.id,id), queryFn: ({signal}) => s.classroom(id,signal), retry:false });
  const roster = useQuery({ queryKey: keys.roster(user!.id,id), queryFn: ({signal}) => s.roster(id,signal), enabled:!!classroom.data });
  const requests = useQuery({ queryKey: keys.classroomJoinRequests(user!.id,id), queryFn: ({signal}) => s.joinRequests(id,signal), enabled:!!classroom.data });
  const decide = useMutation({ mutationFn: ({requestId,approve}:{requestId:string;approve:boolean}) => approve?s.approveJoin(id,requestId):s.rejectJoin(id,requestId), onSuccess:async() => { await Promise.all([qc.invalidateQueries({queryKey:keys.classroomJoinRequests(user!.id,id),exact:true}),qc.invalidateQueries({queryKey:keys.roster(user!.id,id),exact:true})]); } });
  const navigate = useNavigate();
  const del = useDeleteClassroom(() => navigate('/instructor/classrooms', { replace: true }));
  if(classroom.isPending) return <LoadingState label="Loading classroom"/>;
  if(classroom.isError) return <ErrorState error={classroom.error} retry={() => void classroom.refetch()}/>;
  return <><header className="page-heading"><h1>{classroom.data.name}</h1><p>{classroom.data.courseName} · {classroom.data.courseCode}</p></header>
    <div className="button-row"><a className="button-link" href="#classroom-sessions">Assign student roles</a><Link className="button-link secondary" to={`/instructor/scenarios?show=Ready&launchFor=${encodeURIComponent(id)}`}>Add a session</Link></div>
    <ClassroomSessions key={id} classroomId={id}/>
    <ClassroomCodeCard classroomId={id}/>
    <section><h2>Pending join requests</h2>{requests.isPending?<LoadingState label="Loading requests"/>:requests.isError?<ErrorState error={requests.error} retry={()=>void requests.refetch()}/>:requests.data.length===0?<p className="muted">No students are waiting to join.</p>:<div className="card-grid">{requests.data.map(r=><article className="card" key={r.id}><h3>Student request</h3><p>Requested {new Date(r.requestedAt).toLocaleString()}</p><button aria-label="Approve classroom request" disabled={decide.isPending} onClick={()=>decide.mutate({requestId:r.id,approve:true})}>Approve</button><button className="secondary" aria-label="Reject classroom request" disabled={decide.isPending} onClick={()=>decide.mutate({requestId:r.id,approve:false})}>Reject</button></article>)}</div>}{decide.error && <ErrorState error={decide.error}/>}</section>
    <section><h2>Class members</h2><p>Members can enter an open session, then choose a role or receive one from you. Use the session’s role controls above.</p>{roster.isPending?<LoadingState label="Loading members"/>:roster.isError?<ErrorState error={roster.error}/>:roster.data.length===0?<p className="muted">No approved members yet.</p>:<div className="card-grid">{roster.data.map(x=><article className="card" key={x.participantUserId}><h3>{x.userName||x.email||'Member'}</h3><p>{x.email}</p></article>)}</div>}</section>
    <section className="card"><h2>Delete classroom</h2><p>Students will no longer see this classroom. This cannot be undone from the app.</p><button type="button" className="secondary" disabled={del.isPending} onClick={()=>{if(window.confirm(deleteWarning))del.mutate(id);}}>{del.isPending?'Deleting…':'Delete classroom'}</button>{del.error&&<ErrorState error={del.error}/>}</section></>;
}

function ClassroomCodeCard({classroomId}:{classroomId:string}) {
  const {api}=useRuntime(); const {user}=useAuth(); const qc=useQueryClient(); const key=keys.classroomJoinCode(user!.id,classroomId);
  const [copied,setCopied]=useState('');
  const code=useQuery({queryKey:key,queryFn:({signal})=>courseService(api).classroomJoinCode(classroomId,signal),retry:false,refetchOnWindowFocus:false,refetchOnReconnect:false});
  const rotate=useMutation({mutationFn:()=>courseService(api).rotateClassroomJoinCode(classroomId),onSuccess:async value=>{setCopied('');qc.setQueryData(key,value);await qc.invalidateQueries({queryKey:key,exact:true});}});
  const missing=code.error instanceof ApiProblem && code.error.status===404;
  const pending=code.isFetching||rotate.isPending;
  const copy=async()=>{try{await navigator.clipboard.writeText(code.data!.joinCode);setCopied('Class code copied.');}catch{setCopied('Copy failed. Select the code and copy it manually.');}};
  return <section className="card" aria-label="Class code"><p className="eyebrow">Class code</p>
    {code.isPending?<p role="status">Loading class code…</p>:code.isError?<><ErrorState error={code.error}/><button disabled={pending} onClick={()=>void code.refetch()}>Retry</button>{missing&&<button disabled={pending} onClick={()=>rotate.mutate()}>{rotate.isPending?'Generating…':'Generate class code'}</button>}</>:<><strong className="join-code">{code.data.joinCode}</strong><button className="secondary" disabled={pending} onClick={()=>void copy()}>Copy code</button><button className="secondary" disabled={pending} onClick={()=>{if(window.confirm('Rotate the class code? The old code will stop accepting new requests. Existing members remain enrolled.'))rotate.mutate();}}>{rotate.isPending?'Rotating…':'Rotate class code'}</button></>}
    {rotate.error&&<ErrorState error={rotate.error}/>} {copied&&<p role="status">{copied}</p>}
    <p>Students enter this classroom code to request access. You approve every request.</p>
  </section>;
}

export function Pagination({page,pageSize,total,onPage}:{page:number;pageSize:number;total:number;onPage:(p:number)=>void}){const max=Math.max(1,Math.ceil(total/pageSize));return <nav className="button-row" aria-label="Pagination"><button className="secondary" disabled={page<=1} onClick={()=>onPage(page-1)}>Previous</button><span>Page {page} of {max}</span><button className="secondary" disabled={page>=max} onClick={()=>onPage(page+1)}>Next</button></nav>}
