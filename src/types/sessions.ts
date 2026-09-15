import type { JsonValue } from './platform';
export interface ParticipantView { userId: string; teamId: string | null; isReady: boolean; roles: string[] }
export interface RecoveryRoleAssignment { assignmentId: string; teamId: string; roleCode: string; capabilities: string[] }
export interface RecoveryActionDefinition { code: string; requiredCapability: string; availablePhases: string[]; constraints: JsonValue | null }
export interface RecoverySubmission { submissionId: string; roleAssignmentId: string; actionCode: string; status: string; submittedAt: string | null; payload: JsonValue | null }
export interface SessionRecoveryView {
  sessionId: string; status: string; phase: string; roundNumber: number; modelIdentifier?: string; modelVersion?: string;
  teamId: string | null; roleAssignments?: RecoveryRoleAssignment[]; availableActions?: RecoveryActionDefinition[];
  currentRoundSubmissions?: RecoverySubmission[]; visibleState: JsonValue | null; version: number; participants: ParticipantView[]; roleCodes?: string[];
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
