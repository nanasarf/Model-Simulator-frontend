/** Transport contracts transcribed from the adjacent backend; see docs/frontend-architecture.md. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type PlatformRole = 'PlatformAdministrator' | 'Instructor' | 'Student';
export interface SimulationModelDescriptor { identifier: string; version: string; name: string }
export interface IdResult { id: string }
export interface NameRequest { name: string }
export interface NamedCourseRequest { code: string; name: string }
export interface UserRequest { userId: string }
