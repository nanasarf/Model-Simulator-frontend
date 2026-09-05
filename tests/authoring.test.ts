import { expect, it, vi } from 'vitest';
import { ApiClient } from '../src/lib/api/client';
import { macroAuthoring, marketAuthoring } from '../src/features/scenarios/service';
import type { MacroDraft } from '../src/types/short-run-macro';
import { json } from './helpers';
it('versioned authoring sends expectedVersion in JSON and refetches after stale-write conflict', async () => {
  const resource: MacroDraft = { document: { id: 'draft-id', simulationDefinitionId: 'definition-id', name: 'Original', status: 'Draft', content: null, version: 5, createdAt: '', updatedAt: '' }, content: { briefing: 'Original', learningObjectives: [], discussionPrompts: [], debriefPrompts: [], startingConditions: { outputIndex: 100, potentialOutputIndex: 100, inflation: 2, unemployment: 5, policyRate: 3, debtToOutput: 55 }, maximumQuarters: 4, roles: [], enabledActions: [], allowedIntensities: [], scheduledShocks: [], teamObjectives: { inflationMinimum: 1, inflationMaximum: 3, unemploymentMaximum: 6, outputGapAbsoluteMaximum: 2, debtToOutputMaximum: 80 }, assessmentDimensions: null } };
  const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ title: 'concurrency.conflict' }, 409)).mockResolvedValueOnce(json({ ...resource, document: { ...resource.document, version: 6 } }));
  const result = await macroAuthoring(new ApiClient('', undefined, transport)).save('draft-id', resource, { name: 'Unsaved', content: resource.content });
  expect(JSON.parse(String(transport.mock.calls[0][1]?.body))).toMatchObject({ name: 'Unsaved', expectedVersion: 5 });
  expect(result).toMatchObject({ kind: 'conflict', draft: { name: 'Unsaved' }, authoritative: { document: { version: 6 } } });
  expect(transport.mock.calls[1][1]?.method).toBe('GET'); expect(transport).toHaveBeenCalledTimes(2);
});

it('uses the documented macro lifecycle endpoints and stable clone idempotency key', async () => {
  const transport = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(json({ canPublish: true, blockers: [], warnings: [] }))
    .mockResolvedValueOnce(json({ seed: 7, quarters: [], diagnostics: [] }))
    .mockResolvedValueOnce(json({ document: { id: 'copy-id', version: 1 } }))
    .mockResolvedValueOnce(json({ scenarioVersionId: 'published-id' }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  const service = macroAuthoring(new ApiClient('', undefined, transport));
  await service.validate('draft-id'); await service.preview('draft-id', { seed: 7 });
  const clone = service.prepareClone('draft-id', 'Copy'); await service.clone(clone);
  await service.publish('draft-id', { expectedVersion: 5 }); await service.archive('draft-id', { expectedVersion: 5 });
  expect(transport.mock.calls.map(x => x[0])).toEqual([
    '/api/v1/economics/macro/scenario-authoring/drafts/draft-id/validate',
    '/api/v1/economics/macro/scenario-authoring/drafts/draft-id/preview',
    '/api/v1/economics/macro/scenario-authoring/drafts/draft-id/clone',
    '/api/v1/economics/macro/scenario-authoring/drafts/draft-id/publish',
    '/api/v1/economics/macro/scenario-authoring/drafts/draft-id/archive',
  ]);
  expect(new Headers(transport.mock.calls[2][1]?.headers).get('Idempotency-Key')).toBe(clone.operation.key);
  expect(JSON.parse(String(transport.mock.calls[3][1]?.body))).toEqual({ expectedVersion: 5 });
});

it('keeps CompetitiveMarket authoring on its separate endpoint boundary', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(json([]));
  await marketAuthoring(new ApiClient('', undefined, transport)).templates();
  expect(transport).toHaveBeenCalledWith('/api/v1/economics/competitive-market/scenario-authoring/templates', expect.objectContaining({ method: 'GET' }));
  expect(String(transport.mock.calls[0][0])).not.toContain('/macro/');
});
