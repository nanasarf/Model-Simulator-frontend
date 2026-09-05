import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
export const isSessionId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function OpenSession() {
  const navigate = useNavigate(); const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const id = String(new FormData(event.currentTarget).get('sessionId')).trim(); if (!isSessionId(id)) { setError('Enter the complete session ID provided by your instructor.'); return; } navigate(`/simulation/${id}`); }
  return <section className="card"><p className="eyebrow">Continue learning</p><h2>Open a session</h2><p>Enter an existing session ID. Your account must already have access.</p><form onSubmit={submit} className="session-form"><label htmlFor="sessionId">Session ID</label><div className="input-row"><input id="sessionId" name="sessionId" required autoComplete="off" placeholder="00000000-0000-0000-0000-000000000000" aria-invalid={!!error} aria-describedby={error ? 'session-error' : undefined}/><button>Open session <span aria-hidden="true">→</span></button></div>{error && <p role="alert" id="session-error">{error}</p>}</form></section>;
}
