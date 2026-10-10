import { expect, it, vi } from 'vitest';
import { ApiClient } from '../src/lib/api/client';
import { macroAuthoring, marketAuthoring } from '../src/features/scenarios/service';
import { scenarioDiscovery } from '../src/features/scenarios/discovery';
import type { MacroDraft } from '../src/types/short-run-macro';
import { courseService } from '../src/features/courses/service';
import { json } from './helpers';
import { buildScenarioBlueprint, parseScenarioPlan } from '../src/features/scenarios/generator';
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
  const transport = vi.fn<typeof fetch>().mockImplementation(async () => json([]));
  await marketAuthoring(new ApiClient('', undefined, transport)).templates();
  expect(transport).toHaveBeenCalledWith('/api/v1/economics/competitive-market/scenario-authoring/templates', expect.objectContaining({ method: 'GET' }));
  expect(String(transport.mock.calls[0][0])).not.toContain('/macro/');
});

it('uses authoritative discovery filters and paging instead of client-side pseudo-discovery', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(json({ items: [], page: 2, pageSize: 25, totalCount: 26 }));
  const discovery = scenarioDiscovery(new ApiClient('', undefined, transport));
  await discovery.scenarios({ status: 'Published', modelIdentifier: 'Economics.ShortRunMacro', search: 'oil', page: 2, pageSize: 25 });
  expect(transport).toHaveBeenCalledWith('/api/v1/scenarios?status=Published&modelIdentifier=Economics.ShortRunMacro&search=oil&page=2&pageSize=25', expect.anything());
});

it('discovers definitions, immutable versions, and safe template metadata through centralized services', async () => {
  const transport = vi.fn<typeof fetch>().mockImplementation(async () => json([]));
  const discovery = scenarioDiscovery(new ApiClient('', undefined, transport));
  await discovery.models(); await discovery.definitions(); await discovery.versions('scenario-id'); await discovery.definitionVersions('definition-id'); await discovery.version('version-id'); await discovery.templates('Economics.CompetitiveMarket');
  expect(transport.mock.calls.map(call => call[0])).toEqual([
    '/api/v1/simulation-definitions/models', '/api/v1/simulation-definitions', '/api/v1/scenarios/scenario-id/versions',
    '/api/v1/simulation-definitions/definition-id/scenario-versions', '/api/v1/scenario-versions/version-id',
    '/api/v1/scenario-templates?modelIdentifier=Economics.CompetitiveMarket',
  ]);
});

it('recovers server-persisted section reviews and approves sections with the proposal version', async () => {
  const transport = vi.fn<typeof fetch>().mockImplementation(async (url) => {
    if (String(url).endsWith('/section-reviews')) return json({ approvedSections: ['overview', 'roles'] });
    return json({ id: 'proposal-id', status: 'Draft', version: 7, currentRevisionNumber: 3, approvedSections: ['overview', 'roles'], sections: { overview: 'Approved', roles: 'Approved' }, validationSnapshot: null, semanticWarnings: [], blueprint: {}, modelIdentifier: 'Economics.ShortRunMacro', modelVersion: '1.0.0' });
  });
  const discovery = scenarioDiscovery(new ApiClient('', undefined, transport));

  await expect(discovery.proposal('proposal-id')).resolves.toMatchObject({
    id: 'proposal-id',
    approvedSections: ['overview', 'roles'],
  });
  await discovery.approveProposalSection('proposal-id', 7, 'decisions');

  expect(transport.mock.calls[0][0]).toBe('/api/v1/scenario-proposals/proposal-id');
  expect(transport.mock.calls[1][0]).toBe('/api/v1/scenario-proposals/proposal-id/sections/decisions/approve');
  expect(JSON.parse(String(transport.mock.calls[1][1]?.body))).toEqual({ expectedVersion: 7 });
});

it('uses classroom, setup, and student-session discovery endpoints without local collections', async () => {
  const transport = vi.fn<typeof fetch>().mockImplementation(async (url) => {
    const path = String(url);
    if (path.includes('/classrooms?')) return json({ items: [], page: 1, pageSize: 25, totalCount: 0 });
    if (path.endsWith('/roster')) return json([]);
    if (path.endsWith('/setup')) return json({});
    if (path.includes('/sessions?')) return json({ items: [], page: 1, pageSize: 25, totalCount: 0 });
    return json([]);
  });
  const service = courseService(new ApiClient('', undefined, transport));
  await service.classrooms(); await service.classroom('classroom-id'); await service.roster('classroom-id');
  await service.sessions({ classroomId: 'classroom-id', status: 'Draft', modelIdentifier: 'Economics.ShortRunMacro' }); await service.mySessions(); await service.setup('session-id');
  expect(transport.mock.calls.map(call => call[0])).toEqual([
    '/api/v1/classrooms?page=1&pageSize=25', '/api/v1/classrooms/classroom-id', '/api/v1/classrooms/classroom-id/roster',
    '/api/v1/sessions?page=1&pageSize=25&classroomId=classroom-id&status=Draft&modelIdentifier=Economics.ShortRunMacro', '/api/v1/me/sessions', '/api/v1/sessions/session-id/setup',
  ]);
});

