import { macroUI } from '../short-run-macro/adapter';
import { marketUI } from '../competitive-market/adapter';
/** Resolve only with authoritative model identity. Never inspect economic fields to guess a model. */
const registry = new Map<string, typeof macroUI | typeof marketUI>([
  [`${macroUI.modelId}:${macroUI.modelVersion}`, macroUI], [`${marketUI.modelId}:${marketUI.modelVersion}`, marketUI],
]);
export const resolveModelUI = (identifier: string, version: string) => registry.get(`${identifier}:${version}`);
