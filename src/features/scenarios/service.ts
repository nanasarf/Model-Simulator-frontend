import type { ApiClient } from '../../lib/api/client';
import { logicalOperation, type LogicalOperation } from '../../lib/idempotency';
import { saveVersioned } from '../../lib/api/concurrency';
import type { MacroDraft, MacroScenarioContent, MacroTemplate } from '../../types/short-run-macro';
import type { CompetitiveMarketDraft, CompetitiveMarketScenarioContent, CompetitiveMarketTemplate } from '../../types/competitive-market';
import type { PreviewRequest, ValidationReport, VersionRequest } from '../../types/scenarios';
export interface CreateDraft<C> { simulationDefinitionId: string; name: string; content: C }
export interface EditDraft<C> { name: string; content: C }
function authoring<C, D extends { document: { version: number } }, T>(api: ApiClient, model: 'macro' | 'competitive-market') {
  const base = `/api/v1/economics/${model}/scenario-authoring`;
  const prefix = model === 'macro' ? 'macro' : 'market';
  const get = (id: string, signal?: AbortSignal) => api.json<D>(`${base}/drafts/${encodeURIComponent(id)}`, { signal });
  return {
    templates: (signal?: AbortSignal) => api.json<T[]>(`${base}/templates`, { signal }),
    get,
    prepareCreate: (body: CreateDraft<C>) => logicalOperation(`${prefix}.draft.create`, body),
    create(operation: LogicalOperation) {
      if (operation.operation !== `${prefix}.draft.create`) throw new Error('Wrong logical operation.');
      return api.json<D>(`${base}/drafts`, { method: 'POST', serializedBody: operation.body, idempotencyKey: operation.key });
    },
    save: (id: string, resource: D, draft: EditDraft<C>) => saveVersioned(resource.document.version, draft,
      (edit, expectedVersion) => api.json<D>(`${base}/drafts/${encodeURIComponent(id)}`, { method: 'PUT', body: { ...edit, expectedVersion } }), () => get(id)),
    validate: (id: string, signal?: AbortSignal) => api.json<ValidationReport>(`${base}/drafts/${encodeURIComponent(id)}/validate`, { method: 'POST', signal }),
    preview: <P>(id: string, request: PreviewRequest, signal?: AbortSignal) => api.json<P>(`${base}/drafts/${encodeURIComponent(id)}/preview`, { method: 'POST', body: request, signal }),
    prepareClone: (id: string, name: string) => ({ id, operation: logicalOperation(`${prefix}.draft.clone`, { name }) }),
    clone(prepared: { id: string; operation: LogicalOperation }) {
      if (prepared.operation.operation !== `${prefix}.draft.clone`) throw new Error('Wrong logical operation.');
      return api.json<D>(`${base}/drafts/${encodeURIComponent(prepared.id)}/clone`, { method: 'POST', serializedBody: prepared.operation.body, idempotencyKey: prepared.operation.key });
    },
    archive: (id: string, request: VersionRequest) => api.json<void>(`${base}/drafts/${encodeURIComponent(id)}/archive`, { method: 'POST', body: request }),
    publish: (id: string, request: VersionRequest) => api.json<{ scenarioVersionId: string }>(`${base}/drafts/${encodeURIComponent(id)}/publish`, { method: 'POST', body: request }),
  };
}
export const macroAuthoring = (api: ApiClient) => authoring<MacroScenarioContent, MacroDraft, MacroTemplate>(api, 'macro');
export const marketAuthoring = (api: ApiClient) => authoring<CompetitiveMarketScenarioContent, CompetitiveMarketDraft, CompetitiveMarketTemplate>(api, 'competitive-market');
