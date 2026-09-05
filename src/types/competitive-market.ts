// Source snapshot. Serializer-reviewed numeric assessment enums intentionally differ from handoff.
import type { ScenarioDraftDocument } from './scenarios';
import type { SubmissionInspection, HistoryItem } from './sessions';

// src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketTypes.cs
export interface MarketConfiguration {
  demandIntercept: number;
  supplyIntercept: number;
  demandSlope: number;
  supplySlope: number;
  priceCeiling: number;
  priceFloor: number;
  unitTax: number;
  unitSubsidy: number;
  policy: MarketPolicyType;
  buyerCount: number;
  sellerCount: number;
  unitsPerBuyer: number;
  unitsPerSeller: number;
  maximumRounds: number;
  scheduledShocks: Array<ScheduledMarketShock> | null;
}

// src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketTypes.cs
export interface BuyerPrivateInfo {
  valuation: number;
  quantityAvailable: number;
}

// src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketTypes.cs
export interface SellerPrivateInfo {
  cost: number;
  quantityAvailable: number;
}

// src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketTypes.cs
export interface MarketTransaction {
  buyerValuation: number;
  sellerCost: number;
  price: number;
  quantity: number;
}

// src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketTypes.cs
export interface MarketRoundResult {
  round: number;
  price: number;
  quantityExchanged: number;
  unmatchedDemand: number;
  unmatchedSupply: number;
  consumerSurplus: number;
  producerSurplus: number;
  totalSurplus: number;
  unrealizedGainsFromTrade: number;
  governmentRevenue: number;
  deadweightLoss: number;
  taxWedge: number;
  transactions: Array<MarketTransaction>;
  causalExplanation: Array<string>;
}

// src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketTypes.cs
export interface ScheduledMarketShock {
  round: number;
  type: string;
  intensity: MarketIntensity;
}

// src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketTypes.cs
export interface MarketState {
  round: number;
  configuration: MarketConfiguration;
  buyers: Array<BuyerPrivateInfo>;
  sellers: Array<SellerPrivateInfo>;
  lastResult: MarketRoundResult | null;
  history: Array<MarketRoundResult>;
}

// src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketTypes.cs
export interface MarketPrediction {
  price: string;
  quantity: string;
  shortageSurplus: string;
  welfare: string;
  explanation: string;
}

// src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketTypes.cs
export type MarketPolicyType = "None" | "PriceCeiling" | "PriceFloor" | "PerUnitTax" | "PerUnitSubsidy";

// src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketTypes.cs
export type MarketIntensity = "Mild" | "Moderate" | "Strong";

// src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketTypes.cs
export type MarketAssessmentDimension = 0 /* EquilibriumReasoning */ | 1 /* DemandSupplyReasoning */ | 2 /* Elasticity */ | 3 /* ConsumerProducerSurplus */ | 4 /* TaxIncidence */ | 5 /* PriceControls */ | 6 /* CausalMarketReasoning */;

// src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketAuthoring.cs
export interface CompetitiveMarketRole {
  code: string;
  enabled: boolean;
  seePrivateInformation: boolean;
  objectives: Array<string>;
}

// src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketAuthoring.cs
export interface CompetitiveMarketScenarioContent {
  briefing: string;
  learningObjectives: Array<string>;
  discussionPrompts: Array<string>;
  debriefPrompts: Array<string>;
  configuration: MarketConfiguration;
  maximumRounds: number;
  roles: Array<CompetitiveMarketRole>;
  enabledActions: Array<string> | null;
  assessmentDimensions: Array<MarketAssessmentDimension> | null;
}

// src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketAuthoring.cs
export interface MarketAuthoringIssue {
  code: string;
  message: string;
}

// src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketAuthoring.cs
export interface MarketValidationReport {
  canPublish: boolean;
  blockers: Array<MarketAuthoringIssue>;
  warnings: Array<MarketAuthoringIssue>;
}

// src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketAuthoring.cs
export interface MarketPreviewResult {
  seed: number;
  rounds: Array<MarketRoundResult>;
  diagnostics: Array<MarketAuthoringIssue>;
}

// src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketAuthoring.cs
export interface CompetitiveMarketTemplate {
  code: string;
  name: string;
  content: CompetitiveMarketScenarioContent;
}

// src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketAuthoring.cs
export interface CompetitiveMarketDraft {
  document: ScenarioDraftDocument;
  content: CompetitiveMarketScenarioContent;
}

// src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketGameplay.cs
export interface MarketTeamConsole {
  teamId: string;
  state: MarketState | null;
  submissions: Array<SubmissionInspection>;
  events: Array<HistoryItem>;
}

// src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketGameplay.cs
export interface MarketInstructorConsole {
  sessionId: string;
  phase: string;
  round: number;
  teams: Array<MarketTeamConsole>;
  history: Array<HistoryItem>;
}
