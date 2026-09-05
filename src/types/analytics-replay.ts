// Source snapshot. Serializer-reviewed numeric assessment enums intentionally differ from handoff.
import type { MacroState, MacroSubmissionView, CausalContribution, PolicyConflict, PredictionAssessment, ObjectiveResult } from './short-run-macro';
import type { HistoryItem } from './sessions';

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroLearningAnalytics.cs
export interface MacroAnalyticsSlice {
  subjectId: string;
  subjectType: string;
  roleCode: string | null;
  predictionCount: number;
  correctPredictions: number;
  conceptualScore: number;
  policyReasoningScore: number;
  objectivesAchieved: number;
  objectiveScore: number;
  economicOutcomeScore: number;
  shockResponses: number;
  lagRecognitions: number;
  policyConflicts: number;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroLearningAnalytics.cs
export interface MacroSessionAnalytics {
  sessionId: string;
  students: Array<MacroAnalyticsSlice>;
  roles: Array<MacroAnalyticsSlice>;
  teams: Array<MacroAnalyticsSlice>;
  session: MacroAnalyticsSlice;
  comments: Array<AssessmentComment>;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroLearningAnalytics.cs
export interface MacroReplayQuarter {
  quarter: number;
  state: MacroState;
  predictions: Array<MacroSubmissionView>;
  decisions: Array<MacroSubmissionView>;
  contributions: Array<CausalContribution>;
  tradeoffs: Array<PolicyConflict>;
  assessments: Array<PredictionAssessment>;
  objectives: Array<ObjectiveResult>;
  studentVisibleExplanations: Array<string>;
  instructorExplanations: Array<string>;
  events: Array<HistoryItem>;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroLearningAnalytics.cs
export interface MacroSessionReport {
  sessionId: string;
  analytics: MacroSessionAnalytics;
  replay: Array<MacroReplayQuarter>;
}

// src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroLearningAnalytics.cs
export type MacroAssessmentDimension = 0 /* DirectionalPrediction */ | 1 /* CausalMechanism */ | 2 /* TradeoffAwareness */ | 3 /* LagRecognition */ | 4 /* ObjectiveAchievement */ | 5 /* PolicyReasoning */ | 6 /* EconomicOutcome */;

// src/SimulationPlatform.Application/Assessment/AssessmentCommentContracts.cs
export interface AssessmentComment {
  id: string;
  sessionId: string;
  targetType: string;
  targetId: string;
  authorUserId: string;
  text: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
