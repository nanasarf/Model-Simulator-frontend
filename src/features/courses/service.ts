import type { ApiClient } from '../../lib/api/client';
import type { IdResult, NamedCourseRequest, NameRequest, UserRequest } from '../../types/platform';
/** Provisioning boundary only. No discovery endpoints are implemented by the backend. */
export const courseService = (api: ApiClient) => ({
  create: (body: NamedCourseRequest) => api.json<IdResult>('/api/v1/courses', { method: 'POST', body }),
  createClassroom: (courseId: string, body: NameRequest) => api.json<IdResult>(`/api/v1/courses/${encodeURIComponent(courseId)}/classrooms`, { method: 'POST', body }),
  enroll: (classroomId: string, body: UserRequest) => api.json<void>(`/api/v1/classrooms/${encodeURIComponent(classroomId)}/enrollments`, { method: 'POST', body }),
});
