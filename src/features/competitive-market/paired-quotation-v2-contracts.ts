/** Batch 4C: gameplay policy v2, workspace protocolVersion 2. V1 contract remains unchanged. */
import type {
  MarketWorkspace as V1Workspace, MarketWorkspaceAction as V1Action,
  MarketSubmissionReceipt as V1Receipt, QuotationRequest as V1Request,
  LaboratoryScenarioContent as V1Content, QuotationAction,
} from './paired-quotation-v1.js';

export interface ScenarioGameplayBindingV2 { identifier: 'Honeyville.PairedQuotation'; version: 2 }
export interface QuotationRequestV2 extends Omit<V1Request, 'payload'> {
  payload: { price: number; quantity: 1 };
  /** Read from the current authoritative slot; never infer from receipt count. */
  expectedSlotGeneration: number;
}
export interface MarketWorkspaceActionV2 extends Omit<V1Action, 'submissionPolicy'> {
  submissionPolicy: 'single-unit-confirmation;instructor-reopen-only;commit-order-dependent';
}
export interface MarketSubmissionReceiptV2 extends Omit<V1Receipt, 'status'> {
  status: 'submitted' | 'superseded'; executionEligibility: 'effective' | 'superseded';
}
export interface DecisionSlotCorrection {
  id: string; sessionId: string; teamId: string; period: number; actionCode: QuotationAction;
  generation: number; voidedSubmissionId: string; instructorUserId: string;
  reason: string; reopenedAt: string;
}
export interface DecisionSlotView {
  teamId: string; period: number; actionCode: QuotationAction; roleCode: 'BUYER' | 'SELLER';
  designatedUserId: string; generation: number; state: 'open' | 'confirmed' | 'reopened';
  confirmationId: string | null; correctionPending: boolean; wasReopened: boolean;
  /** Permission to create a new confirmation for this generation, including initial submission. */
  canResubmit: boolean; corrections: DecisionSlotCorrection[];
}
export interface MarketWorkspaceV2 extends Omit<V1Workspace,
  'protocolVersion' | 'gameplay' | 'actions' | 'submissions' | 'decisionStatus' | 'submissionStatus'> {
  protocolVersion: 2; gameplay: ScenarioGameplayBindingV2;
  actions: MarketWorkspaceActionV2[]; submissions: MarketSubmissionReceiptV2[];
  decisionStatus: V1Workspace['decisionStatus'] | 'correction-pending';
  submissionStatus: V1Workspace['submissionStatus'] | 'correction-pending';
  decisionSlots: DecisionSlotView[];
}
export interface LaboratoryScenarioContentV2 extends V1Content { gameplayPolicyVersion: 2 }
export interface ReopenDecisionSlotRequest {
  teamId: string; period: number; actionCode: QuotationAction;
  expectedGeneration: number; reason: string;
}
export interface TeamDecisionReadiness {
  teamId: string; period: number; slots: DecisionSlotView[]; blockers: string[];
  executed: boolean; canExecute: boolean;
}
export interface InstructorDecisionReadiness {
  protocolVersion: 2; sessionId: string; period: number; phase: string; sessionStatus: string;
  teams: TeamDecisionReadiness[];
}
export type ConfirmationConflictCode = 'market.quotation_already_confirmed' | 'decision.slot_stale' |
  'decision.confirmation_superseded' | 'decision.correction_closed' | 'decision.slot_not_confirmed' |
  'decision.correction_pending' | 'decision.designation_invalid' | 'idempotency.conflict' | 'concurrency.conflict';
export const firstBuyerConfirmation: QuotationRequestV2 = {
  teamId: '11111111-1111-1111-1111-111111111111',
  roleAssignmentId: '22222222-2222-2222-2222-222222222222',
  actionCode: 'SUBMIT_BUYER_BID', payload: { price: 100, quantity: 1 },
  expectedRound: 1, expectedPhase: 'Decision', expectedSlotGeneration: 0,
};
export const instructorCorrection: ReopenDecisionSlotRequest = {
  teamId: firstBuyerConfirmation.teamId, period: 1, actionCode: 'SUBMIT_BUYER_BID',
  expectedGeneration: 0, reason: 'Student requested correction of a mistaken quotation before the decision period closes.',
};
