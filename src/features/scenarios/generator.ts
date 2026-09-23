import type { AuthoringCatalog, ScenarioBlueprint } from '../../types/authoring';

export interface ScenarioGenerationInput {
  professorPrompt: string;
  modelIdentifier: string;
  modelVersion: string;
  authoringCatalog: AuthoringCatalog;
}

export interface ScenarioBlueprintGenerator {
  generate(input: ScenarioGenerationInput, onProgress?: (message: string) => void): Promise<ScenarioBlueprint>;
}

export const LOCAL_MODEL = {
  model: 'Xenova/LaMini-Flan-T5-77M',
  revision: 'main',
  task: 'text2text-generation' as const,
  maxNewTokens: 900,
  temperature: 0.2,
};

export function compactCatalog(catalog: AuthoringCatalog) {
  return JSON.stringify({
    roles: catalog.roles, capabilities: catalog.capabilities, actions: catalog.actions,
    phases: catalog.phases, stateVariables: catalog.stateVariables, indicators: catalog.indicators,
    shockTypes: catalog.shockTypes, ruleOperators: catalog.ruleOperators ?? [],
    effectDirections: catalog.effectDirections ?? [], intensities: catalog.intensities ?? [],
    assessmentDimensions: catalog.assessmentDimensions ?? [],
  });
}

export function buildBlueprintPrompt(input: ScenarioGenerationInput) {
  return `Return JSON only. Create an educational ScenarioBlueprint for the professor's goal.\n` +
    `Required schemaVersion: 1.0. ModelIdentifier: ${input.modelIdentifier}. ModelVersion: ${input.modelVersion}.\n` +
    `Use only codes from this catalog; never invent roles, capabilities, actions, phases, state variables, operators, shock types, directions, intensities, or assessment dimensions: ${compactCatalog(input.authoringCatalog)}\n` +
    `Include title, summary, studentBriefing, recommendedRounds, learningObjectives, roles, decisions, rules, startingWorld, shockPool, assessmentRubric, instructorNotes. Support Predict, Experiment, Observe, Explain when compatible with the catalog.\n` +
    `Professor goal: ${input.professorPrompt}`;
}

function parseBlueprint(raw: string): ScenarioBlueprint {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Local model did not return a JSON blueprint.');
  const value = JSON.parse(cleaned.slice(start, end + 1)) as ScenarioBlueprint;
  if (!value || typeof value !== 'object' || typeof value.title !== 'string' || !Array.isArray(value.roles)) throw new Error('Local model returned an invalid blueprint.');
  return value;
}

export class TransformersScenarioBlueprintGenerator implements ScenarioBlueprintGenerator {
  async generate(input: ScenarioGenerationInput, onProgress?: (message: string) => void) {
    onProgress?.('Preparing local AI model. The first run may take a little longer.');
    const runtime = await import('@huggingface/transformers');
    const generator = await runtime.pipeline(LOCAL_MODEL.task, LOCAL_MODEL.model, { revision: LOCAL_MODEL.revision, dtype: 'q8' });
    onProgress?.('Generating a local draft…');
    const output = await generator(buildBlueprintPrompt(input), { max_new_tokens: LOCAL_MODEL.maxNewTokens, temperature: LOCAL_MODEL.temperature, do_sample: false });
    const text = Array.isArray(output) && output[0] && typeof output[0] === 'object' ? String((output[0] as { generated_text?: string }).generated_text ?? '') : String(output);
    const blueprint = parseBlueprint(text);
    if (blueprint.modelIdentifier !== input.modelIdentifier || blueprint.modelVersion !== input.modelVersion) throw new Error('Local model returned a blueprint for a different simulation model or version.');
    return blueprint;
  }
}

export async function detectLocalAiCapability(): Promise<'webgpu' | 'wasm' | 'unavailable'> {
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) return 'webgpu';
  try { await import('@huggingface/transformers'); return 'wasm'; } catch { return 'unavailable'; }
}
