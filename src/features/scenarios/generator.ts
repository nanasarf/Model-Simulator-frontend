import type { AuthoringCatalog, ScenarioAiGenerationResult, ScenarioBlueprint } from '../../types/authoring';
import type { ApiClient } from '../../lib/api/client';

export interface ScenarioPlan {
  title: string;
  summary: string;
  learningGoal: string;
  recommendedRounds: number;
  selectedRoleCodes: string[];
  selectedActionCodes: string[];
  selectedShockType?: string;
  shockSeverity?: string;
  focusVariables: string[];
  rubricFocus?: string[];
}

export interface ScenarioGenerationInput {
  professorPrompt: string;
  modelIdentifier: string;
  modelVersion: string;
  authoringCatalog: AuthoringCatalog;
}

export interface ScenarioBlueprintGenerator {
  generate(input: ScenarioGenerationInput, onProgress?: (message: string) => void): Promise<ScenarioBlueprint>;
}

export class BackendScenarioBlueprintGenerator implements ScenarioBlueprintGenerator {
  constructor(private readonly api: ApiClient) {}

  async generateProposal(input: ScenarioGenerationInput, onProgress?: (message: string) => void) {
    onProgress?.('Sending your learning goal to the secure scenario authoring service.');
    const result = await this.api.json<ScenarioAiGenerationResult>('/api/v1/ai/scenarios/generate', {
      method: 'POST',
      body: {
        professorPrompt: input.professorPrompt,
        modelIdentifier: input.modelIdentifier,
        modelVersion: input.modelVersion,
      },
    });
    if (result.blueprint.modelIdentifier !== input.modelIdentifier || result.blueprint.modelVersion !== input.modelVersion) {
      throw new Error('The AI service returned a proposal for a different simulation model or version.');
    }
    onProgress?.('Scenario proposal received. Review each section before approval.');
    return { ...result, validation: result.structuralValidation };
  }

  async generate(input: ScenarioGenerationInput, onProgress?: (message: string) => void) {
    return (await this.generateProposal(input, onProgress)).blueprint;
  }
}

export function compactCatalog(catalog: AuthoringCatalog) {
  return JSON.stringify({
    roles: catalog.roles,
    capabilities: catalog.capabilities,
    actions: catalog.actions,
    phases: catalog.phases,
    stateVariables: catalog.stateVariables,
    indicators: catalog.indicators,
    shockTypes: catalog.shockTypes,
    ruleOperators: catalog.ruleOperators ?? [],
    effectDirections: catalog.effectDirections ?? [],
    intensities: catalog.intensities ?? [],
    assessmentDimensions: catalog.assessmentDimensions ?? [],
  });
}

export function buildPlanPrompt(input: ScenarioGenerationInput) {
  return `Return only a compact JSON object for a ScenarioPlan.\n` +
    `Model identifier: ${input.modelIdentifier}. Model version: ${input.modelVersion}.\n` +
    `Choose only from the catalog codes below. Do not invent new codes.\n` +
    `${compactCatalog(input.authoringCatalog)}\n` +
    `Required keys: title, summary, learningGoal, recommendedRounds, selectedRoleCodes, selectedActionCodes, selectedShockType, shockSeverity, focusVariables, rubricFocus.\n` +
    `Only output a JSON object. No prose, markdown fences, or explanations.\n` +
    `Example shape: {"title":"Supply Curve Shifts","summary":"...","learningGoal":"...","recommendedRounds":4,"selectedRoleCodes":["BUSINESS"],"selectedActionCodes":["INCREASE_OUTPUT"],"selectedShockType":"SUPPLY_DISRUPTION","shockSeverity":"MODERATE","focusVariables":["output","price"],"rubricFocus":["output","price"]}\n` +
    `Professor goal: ${input.professorPrompt}`;
}

