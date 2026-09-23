import { ApiProblem } from './problem';
export function problemCode(error: unknown): string | undefined { return error instanceof ApiProblem ? error.errorCode?.toLowerCase() : undefined; }
export function admissionMessage(error: unknown, kind: 'classroom'|'session'|'instructor' = 'session'): string {
  const code = problemCode(error) ?? '';
  if (code.includes('membership') || code.includes('classroom_required')) return 'Join this class before requesting access to the session.';
  if (code.includes('not_accepting') || code.includes('join_not_allowed')) return `This ${kind} is not accepting new requests.`;
  if (code.includes('join_code') || code.includes('invalid_code') || code.includes('code_invalid') || code.includes('not_found')) return `This ${kind} code is invalid or no longer active.`;
  if (code.includes('already') || code.includes('resolved') || code.includes('duplicate')) return 'This request has already been handled.';
  return 'We could not complete that request. Please try again.';
}
export const getClassroomAdmissionMessage = (error: unknown) => admissionMessage(error, 'classroom');
export const getSessionAdmissionMessage = (error: unknown) => admissionMessage(error, 'session');
