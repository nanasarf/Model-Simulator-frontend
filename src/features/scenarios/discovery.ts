import type { ApiClient } from '../../lib/api/client';
import type { AuthoringModelSummary, PublishedScenarioVersionSummary, ScenarioLibraryPage, ScenarioTemplateSummary, SimulationDefinitionSummary } from '../../types/discovery';
import type { AuthoringCatalog, BlueprintValidationReport, ScenarioBlueprint } from '../../types/authoring';
export interface ScenarioListParams { status?: 'Draft'|'Published'|'Archived'; modelIdentifier?: string; search?: string; includeArchived?: boolean; page?: number; pageSize?: number }
function query(params: object) { const value = Object.entries(params).filter(([,x]) => x !== undefined && x !== '').map(([k,x]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(x))}`); return value.length ? `?${value.join('&')}` : ''; }
export function scenarioDiscovery(api: ApiClient) { return {
  models: (signal?: AbortSignal) => api.json<AuthoringModelSummary[]>('/api/v1/simulation-definitions/models', { anonymous: true, signal }),
  definitions: (signal?: AbortSignal) => api.json<SimulationDefinitionSummary[]>('/api/v1/simulation-definitions', { signal }),
  scenarios: (params: ScenarioListParams = {}, signal?: AbortSignal) => api.json<ScenarioLibraryPage>(`/api/v1/scenarios${query(params)}`, { signal }),
  versions: (scenarioId: string, signal?: AbortSignal) => api.json<PublishedScenarioVersionSummary[]>(`/api/v1/scenarios/${encodeURIComponent(scenarioId)}/versions`, { signal }),
  definitionVersions: (definitionId: string, signal?: AbortSignal) => api.json<PublishedScenarioVersionSummary[]>(`/api/v1/simulation-definitions/${encodeURIComponent(definitionId)}/scenario-versions`, { signal }),
  version: (versionId: string, signal?: AbortSignal) => api.json<PublishedScenarioVersionSummary>(`/api/v1/scenario-versions/${encodeURIComponent(versionId)}`, { signal }),
  templates: (modelIdentifier?: string, signal?: AbortSignal) => api.json<ScenarioTemplateSummary[]>(`/api/v1/scenario-templates${query({ modelIdentifier })}`, { signal }),
  authoringCatalog: (modelIdentifier: string, modelVersion: string, signal?: AbortSignal) => api.json<AuthoringCatalog>(`/api/v1/simulation-models/${encodeURIComponent(modelIdentifier)}/${encodeURIComponent(modelVersion)}/authoring-catalog`, { signal }),
  validateBlueprint: (blueprint: ScenarioBlueprint) => api.json<BlueprintValidationReport>('/api/v1/scenario-blueprints/validate', { method: 'POST', body: blueprint }),
  createProposal: (blueprint: ScenarioBlueprint) => api.json<{ id: string; status: string; version: number; currentRevisionNumber: number }>('/api/v1/scenario-proposals', { method: 'POST', body: blueprint }),
  updateProposal: (id: string, expectedVersion: number, blueprint: ScenarioBlueprint) => api.json<{ id: string; status: string; version: number; currentRevisionNumber: number }>(`/api/v1/scenario-proposals/${encodeURIComponent(id)}`, { method: 'PUT', body: { expectedVersion, blueprint, revisionSource: 'ProfessorEdit' } }),
  proposal: (id: string, signal?: AbortSignal) => api.json<{ id: string; status: string; version: number; currentRevisionNumber: number; blueprint: ScenarioBlueprint }>(`/api/v1/scenario-proposals/${encodeURIComponent(id)}`, { signal }),
  validateProposal: (id: string) => api.json<BlueprintValidationReport>(`/api/v1/scenario-proposals/${encodeURIComponent(id)}/validate`, { method: 'POST', body: {} }),
  approveProposal: (id: string, expectedVersion: number, idempotencyKey: string) => api.json<{ id: string; status: string; version: number; linkedDraftId: string; modelIdentifier?: string }>(`/api/v1/scenario-proposals/${encodeURIComponent(id)}/approve`, { method: 'POST', body: { expectedVersion }, idempotencyKey }),
}; }
