import type { MacroVisibleState } from '../../types/projections';
export function MacroWorkspace({ projection }: { projection: MacroVisibleState | null }) {
  return <section className="card gameplay-placeholder"><p className="eyebrow">Short-Run Macroeconomics</p><h2>Decisions with a wider impact.</h2><p>The classroom gameplay experience is coming in the next milestone.</p><p className="muted">{projection ? 'Your authorized projection is available.' : 'Waiting for an available projection.'}</p></section>;
}
export const macroUI = { modelId: 'Economics.ShortRunMacro', modelVersion: '1.0.0', Workspace: MacroWorkspace } as const;
