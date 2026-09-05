import { createContext, useContext, type ReactNode } from 'react';
import type { ParticipantView, SessionRecoveryView } from '../../types/sessions';
export interface SessionContextValue {
  sessionId: string; status: string; phase: string; roundNumber: number; version: number;
  participant: ParticipantView | null; teamId: string | null; roleCodes: readonly string[];
  participantReady: boolean | null;
  // Explicit unavailable context, not invented transport fields or inferred permissions.
  model: null; capabilities: null; roundReadiness: null; priorSubmissions: null;
}
export function recoverContext(state: SessionRecoveryView, userId: string): SessionContextValue {
  const participant = state.participants.find(p => p.userId === userId) ?? null;
  return { sessionId: state.sessionId, status: state.status, phase: state.phase, roundNumber: state.roundNumber, version: state.version, participant, teamId: state.teamId, roleCodes: state.roleCodes, participantReady: participant?.isReady ?? null, model: null, capabilities: null, roundReadiness: null, priorSubmissions: null };
}
const Context = createContext<SessionContextValue | null>(null);
export const SessionProvider = ({ value, children }: { value: SessionContextValue; children: ReactNode }) => <Context.Provider value={value}>{children}</Context.Provider>;
export const useSession = () => { const context = useContext(Context); if (!context) throw new Error('SessionProvider required'); return context; };
