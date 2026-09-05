import type { JsonValue } from './platform';
export interface ParticipantView { userId: string; teamId: string | null; isReady: boolean; roles: string[] }
export interface SessionRecoveryView {
  sessionId: string; status: string; phase: string; roundNumber: number;
  teamId: string | null; roleCodes: string[]; visibleState: JsonValue; version: number;
  participants: ParticipantView[];
}
export interface HistoryItem { sequence: number; roundNumber: number; type: string; occurredAt: string; data: JsonValue }
export interface RoundReadinessView { userId: string; roundNumber: number; phase: string; isReady: boolean; changedAt: string }
export interface SubmissionInspection { id: string; roundNumber: number; teamId: string; userId: string; roleAssignmentId: string; actionCode: string; payload: JsonValue; submittedAt: string; submittedPhase: string }
export interface SnapshotInspection { teamId: string; roundNumber: number; state: JsonValue; createdAt: string }
export interface CreateSessionRequest { scenarioVersionId: string; seed: number }
export interface AssignRoleRequest { teamId: string; userId: string; roleCode: string }
export interface ReadinessRequest { ready: boolean }
export interface AdvancePhaseRequest { targetPhase: string }
export interface SubmitActionRequest { teamId: string; roleAssignmentId: string; actionCode: string; payload: JsonValue }
export interface ExecuteRoundRequest { teamId: string; executionId: string }
