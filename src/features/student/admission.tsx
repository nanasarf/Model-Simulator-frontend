import type { ReactNode } from 'react';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRuntime } from '../../app/runtime';
import { courseService } from '../courses/service';
import { ErrorState } from '../../components/states';

export function AdmissionStatusCard({ title, status, children }: { title: string; status: 'Pending'|'Approved'|'Rejected'|'Error'; children?: ReactNode }) {
  return <section className={`card admission-status ${status.toLowerCase()}`} role="status"><h2>{title}</h2><p>{status}</p>{children}</section>;
}

export function ClassroomJoinCard() { const { api } = useRuntime(); const [code,setCode]=useState(''); const mutation=useMutation({mutationFn:()=>courseService(api).requestClassroomJoin(code.trim()),onSuccess:()=>setCode('')}); return <section className="card"><h2>Join a classroom</h2><p>Use the classroom code shared by your instructor.</p><form className="input-row" onSubmit={e=>{e.preventDefault();if(code.trim())mutation.mutate();}}><label htmlFor="classroom-code">Classroom code</label><input id="classroom-code" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} required/><button disabled={mutation.isPending}>{mutation.isPending?'Sending…':'Request to join'}</button></form>{mutation.data&&<AdmissionStatusCard title="Classroom access" status={mutation.data.status.toLowerCase()==='approved'?'Approved':'Pending'}>{mutation.data.status.toLowerCase()==='approved'?'You are a classroom member.':'Request sent. Waiting for instructor approval.'}</AdmissionStatusCard>}{mutation.error&&<ErrorState error={mutation.error}/>}</section>; }

