// Source snapshot. Serializer-reviewed numeric assessment enums intentionally differ from handoff.
import type { MacroAssessmentDimension } from './analytics-replay';
import type { ScenarioDraftDocument } from './scenarios';
import type { JsonValue } from './platform';
import type { HistoryItem } from './sessions';

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroTypes.cs
export interface DirectionPrediction {
  output: string;
  inflation: string;
  unemployment: string;
  explanation: string;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroTypes.cs
export interface MacroDecision {
  code: string;
  direction: string;
  intensity: PolicyIntensity;
  prediction: DirectionPrediction | null;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroTypes.cs
export interface ScheduledMacroShock {
  round: number;
  type: string;
  intensity: PolicyIntensity;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroTypes.cs
export interface MacroObjectiveConfiguration {
  inflationMinimum: number;
  inflationMaximum: number;
  unemploymentMaximum: number;
  outputGapAbsoluteMaximum: number;
  debtToOutputMaximum: number;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroTypes.cs
export interface MacroConfiguration {
  initialOutputIndex: number;
  initialPotentialOutputIndex: number;
  initialInflation: number;
  initialUnemployment: number;
  initialPolicyRate: number;
  initialDebtToOutput: number;
  fiscalMultiplier: number;
  monetarySensitivity: number;
  inflationPersistence: number;
  okunCoefficient: number;
  objectives: MacroObjectiveConfiguration | null;
  scheduledShocks: Array<ScheduledMacroShock> | null;
  enabledActions: Array<string> | null;
  allowedIntensities: Array<PolicyIntensity> | null;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroTypes.cs
export interface CausalContribution {
  mechanism: string;
  demandPressure: number;
  supplyPressure: number;
  potentialOutputChange: number;
  policyRateChange: number;
  fiscalBalanceChange: number;
  explanation: string;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroTypes.cs
export interface PolicyConflict {
  code: string;
  explanation: string;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroTypes.cs
export interface PredictionAssessment {
  actionCode: string;
  correctDirections: number;
  directionCount: number;
  mechanismRecognized: boolean;
  conceptualScore: number;
  feedback: Array<string>;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroTypes.cs
export interface ObjectiveResult {
  code: string;
  achieved: boolean;
  actual: number;
  target: string;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroTypes.cs
export interface MacroRoundReport {
  round: number;
  contributions: Array<CausalContribution>;
  conflicts: Array<PolicyConflict>;
  assessments: Array<PredictionAssessment>;
  objectives: Array<ObjectiveResult>;
  causalExplanation: Array<string>;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroTypes.cs
export interface MacroState {
  quarter: number;
  outputIndex: number;
  potentialOutputIndex: number;
  outputGap: number;
  inflation: number;
  expectedInflation: number;
  unemployment: number;
  policyRate: number;
  fiscalBalance: number;
  debtToOutput: number;
  businessConfidence: number;
  consumerConfidence: number;
  wagePressure: number;
  productivity: number;
  laggedMonetaryDemand: number;
  configuration: MacroConfiguration;
  lastReport: MacroRoundReport | null;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroTypes.cs
export type PolicyIntensity = "Mild" | "Moderate" | "Strong";

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroScenarioAuthoring.cs
export interface MacroStartingConditions {
  outputIndex: number;
  potentialOutputIndex: number;
  inflation: number;
  unemployment: number;
  policyRate: number;
  debtToOutput: number;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroScenarioAuthoring.cs
export interface MacroRoleAuthoring {
  code: string;
  enabled: boolean;
  canSeeInstitutionalIndicators: boolean;
  objectives: Array<string>;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroScenarioAuthoring.cs
export interface MacroScenarioContent {
  briefing: string;
  learningObjectives: Array<string>;
  discussionPrompts: Array<string>;
  debriefPrompts: Array<string>;
  startingConditions: MacroStartingConditions;
  maximumQuarters: number;
  roles: Array<MacroRoleAuthoring>;
  enabledActions: Array<string>;
  allowedIntensities: Array<PolicyIntensity>;
  scheduledShocks: Array<ScheduledMacroShock>;
  teamObjectives: MacroObjectiveConfiguration;
  assessmentDimensions: Array<MacroAssessmentDimension> | null;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroScenarioAuthoring.cs
export interface AuthoringIssue {
  code: string;
  message: string;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroScenarioAuthoring.cs
export interface MacroValidationReport {
  canPublish: boolean;
  blockers: Array<AuthoringIssue>;
  warnings: Array<AuthoringIssue>;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroScenarioAuthoring.cs
export interface MacroPreviewQuarter {
  quarter: number;
  state: MacroState;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroScenarioAuthoring.cs
export interface MacroPreviewResult {
  seed: number;
  quarters: Array<MacroPreviewQuarter>;
  diagnostics: Array<AuthoringIssue>;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroScenarioAuthoring.cs
export interface MacroTemplate {
  code: string;
  name: string;
  description: string;
  content: MacroScenarioContent;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroScenarioAuthoring.cs
export interface MacroDraft {
  document: ScenarioDraftDocument;
  content: MacroScenarioContent;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroClassroomGameplay.cs
export interface MacroSubmissionView {
  id: string;
  userId: string;
  actionCode: string;
  payload: JsonValue;
  submittedPhase: string;
  submittedAt: string;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroClassroomGameplay.cs
export interface MacroPendingParticipant {
  userId: string;
  roles: Array<string>;
  hasSubmitted: boolean;
  isReady: boolean;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroClassroomGameplay.cs
export interface MacroTeamConsole {
  teamId: string;
  fullState: MacroState | null;
  decisions: Array<MacroSubmissionView>;
  predictions: Array<MacroSubmissionView>;
  pendingParticipants: Array<MacroPendingParticipant>;
  scheduledShocks: Array<ScheduledMacroShock>;
  causalContributions: Array<CausalContribution>;
  detectedTradeoffs: Array<PolicyConflict>;
  conceptualScores: Array<PredictionAssessment>;
  economicObjectives: Array<ObjectiveResult>;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroClassroomGameplay.cs
export interface MacroInstructorConsole {
  sessionId: string;
  status: string;
  phase: string;
  quarter: number;
  version: number;
  teams: Array<MacroTeamConsole>;
  eventHistory: Array<HistoryItem>;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroClassroomGameplay.cs
export interface MacroQuarterReplay {
  quarter: number;
  state: MacroState;
  decisions: Array<MacroSubmissionView>;
  predictions: Array<MacroSubmissionView>;
  events: Array<HistoryItem>;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroClassroomGameplay.cs
export interface MacroTeamDebrief {
  teamId: string;
  quarters: Array<MacroQuarterReplay>;
  averageConceptualScore: number;
  economicObjectivesAchieved: number;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroClassroomGameplay.cs
export interface MacroSessionDebrief {
  sessionId: string;
  teams: Array<MacroTeamDebrief>;
  eventHistory: Array<HistoryItem>;
}
