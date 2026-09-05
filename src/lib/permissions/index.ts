import type { CurrentUser } from '../../types/auth';
import type { PlatformRole } from '../../types/platform';
export const hasPlatformRole = (user: CurrentUser | null, role: PlatformRole) => user?.roles.includes(role) ?? false;
export const isInstructor = (user: CurrentUser | null) => hasPlatformRole(user, 'Instructor') || hasPlatformRole(user, 'PlatformAdministrator');
export const hasCapability = (capabilities: readonly string[] | null, capability: string) => capabilities?.includes(capability) ?? false;
/** Availability only. Unknown capability context fails closed; backend enforces every request. */
export function canPerform(user: CurrentUser | null, requirement: { platformRole?: PlatformRole; capability?: string }, capabilities: readonly string[] | null = null) {
  return !!user && (!requirement.platformRole || hasPlatformRole(user, requirement.platformRole)) && (!requirement.capability || hasCapability(capabilities, requirement.capability));
}
