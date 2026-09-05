import type { ApiClient } from '../../lib/api/client';
import { logicalOperation, type LogicalOperation } from '../../lib/idempotency';
import { saveVersioned } from '../../lib/api/concurrency';
import type { MacroDraft, MacroScenarioContent, MacroTemplate } from '../../types/short-run-macro';
import type { CompetitiveMarketDraft, CompetitiveMarketScenarioContent, CompetitiveMarketTemplate } from '../../types/competitive-market';
import type { ValidationReport } from '../../types/scenarios';
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
  };
}
export const macroAuthoring = (api: ApiClient) => authoring<MacroScenarioContent, MacroDraft, MacroTemplate>(api, 'macro');
export const marketAuthoring = (api: ApiClient) => authoring<CompetitiveMarketScenarioContent, CompetitiveMarketDraft, CompetitiveMarketTemplate>(api, 'competitive-market');
