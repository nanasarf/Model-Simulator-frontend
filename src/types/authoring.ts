export interface AuthoringCatalog { modelIdentifier: string; modelVersion: string; roles: string[]; capabilities: string[]; actions: string[]; phases: string[]; stateVariables: string[]; shockTypes: string[]; indicators: string[]; ruleOperators?: string[]; effectDirections?: string[]; intensities?: string[]; assessmentDimensions?: string[] }
export interface LearningObjectiveBlueprint { code: string; description: string }
export interface RoleBlueprint { code: string; displayName: string; description: string; responsibilities: string[]; decisionCodes: string[]; visibleIndicatorCodes: string[]; minimumParticipants: number; maximumParticipants: number }
export interface DecisionBlueprint { code: string; displayName: string; description: string; allowedRoleCodes: string[]; requiredCapabilityCode: string; availablePhases: string[]; intensityOptions: string[] }
export interface RuleBlueprint { id: string; name: string; description: string; trigger: string; conditions: unknown; effects: unknown; explanation: string; learningObjectiveCodes: string[] }
export interface ShockBlueprint { code: string; title: string; studentFacingDescription: string; instructorExplanation: string; type: string; severity: string; effects: unknown; suggestedRound: number | null; learningObjectiveCodes: string[] }
export interface AssessmentDimensionBlueprint { code: string; description: string; maximumScore: number }
export interface ScenarioBlueprint { schemaVersion: string; title: string; summary: string; studentBriefing: string; simulationType: string; modelIdentifier: string; modelVersion: string; recommendedRounds: number; learningObjectives: LearningObjectiveBlueprint[]; roles: RoleBlueprint[]; decisions: DecisionBlueprint[]; rules: RuleBlueprint[]; startingWorld: unknown; shockPool: ShockBlueprint[]; assessmentRubric: { version: string; dimensions: AssessmentDimensionBlueprint[] } | null; instructorNotes: string | null }
export interface BlueprintIssue { code: string; message: string; path: string; severity: string; suggestedFix?: string; [field: string]: unknown }
export interface BlueprintValidationReport { isValid: boolean; blockers: BlueprintIssue[]; warnings: BlueprintIssue[]; normalizedBlueprint?: ScenarioBlueprint; structuralBlockers?: BlueprintIssue[]; structuralWarnings?: BlueprintIssue[]; semanticWarnings?: BlueprintIssue[]; proposalVersion?: number; revisionNumber?: number }
export interface ScenarioModelRecommendation { modelIdentifier: string; modelVersion: string; rationale: string }
export interface ScenarioAiGenerationResult {
  generationId: string;
  status: string;
  recommendation: ScenarioModelRecommendation;
  plan: Record<string, unknown>;
  blueprint: ScenarioBlueprint;
  structuralValidation: BlueprintValidationReport;
  semanticValidation: { blockers: BlueprintIssue[]; warnings: BlueprintIssue[] };
  structuralBlockers?: BlueprintIssue[]; structuralWarnings?: BlueprintIssue[]; semanticWarnings?: BlueprintIssue[];
  metadata: { provider: string; model: string; usedStructuredOutput: boolean; promptTokens?: number; completionTokens?: number; elapsed: string };
}
export interface ScenarioAiRevisionResult {
  expectedVersion: number;
  revisionNumber: number;
  proposedBlueprint: ScenarioBlueprint;
  validation: BlueprintValidationReport;
  semanticValidation?: { blockers: BlueprintIssue[]; warnings: BlueprintIssue[] };
  semanticWarnings?: BlueprintIssue[];
  dependentSectionsAffected?: string[];
  status?: string;
  revisionIssues?: BlueprintIssue[];
}
