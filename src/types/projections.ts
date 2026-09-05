import type { PredictionAssessment, PolicyConflict, MacroState } from './short-run-macro';
import type { BuyerPrivateInfo, SellerPrivateInfo, MarketRoundResult } from './competitive-market';
/** Dictionary emitted by ShortRunMacroModel.GenerateVisibleStateAsync, not the handoff example. */
export interface MacroStudentProjection {
  quarter: number; outputIndex: number; inflation: number; unemployment: number;
  fiscalBalance?: number; debtToOutput?: number; outputGap?: number; policyRate?: number;
  expectedInflation?: number; businessConfidence?: number; wagePressure?: number; productivity?: number;
  consumerConfidence?: number; realIncomePressure?: number; assessments?: PredictionAssessment[];
  policyConflicts?: PolicyConflict[]; causalExplanations?: string[]; laggedEffect?: string;
}
export type MacroVisibleState = MacroStudentProjection | MacroState;
/** Current backend shape. Contains a known privacy defect; adapters must not display private data. */
export interface MarketStudentProjection { round: number; lastResult: MarketRoundResult | null; buyerInformation?: BuyerPrivateInfo[]; sellerInformation?: SellerPrivateInfo[] }
