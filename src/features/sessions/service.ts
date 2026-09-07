import type { ApiClient } from '../../lib/api/client';
import type { SessionRecoveryView, HistoryItem, ReadinessRequest, AdvancePhaseRequest, SubmitActionRequest, ExecuteRoundRequest } from '../../types/sessions';
/** Student recovery never imports or requests model instructor consoles. */
export function studentSessionService(api: ApiClient) {
  return {
    state: (id: string, signal?: AbortSignal) => api.json<SessionRecoveryView>(`/api/v1/sessions/${encodeURIComponent(id)}/state`, { signal }),
    history: (id: string, signal?: AbortSignal) => api.json<HistoryItem[]>(`/api/v1/sessions/${encodeURIComponent(id)}/history`, { signal }),
    participantReadiness: (id: string, body: ReadinessRequest) => api.json<void>(`/api/v1/sessions/${encodeURIComponent(id)}/participants/me/readiness`, { method: 'PUT', body }),
    roundReadiness: (id: string, body: ReadinessRequest) => api.json<void>(`/api/v1/sessions/${encodeURIComponent(id)}/rounds/current/readiness`, { method: 'PUT', body }),
    submitAction: (id: string, body: SubmitActionRequest, idempotencyKey: string) => api.json<{ id: string }>(`/api/v1/sessions/${encodeURIComponent(id)}/actions`, { method: 'POST', body, idempotencyKey }),
    command: (id: string, command: 'start' | 'pause' | 'resume') => api.json<void>(`/api/v1/sessions/${encodeURIComponent(id)}/commands/${command}`, { method: 'POST' }),
    advancePhase: (id: string, body: AdvancePhaseRequest) => api.json<void>(`/api/v1/sessions/${encodeURIComponent(id)}/commands/advance-phase`, { method: 'POST', body }),
    executeRound: (id: string, body: ExecuteRoundRequest) => api.json<unknown>(`/api/v1/sessions/${encodeURIComponent(id)}/rounds/current/execute`, { method: 'POST', body }),
  };
}
export const sessionService = studentSessionService;
