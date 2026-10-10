import {ApiProblem} from '../../lib/errors/problem';
import {useState} from 'react';import {Link,useParams} from 'react-router-dom';import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';import {useAuth,useRuntime} from '../../app/runtime';import {courseService} from '../courses/service';import {keys} from '../../lib/api/query';import {ErrorState,EmptyState,LoadingState} from '../../components/states';import type {ClassroomSummary} from '../../types/classrooms';
export function ClassroomListPage(){const{api}=useRuntime();const{user}=useAuth();const[page,setPage]=useState(1);const q=useQuery({queryKey:keys.classrooms(user!.id,page,25),queryFn:({signal})=>courseService(api).classrooms(page,25,signal)});if(q.isPending)return <LoadingState label="Loading classrooms"/>;if(q.isError)return <ErrorState error={q.error} retry={()=>void q.refetch()}/>;return <><header className="page-heading"><h1>Classrooms</h1><p>Your teaching classrooms.</p></header>{q.data.items.length===0?<EmptyState title="No classrooms"><p>Create a classroom to get started.</p></EmptyState>:<div className="card-grid">{q.data.items.map(c=><ClassroomCard key={c.classroomId} classroom={c}/>)}</div>}<Pagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.totalCount} onPage={setPage}/></>}
function ClassroomCard({classroom:c}:{classroom:ClassroomSummary}){return <article className="card"><p>{c.courseCode}</p><h2>{c.name}</h2><p>{c.courseName}</p><Link to={`/instructor/classrooms/${c.classroomId}`}>Open classroom</Link></article>}
export function ClassroomDetailPage() {
  const { api } = useRuntime(); const { user } = useAuth(); const id = useParams().classroomId ?? '';
  const qc = useQueryClient(); const s = courseService(api);
  const classroom = useQuery({ queryKey: keys.classroom(user!.id,id), queryFn: ({signal}) => s.classroom(id,signal), retry:false });
  const roster = useQuery({ queryKey: keys.roster(user!.id,id), queryFn: ({signal}) => s.roster(id,signal), enabled:!!classroom.data });
  const requests = useQuery({ queryKey: keys.classroomJoinRequests(user!.id,id), queryFn: ({signal}) => s.joinRequests(id,signal), enabled:!!classroom.data });
  const decide = useMutation({ mutationFn: ({requestId,approve}:{requestId:string;approve:boolean}) => approve?s.approveJoin(id,requestId):s.rejectJoin(id,requestId), onSuccess:async() => { await Promise.all([qc.invalidateQueries({queryKey:keys.classroomJoinRequests(user!.id,id),exact:true}),qc.invalidateQueries({queryKey:keys.roster(user!.id,id),exact:true})]); } });
  if(classroom.isPending) return <LoadingState label="Loading classroom"/>;
  if(classroom.isError) return <ErrorState error={classroom.error} retry={() => void classroom.refetch()}/>;
  return <><header className="page-heading"><h1>{classroom.data.name}</h1><p>{classroom.data.courseName} · {classroom.data.courseCode}</p></header>
    <ClassroomCodeCard classroomId={id}/>
    <section><h2>Pending join requests</h2>{requests.isPending?<LoadingState label="Loading requests"/>:requests.isError?<ErrorState error={requests.error} retry={()=>void requests.refetch()}/>:requests.data.length===0?<p className="muted">No students are waiting to join.</p>:<div className="card-grid">{requests.data.map(r=><article className="card" key={r.id}><h3>Student request</h3><p>Requested {new Date(r.requestedAt).toLocaleString()}</p><button aria-label="Approve classroom request" disabled={decide.isPending} onClick={()=>decide.mutate({requestId:r.id,approve:true})}>Approve</button><button className="secondary" aria-label="Reject classroom request" disabled={decide.isPending} onClick={()=>decide.mutate({requestId:r.id,approve:false})}>Reject</button></article>)}</div>}{decide.error && <ErrorState error={decide.error}/>}</section>
    <section><h2>Class members</h2>{roster.isPending?<LoadingState label="Loading members"/>:roster.isError?<ErrorState error={roster.error}/>:roster.data.length===0?<p className="muted">No approved members yet.</p>:<div className="card-grid">{roster.data.map(x=><article className="card" key={x.participantUserId}><h3>{x.userName||x.email||'Member'}</h3><p>{x.email}</p></article>)}</div>}</section><Link className="button-link" to="/instructor/scenarios">Choose a published scenario</Link></>;
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