export function parseScenarioPlan(raw: string): ScenarioPlan {
  const source = String(raw ?? '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');

  if (start < 0 || end <= start) throw new Error('Local model did not return a JSON plan.');

  const candidate = source.slice(start, end + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (error) {
    throw new Error('Local model returned malformed JSON for the scenario plan.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('ScenarioPlan must be a JSON object.');
  }

  const plan = parsed as Partial<ScenarioPlan>;
  const required = ['title', 'summary', 'learningGoal', 'recommendedRounds', 'selectedRoleCodes', 'selectedActionCodes', 'focusVariables'];
  for (const key of required) {
    if (!(key in plan)) throw new Error(`ScenarioPlan missing required field: ${key}`);
  }

  const validated: ScenarioPlan = {
    title: String(plan.title ?? '').trim(),
    summary: String(plan.summary ?? '').trim(),
    learningGoal: String(plan.learningGoal ?? '').trim(),
    recommendedRounds: Number(plan.recommendedRounds ?? 0),
    selectedRoleCodes: Array.isArray(plan.selectedRoleCodes) ? plan.selectedRoleCodes.map(String) : [],
    selectedActionCodes: Array.isArray(plan.selectedActionCodes) ? plan.selectedActionCodes.map(String) : [],
    selectedShockType: plan.selectedShockType ? String(plan.selectedShockType) : undefined,
    shockSeverity: plan.shockSeverity ? String(plan.shockSeverity) : undefined,
    focusVariables: Array.isArray(plan.focusVariables) ? plan.focusVariables.map(String) : [],
    rubricFocus: Array.isArray(plan.rubricFocus) ? plan.rubricFocus.map(String) : undefined,
  };

  if (!validated.title || !validated.summary || !validated.learningGoal) {
    throw new Error('ScenarioPlan must include title, summary, and learningGoal.');
  }

  if (!Number.isFinite(validated.recommendedRounds) || validated.recommendedRounds < 1) {
    throw new Error('ScenarioPlan recommendedRounds must be a positive number.');
  }

  if (!Array.isArray(validated.selectedRoleCodes) || validated.selectedRoleCodes.length === 0 || !Array.isArray(validated.selectedActionCodes) || validated.selectedActionCodes.length === 0 || !Array.isArray(validated.focusVariables) || validated.focusVariables.length === 0) {
    throw new Error('ScenarioPlan must contain at least one role, one action, and one focus variable.');
  }

  return validated;
}

export function buildScenarioBlueprint(
  plan: ScenarioPlan,
  catalog: AuthoringCatalog,
  modelIdentifier: string,
  modelVersion: string,
): ScenarioBlueprint {
  const validRoles = new Set(catalog.roles);
  const validActions = new Set(catalog.actions);
  const validShockTypes = new Set(catalog.shockTypes);
  const validIntensities = new Set(catalog.intensities ?? ['LOW', 'MODERATE', 'HIGH']);
  const validVariables = new Set(catalog.stateVariables);

  const unsupportedRoles = plan.selectedRoleCodes.filter(code => !validRoles.has(code));
  if (unsupportedRoles.length > 0) throw new Error(`Unsupported selected role codes: ${unsupportedRoles.join(', ')}`);

  const unsupportedActions = plan.selectedActionCodes.filter(code => !validActions.has(code));
  if (unsupportedActions.length > 0) throw new Error(`Unsupported selected action codes: ${unsupportedActions.join(', ')}`);

  if (plan.selectedShockType && !validShockTypes.has(plan.selectedShockType)) {
    throw new Error(`Unsupported selected shock type: ${plan.selectedShockType}`);
  }

  const severity = plan.shockSeverity && validIntensities.has(plan.shockSeverity) ? plan.shockSeverity : 'MODERATE';
  const focusVariables = plan.focusVariables.filter(code => validVariables.has(code) || code.length > 0);
  const rubricFocus = (plan.rubricFocus ?? (catalog.assessmentDimensions ?? [])).filter(Boolean);

  const roleDefinitions = plan.selectedRoleCodes.map((code, index) => ({
    code,
    displayName: code.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()),
    description: `${code} contributes to the scenario by making decisions within the learning goal.`,
    responsibilities: [plan.learningGoal, `Round ${index + 1} decision-making`],
    decisionCodes: plan.selectedActionCodes,
    visibleIndicatorCodes: focusVariables,
    minimumParticipants: 1,
    maximumParticipants: 10,
  }));

  const decisionDefinitions = plan.selectedActionCodes.map((code, index) => ({
    code,
    displayName: code.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()),
    description: `This decision supports ${plan.learningGoal}.`,
    allowedRoleCodes: plan.selectedRoleCodes,
    requiredCapabilityCode: catalog.capabilities[index % Math.max(catalog.capabilities.length, 1)] ?? 'PRODUCTION',
    availablePhases: catalog.phases.slice(0, Math.min(catalog.phases.length, 3)),
    intensityOptions: Array.from(validIntensities).slice(0, 3),
  }));

  const shockType = plan.selectedShockType ?? catalog.shockTypes[0] ?? 'SUPPLY_DISRUPTION';
  const rules = [
    {
      id: 'shock-impact-rule',
      name: 'Shock effect',
      description: `A ${shockType} shock affects ${focusVariables.join(', ')} across the scenario.`,
      trigger: 'Shock phase',
      conditions: { selectedShockType: shockType, severity },
      effects: { variables: focusVariables, intensity: severity },
      explanation: plan.learningGoal,
      learningObjectiveCodes: ['learning-goal'],
    },
    {
      id: 'decision-action-rule',
      name: 'Decision consequence',
      description: `${plan.selectedActionCodes.join(', ')} changes the selected variables and shapes the student response.`,
      trigger: 'Decision phase',
      conditions: { roles: plan.selectedRoleCodes, actions: plan.selectedActionCodes },
      effects: { variables: focusVariables, actionCodes: plan.selectedActionCodes },
      explanation: plan.summary,
      learningObjectiveCodes: ['learning-goal'],
    },
  ];

  const rubricDimensions = (rubricFocus.length > 0 ? rubricFocus : (catalog.assessmentDimensions ?? ['OUTPUT', 'PRICE'])).map((code, index) => ({
    code,
    description: `${code} is a key assessment dimension for this scenario.`,
    maximumScore: 5,
  }));

  return {
    schemaVersion: '1.0',
    title: plan.title,
    summary: plan.summary,
    studentBriefing: `Students analyze how ${focusVariables.join(' and ')} respond to ${shockType.toLowerCase()} conditions over ${plan.recommendedRounds} rounds.`,
    simulationType: modelIdentifier.includes('Competitive') ? 'CompetitiveMarket' : 'ShortRunMacro',
    modelIdentifier,
    modelVersion,
    recommendedRounds: plan.recommendedRounds,
    learningObjectives: [{
      code: 'learning-goal',
      description: plan.learningGoal,
    }],
    roles: roleDefinitions,
    decisions: decisionDefinitions,
    rules,
    startingWorld: {
      context: plan.summary,
      selectedShockType: shockType,
      shockSeverity: severity,
      focusVariables,
      baseline: Object.fromEntries(focusVariables.map(variable => [variable, 0])),
    },
    shockPool: [{
      code: shockType,
      title: shockType.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()),
      studentFacingDescription: `A ${severity.toLowerCase()} ${shockType.replace(/_/g, ' ').toLowerCase()} shifts the scenario's focus variables.`,
      instructorExplanation: plan.learningGoal,
      type: shockType,
      severity,
      effects: { variables: focusVariables, intensity: severity },
      suggestedRound: 2,
      learningObjectiveCodes: ['learning-goal'],
    }],
    assessmentRubric: {
      version: '1.0',
      dimensions: rubricDimensions,
    },
    instructorNotes: `Built from compact plan: ${plan.summary}`,
  };
}
