import type { JsonValue } from './platform';

export interface ClassroomSummary { classroomId: string; name: string; courseId: string; courseCode: string; courseName: string }
export interface ClassroomPage { items: ClassroomSummary[]; page: number; pageSize: number; totalCount: number }
export interface ClassroomRosterEntry { participantUserId: string; email: string | null; userName: string | null; enrolledAt: string }
export interface SessionSummary { sessionId: string; classroomId: string; classroomName: string; scenarioId: string; scenarioTitle: string; publishedScenarioVersion: number; modelIdentifier: string; modelVersion: string; status: string; currentRound: number; currentPhase: string; createdAt: string; startedAt: string | null; completedAt: string | null }
export interface SessionPage { items: SessionSummary[]; page: number; pageSize: number; totalCount: number }
export interface StudentSessionSummary { sessionId: string; classroomId: string; classroomName: string; scenarioTitle: string; modelIdentifier: string; modelVersion: string; status: string; currentRound: number; currentPhase: string; teamId: string | null }
export interface ClassroomDetail extends ClassroomSummary {}
export interface ClassroomJoinRequest { id: string; classroomId: string; studentUserId: string; status: string; requestedAt: string; version: number }
export interface SessionSetup {
  session: { id: string; status: string; currentRound: number; currentPhase: string; version: number };
  classroom: { id: string; name: string };
  scenario: { id: string; title: string; publishedVersion: number };
  model: { identifier: string; version: string };
  teams: Array<{ teamId: string; name: string; members: string[] }>;
  participants: Array<{ participantId: string; userId: string; teamId: string | null; isReady: boolean }>;
  availableRoles: Array<{ code: string; name: string; minimumParticipants: number; maximumParticipants: number; capabilities: string[] }>;
  roleAssignments: Array<{ assignmentId: string; participantId: string; teamId: string; roleCode: string; effectiveCapabilities: string[] }>;
  readiness: { isReady: boolean; blockers: Array<{ code: string; participantId?: string; teamId?: string; [key: string]: JsonValue | undefined }> };
}
