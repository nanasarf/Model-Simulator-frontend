/** Batch 4A HTTP protocol v1; independent of presence protocol v1 and Phaser. */
export interface WorldBinding {
  templateId: string; templateVersion: string; templateHash: string;
  projectorId: string; projectorVersion: string; schemaVersion: 1;
}
export interface WorldTemplateDescriptor {
  name: string; modelIdentifier: string; modelVersion: string; binding: WorldBinding;
}
export interface ScenarioGameplayBinding { identifier: 'Honeyville.PairedQuotation'; version: 1 }
export type QuotationAction = 'SUBMIT_BUYER_BID' | 'SUBMIT_SELLER_ASK';
export interface QuotationPayload { price: number; quantity: number }
export interface QuotationRequest {
  teamId: string; roleAssignmentId: string; actionCode: QuotationAction;
  payload: QuotationPayload; expectedRound: number; expectedPhase: 'Decision';
}
/** Existing POST /actions response. Accepted is not executed or personally settled. */
export interface QuotationAcknowledgment {
  id: string; sessionId: string; roundNumber: number; teamId: string; userId: string;
  roleAssignmentId: string; actionCode: QuotationAction; payload: QuotationPayload;
  idempotencyKey: string; submittedAt: string; submittedPhase: string | null;
}
export interface MarketWorkspaceRole {
  assignmentId: string; code: string; objectives: string[] | null;
}
export interface MarketInput { name: string; type: 'decimal' | 'integer'; minimum: number; maximum: number; required: boolean }
export interface MarketWorkspaceAction {
  code: QuotationAction; requiredCapability: string; canSubmit: boolean;
  allowedPhases: string[]; inputs: MarketInput[];
  submissionPolicy: 'model-native-inputs;one-quote-per-side-required-for-execution;amendments-unresolved';
}
export interface MarketSubmissionReceipt {
  submissionId: string; period: number; actionCode: QuotationAction;
  status: 'submitted'; acceptedAt: string; payload: QuotationPayload;
}
export interface ReleasedMarketResult {
  period: number; matchStatus: 'matched' | 'no-trade';
  /** Exact invariant decimal text, null when no trade; not a personal profit or equilibrium price. */
  price: string | null; quantityExchanged: number;
  unmatchedBuyerOrderQuantity: number; unmatchedSellerOrderQuantity: number;
  priceInterpretation: 'unweighted-mean-of-executed-pair-prices';
}
export type DecisionStatus = 'not-started' | 'paused' | 'reflection' | 'completed' |
  'current-period-results-released' | 'current-period-executed' | 'decision-submitted' |
  'decision-period-open' | 'awaiting-instructor-execution' | 'observing';
export type ReleaseStatus = 'current-period-released' | 'previous-period-results' | 'awaiting-release' | 'no-result';
export interface BuyerScheduleEntry { valuation: number; quantityAvailable: number }
export interface SellerScheduleEntry { cost: number; quantityAvailable: number }
export interface MarketWorkspace {
  protocolVersion: 1; sessionId: string; scenarioVersionId: string;
  modelIdentifier: 'Economics.CompetitiveMarket'; modelVersion: '1.0.0';
  world: WorldBinding | null; gameplay: ScenarioGameplayBinding | null;
  participantUserId: string; teamId: string; decisionPeriod: number;
  sessionStatus: string; phase: string; decisionStatus: DecisionStatus;
  submissionStatus: 'submitted' | 'not-submitted'; executionStatus: 'executed' | 'not-executed';
  releaseStatus: ReleaseStatus; roles: MarketWorkspaceRole[]; actions: MarketWorkspaceAction[];
  submissions: MarketSubmissionReceipt[]; buyerInformation: BuyerScheduleEntry[] | null;
  sellerInformation: SellerScheduleEntry[] | null; releasedResult: ReleasedMarketResult | null;
  informationPolicy: string; limitations: string[]; sessionVersion: number;
}
export interface CompetitiveMarketRole {
  code: 'BUYER' | 'SELLER' | 'GOVERNMENT'; enabled: boolean;
  seePrivateInformation: boolean; objectives: string[];
}
/** Fetch and edit HONEYVILLE_PAIRED_QUOTATION from the existing authoring templates API. */
export interface LaboratoryScenarioContent {
  briefing: string; learningObjectives: string[]; discussionPrompts: string[]; debriefPrompts: string[];
  configuration: {
    demandIntercept?: number; supplyIntercept?: number; demandSlope?: number; supplySlope?: number;
    priceCeiling?: 0; priceFloor?: 0; unitTax?: 0; unitSubsidy?: 0; policy?: 'None';
    buyerCount: 1; sellerCount: 1; unitsPerBuyer: 1; unitsPerSeller: 1;
    maximumRounds?: 1; scheduledShocks?: [] | null;
  };
  maximumRounds: 1; roles: CompetitiveMarketRole[]; enabledActions: QuotationAction[];
  assessmentDimensions?: string[] | null; world: WorldBinding; pairedQuotationLaboratory: true;
}
export interface ProblemDetails { title: string; status: number; detail?: string; traceId?: string }
export const validBidExample: QuotationPayload = { price: 100, quantity: 1 };
export const validAskExample: QuotationPayload = { price: 20, quantity: 1 };
/** Invalid at runtime despite being numbers: out-of-range price and fractional quantity. */
export const invalidExample: QuotationPayload = { price: -1, quantity: 1.5 };
