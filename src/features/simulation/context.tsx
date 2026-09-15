import { createContext, useContext, type ReactNode } from 'react';
import type { ParticipantView, SessionRecoveryView } from '../../types/sessions';
export interface SessionContextValue {
  sessionId: string; status: string; phase: string; roundNumber: number; version: number; modelIdentifier: string; modelVersion: string;
  participant: ParticipantView | null; teamId: string | null; roleCodes: readonly string[];
  participantReady: boolean | null; roundReadiness: null; model: null; roleAssignments: NonNullable<SessionRecoveryView['roleAssignments']>; capabilities: readonly string[] | null; availableActions: NonNullable<SessionRecoveryView['availableActions']>; currentRoundSubmissions: NonNullable<SessionRecoveryView['currentRoundSubmissions']>; visibleState: SessionRecoveryView['visibleState'];
}
export function recoverContext(state: SessionRecoveryView, userId: string): SessionContextValue {
  const participant = state.participants.find(p => p.userId === userId) ?? null;
  const assignments = state.roleAssignments?.filter(x => x.teamId === state.teamId) ?? [];
  const capabilities = assignments.length ? Array.from(new Set(assignments.flatMap(x => x.capabilities))) : null;
  return { sessionId: state.sessionId, status: state.status, phase: state.phase, roundNumber: state.roundNumber, version: state.version, modelIdentifier: state.modelIdentifier ?? 'Unknown', modelVersion: state.modelVersion ?? 'Unknown', participant, teamId: state.teamId, roleCodes: assignments.length ? assignments.map(x => x.roleCode) : (state.roleCodes ?? participant?.roles ?? []), participantReady: participant?.isReady ?? null, roundReadiness: null, model: null, roleAssignments: assignments, capabilities, availableActions: state.availableActions ?? [], currentRoundSubmissions: state.currentRoundSubmissions ?? [], visibleState: state.visibleState };
}
const Context = createContext<SessionContextValue | null>(null);
export const SessionProvider = ({ value, children }: { value: SessionContextValue; children: ReactNode }) => <Context.Provider value={value}>{children}</Context.Provider>;
export const useSession = () => { const context = useContext(Context); if (!context) throw new Error('SessionProvider required'); return context; };