it('parses a valid compact ScenarioPlan JSON object', () => {
  const plan = parseScenarioPlan(JSON.stringify({
    title: 'Supply Curve Shifts',
    summary: 'Students analyze supply-side disruptions.',
    learningGoal: 'Explain how supply shocks move equilibrium output and prices.',
    recommendedRounds: 4,
    selectedRoleCodes: ['BUSINESS'],
    selectedActionCodes: ['INCREASE_OUTPUT', 'DECREASE_OUTPUT'],
    selectedShockType: 'SUPPLY_DISRUPTION',
    shockSeverity: 'MODERATE',
    focusVariables: ['output', 'price'],
    rubricFocus: ['output', 'price'],
  }));

  expect(plan.title).toBe('Supply Curve Shifts');
  expect(plan.recommendedRounds).toBe(4);
  expect(plan.selectedRoleCodes).toEqual(['BUSINESS']);
});

it('rejects malformed or unsupported ScenarioPlan content', () => {
  expect(() => parseScenarioPlan('no json here')).toThrow();
  expect(() => buildScenarioBlueprint({
    title: 'Bad plan',
    summary: 'x',
    learningGoal: 'x',
    recommendedRounds: 2,
    selectedRoleCodes: ['UNKNOWN_ROLE'],
    selectedActionCodes: ['UNKNOWN_ACTION'],
    focusVariables: ['output'],
  }, {
    modelIdentifier: 'Economics.ShortRunMacro',
    modelVersion: '1.0.0',
    roles: ['BUSINESS'],
    capabilities: ['PRODUCTION'],
    actions: ['INCREASE_OUTPUT'],
    phases: ['INITIAL', 'DECISION', 'RESULT'],
    stateVariables: ['output', 'price'],
    shockTypes: ['SUPPLY_DISRUPTION'],
    indicators: ['output'],
    intensities: ['MODERATE'],
    assessmentDimensions: ['OUTPUT'],
  }, 'Economics.ShortRunMacro', '1.0.0')).toThrow();
});

it('builds a deterministic ScenarioBlueprint from a valid ScenarioPlan', () => {
  const plan = {
    title: 'Supply Curve Shifts',
    summary: 'Students analyze a supply disruption.',
    learningGoal: 'Understand supply shocks.',
    recommendedRounds: 4,
    selectedRoleCodes: ['BUSINESS'],
    selectedActionCodes: ['INCREASE_OUTPUT', 'DECREASE_OUTPUT'],
    selectedShockType: 'SUPPLY_DISRUPTION',
    shockSeverity: 'MODERATE',
    focusVariables: ['output', 'price'],
    rubricFocus: ['output', 'price'],
  };

  const blueprint = buildScenarioBlueprint(plan, {
    modelIdentifier: 'Economics.ShortRunMacro',
    modelVersion: '1.0.0',
    roles: ['BUSINESS', 'GOVERNMENT'],
    capabilities: ['PRICING', 'PRODUCTION'],
    actions: ['INCREASE_OUTPUT', 'DECREASE_OUTPUT'],
    phases: ['INITIAL', 'DECISION', 'RESULT'],
    stateVariables: ['output', 'price', 'inflation'],
    shockTypes: ['SUPPLY_DISRUPTION', 'DEMAND_SHOCK'],
    indicators: ['output', 'price'],
    intensities: ['MINOR', 'MODERATE', 'MAJOR'],
    assessmentDimensions: ['OUTPUT', 'PRICE'],
  }, 'Economics.ShortRunMacro', '1.0.0');

  expect(blueprint.modelIdentifier).toBe('Economics.ShortRunMacro');
  expect(blueprint.modelVersion).toBe('1.0.0');
  expect(blueprint.title).toBe('Supply Curve Shifts');
  expect(blueprint.roles[0].code).toBe('BUSINESS');
  expect(blueprint.rules.length).toBeGreaterThan(0);
  expect(blueprint.shockPool[0].type).toBe('SUPPLY_DISRUPTION');
});
