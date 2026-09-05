import type { JsonValue } from './platform';
export interface RoleManifest { code: string; name: string; minimumParticipants: number; maximumParticipants: number; capabilities: string[] }
export interface ActionManifest { code: string; requiredCapability: string; availablePhases: string[] }
export interface RuleManifest { id: string; priority: number; effect: string; condition: JsonValue }
export interface ScenarioManifest { modelIdentifier: string; modelVersion: string; configurationVersion: number; modelConfiguration: JsonValue; phases: string[]; allowedTransitions: Record<string, string[]>; roles: RoleManifest[]; actions: ActionManifest[]; rules: RuleManifest[]; readinessRequiredPhases: string[] | null; maximumRounds: number | null; presentation: JsonValue }
export interface PublishScenarioRequest { name: string; manifest: ScenarioManifest }
export interface ScenarioDraftDocument { id: string; simulationDefinitionId: string; name: string; status: string; content: JsonValue; version: number; createdAt: string; updatedAt: string }
export interface VersionRequest { expectedVersion: number }
export interface PreviewRequest { seed: number }
export interface AuthoringIssue { code: string; message: string }
export interface ValidationReport { canPublish: boolean; blockers: AuthoringIssue[]; warnings: AuthoringIssue[] }
