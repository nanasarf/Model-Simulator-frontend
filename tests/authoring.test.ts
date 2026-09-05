import { expect, it, vi } from 'vitest';
import { ApiClient } from '../src/lib/api/client';
import { macroAuthoring } from '../src/features/scenarios/service';
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
