import type { ApiClient } from '../../lib/api/client';
import type { SessionRecoveryView, HistoryItem } from '../../types/sessions';
/** Student recovery never imports or requests model instructor consoles. */
export function studentSessionService(api: ApiClient) {
  return {
    state: (id: string, signal?: AbortSignal) => api.json<SessionRecoveryView>(`/api/v1/sessions/${encodeURIComponent(id)}/state`, { signal }),
    history: (id: string, signal?: AbortSignal) => api.json<HistoryItem[]>(`/api/v1/sessions/${encodeURIComponent(id)}/history`, { signal }),
  };
}
export const sessionService = studentSessionService;
