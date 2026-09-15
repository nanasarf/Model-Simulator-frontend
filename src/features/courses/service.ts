import type { ApiClient } from '../../lib/api/client';
import type { IdResult, NamedCourseRequest, NameRequest, UserRequest } from '../../types/platform';
import type { ClassroomDetail, ClassroomPage, ClassroomRosterEntry, SessionPage, SessionSetup, StudentSessionSummary } from '../../types/classrooms';
/** Provisioning boundary only. No discovery endpoints are implemented by the backend. */
export const courseService = (api: ApiClient) => ({
  create: (body: NamedCourseRequest) => api.json<IdResult>('/api/v1/courses', { method: 'POST', body }),
  createClassroom: (courseId: string, body: NameRequest) => api.json<IdResult>(`/api/v1/courses/${encodeURIComponent(courseId)}/classrooms`, { method: 'POST', body }),
  enroll: (classroomId: string, body: UserRequest) => api.json<void>(`/api/v1/classrooms/${encodeURIComponent(classroomId)}/enrollments`, { method: 'POST', body }),
  classrooms: (page = 1, pageSize = 25, signal?: AbortSignal) => api.json<ClassroomPage>(`/api/v1/classrooms?page=${page}&pageSize=${pageSize}`, { signal }),
  classroom: (id: string, signal?: AbortSignal) => api.json<ClassroomDetail>(`/api/v1/classrooms/${encodeURIComponent(id)}`, { signal }),
  roster: (id: string, signal?: AbortSignal) => api.json<ClassroomRosterEntry[]>(`/api/v1/classrooms/${encodeURIComponent(id)}/roster`, { signal }),
  sessions: (params: { page?: number; pageSize?: number; classroomId?: string; status?: string; modelIdentifier?: string } = {}, signal?: AbortSignal) => { const q = new URLSearchParams({ page: String(params.page ?? 1), pageSize: String(params.pageSize ?? 25) }); if (params.classroomId) q.set('classroomId', params.classroomId); if (params.status) q.set('status', params.status); if (params.modelIdentifier) q.set('modelIdentifier', params.modelIdentifier); return api.json<SessionPage>(`/api/v1/sessions?${q}`, { signal }); },
  mySessions: (signal?: AbortSignal) => api.json<StudentSessionSummary[]>('/api/v1/me/sessions', { signal }),
  setup: (id: string, signal?: AbortSignal) => api.json<SessionSetup>(`/api/v1/sessions/${encodeURIComponent(id)}/setup`, { signal }),
  createSession: (classroomId: string, body: { scenarioVersionId: string; seed: number }, idempotencyKey?: string) => api.json<IdResult>(`/api/v1/classrooms/${encodeURIComponent(classroomId)}/sessions`, { method: 'POST', body, idempotencyKey }),
  createTeam: (sessionId: string, name: string) => api.json<IdResult>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/teams`, { method: 'POST', body: { name } }),
  addMember: (sessionId: string, teamId: string, userId: string) => api.json<void>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/teams/${encodeURIComponent(teamId)}/members`, { method: 'POST', body: { userId } }),
  assignRole: (sessionId: string, body: { teamId: string; userId: string; roleCode: string }) => api.json<IdResult>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/role-assignments`, { method: 'POST', body }),
  renameTeam: (sessionId: string, teamId: string, body: { name: string; expectedVersion: number }, idempotencyKey?: string) => api.json<void>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/teams/${encodeURIComponent(teamId)}/rename`, { method: 'POST', body, idempotencyKey }),
  deleteTeam: (sessionId: string, teamId: string, expectedVersion: number, idempotencyKey?: string) => api.json<void>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/teams/${encodeURIComponent(teamId)}/delete`, { method: 'POST', body: { expectedVersion }, idempotencyKey }),
  removeMember: (sessionId: string, teamId: string, userId: string, expectedVersion: number, idempotencyKey?: string) => api.json<void>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}/remove`, { method: 'POST', body: { expectedVersion }, idempotencyKey }),
  moveMember: (sessionId: string, userId: string, targetTeamId: string, expectedVersion: number, idempotencyKey?: string) => api.json<void>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/participants/${encodeURIComponent(userId)}/move`, { method: 'POST', body: { targetTeamId, expectedVersion }, idempotencyKey }),
  unassignRole: (sessionId: string, assignmentId: string, expectedVersion: number, idempotencyKey?: string) => api.json<void>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/role-assignments/${encodeURIComponent(assignmentId)}/unassign`, { method: 'POST', body: { expectedVersion }, idempotencyKey }),
  startSession: (sessionId: string) => api.json<void>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/commands/start`, { method: 'POST' }),
  joinCode: (sessionId: string, signal?: AbortSignal) => api.json<{ sessionId: string; joinCode: string; active: boolean }>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/join-code`, { signal }),
  joinSession: (code: string) => api.json<{ sessionId: string; participantId: string; teamId: string | null; joinCode: string }>('/api/v1/session-joins', { method: 'POST', body: { code } }),
});
