import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth, useRuntime } from '../../app/runtime';
import { courseService } from '../courses/service';
import { ErrorState, LoadingState } from '../../components/states';

export function SessionAdmissionQueue({ sessionId }: { sessionId: string }) {
  const { api } = useRuntime(); const { user } = useAuth(); const qc = useQueryClient(); const key = ['user', user!.id, 'session', sessionId, 'join-requests'];
  const q = useQuery({ queryKey: key, queryFn: ({ signal }) => courseService(api).sessionJoinRequests(sessionId, signal), refetchOnWindowFocus: true, refetchOnReconnect: true });
  const [active, setActive] = useState<string | null>(null); const [message, setMessage] = useState('');
  const decide = useMutation({ mutationFn: ({ id, approve }: { id: string; approve: boolean }) => approve ? courseService(api).approveSessionJoin(sessionId, id) : courseService(api).rejectSessionJoin(sessionId, id), onMutate: ({ id }) => { setActive(id); setMessage(''); }, onSuccess: async () => { await qc.invalidateQueries({ queryKey: key }); await qc.invalidateQueries({ queryKey: ['user', user!.id, 'session', sessionId, 'setup'] }); setMessage('Request updated.'); }, onError: () => { setMessage('This request is no longer pending. The queue was refreshed.'); void qc.invalidateQueries({ queryKey: key }); }, onSettled: () => setActive(null) });
  if (q.isPending) return <section className="card"><h2>Pending Session Requests</h2><LoadingState label="Loading session requests"/></section>;
  if (q.isError) return <section className="card"><h2>Pending Session Requests</h2><ErrorState error={q.error} retry={() => void q.refetch()}/></section>;
  return <section className="card"><h2>Pending Session Requests</h2>{q.data.length===0?<p className="muted">No students are waiting to join this session.</p>:<div className="card-grid">{q.data.map(r=><article className="card" key={r.id}><h3>Student request</h3><p>Requested {new Date(r.requestedAt).toLocaleString()}</p><button aria-label="Approve session request" disabled={!!active} onClick={()=>decide.mutate({id:r.id,approve:true})}>{active===r.id&&decide.isPending?'Approving…':'Approve'}</button><button className="secondary" aria-label="Reject session request" disabled={!!active} onClick={()=>decide.mutate({id:r.id,approve:false})}>{active===r.id&&decide.isPending?'Rejecting…':'Reject'}</button></article>)}</div>}{message&&<p role="status">{message}</p>}</section>;
}
