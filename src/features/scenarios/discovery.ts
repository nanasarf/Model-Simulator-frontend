import type { ApiClient } from '../../lib/api/client';
import type { AuthoringModelSummary, PublishedScenarioVersionSummary, ScenarioLibraryPage, ScenarioTemplateSummary, SimulationDefinitionSummary } from '../../types/discovery';
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
}; }
