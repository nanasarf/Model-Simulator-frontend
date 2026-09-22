import type { ScenarioSummary } from '../../types/discovery';

export type ScenarioTeachingStatus = 'ready' | 'draft' | 'archived' | 'not-launchable';

export interface ScenarioUiState {
  teachingStatus: ScenarioTeachingStatus;
  badgeLabel: string;
  primaryActionLabel: string;
  primaryHref: string;
  secondaryActionLabel?: string;
  secondaryHref?: string;
  helperLabel?: string;
  hasPublishedVersion: boolean;
  hasUnpublishedDraft: boolean;
}

export function scenarioDraftRoute(scenario: ScenarioSummary) {
  const model = scenario.modelIdentifier.endsWith('ShortRunMacro') ? 'macro' : 'market';
  return `/instructor/scenarios/${model}/${scenario.draftId}`;
}

export function resolveScenarioUiState(scenario: ScenarioSummary): ScenarioUiState {
  const hasPublishedVersion = scenario.publishedVersionId !== null;
  const hasUnpublishedDraft = scenario.lifecycleStatus === 'Draft' && hasPublishedVersion;

  if (scenario.lifecycleStatus === 'Archived') {
    return {
      teachingStatus: 'archived',
      badgeLabel: 'Archived',
      primaryActionLabel: 'View Published Version',
      primaryHref: hasPublishedVersion
        ? `/instructor/scenarios/versions/${scenario.publishedVersionId}`
        : '/instructor/scenarios',
      secondaryActionLabel: scenario.lifecycleStatus === 'Archived' && hasPublishedVersion ? 'Continue Editing' : undefined,
      secondaryHref: hasPublishedVersion ? scenarioDraftRoute(scenario) : undefined,
      helperLabel: hasPublishedVersion ? 'Published version available' : undefined,
      hasPublishedVersion,
      hasUnpublishedDraft,
    };
  }

  if (hasPublishedVersion && scenario.launchable) {
    return {
      teachingStatus: 'ready',
      badgeLabel: 'Ready to use',
      primaryActionLabel: 'Use in Class',
      primaryHref: `/instructor/scenarios/versions/${scenario.publishedVersionId}`,
      secondaryActionLabel: hasUnpublishedDraft ? 'Continue Editing' : 'Version History',
      secondaryHref: hasUnpublishedDraft
        ? scenarioDraftRoute(scenario)
        : `/instructor/scenarios/${scenario.scenarioId}/versions`,
      helperLabel: hasUnpublishedDraft
        ? `Published version ${scenario.publishedVersionNumber ?? ''} available`.trim()
        : scenario.publishedVersionNumber !== null
          ? `Published version ${scenario.publishedVersionNumber} available`
          : 'Published version available',
      hasPublishedVersion,
      hasUnpublishedDraft,
    };
  }

  if (scenario.lifecycleStatus === 'Draft') {
    return {
      teachingStatus: 'draft',
      badgeLabel: 'Draft',
      primaryActionLabel: 'Continue Editing',
      primaryHref: scenarioDraftRoute(scenario),
      secondaryActionLabel: hasPublishedVersion ? 'Version History' : undefined,
      secondaryHref: hasPublishedVersion ? `/instructor/scenarios/${scenario.scenarioId}/versions` : undefined,
      helperLabel: hasPublishedVersion ? 'Unpublished changes available' : 'Editable draft available',
      hasPublishedVersion,
      hasUnpublishedDraft,
    };
  }

  return {
    teachingStatus: 'not-launchable',
    badgeLabel: scenario.launchable ? 'Published' : 'Not launchable',
    primaryActionLabel: hasPublishedVersion ? 'View Scenario' : 'Review Scenario',
    primaryHref: hasPublishedVersion
      ? `/instructor/scenarios/versions/${scenario.publishedVersionId}`
      : scenarioDraftRoute(scenario),
    secondaryActionLabel: hasPublishedVersion ? 'Continue Editing' : undefined,
    secondaryHref: hasPublishedVersion ? scenarioDraftRoute(scenario) : undefined,
    helperLabel: scenario.launchabilityReason ?? undefined,
    hasPublishedVersion,
    hasUnpublishedDraft,
  };
}