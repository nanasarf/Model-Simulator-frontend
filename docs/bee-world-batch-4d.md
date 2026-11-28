# Bee World Batch 4D — Policy v2 confirmation and instructor correction

## Scope and backend verification

Implemented the frontend consumer for the Batch 4C paired-quotation policy v2. The backend handoff was present in the adjacent `ModelSimulator-backend` checkout and its HTTP implementation was checked alongside the v2 guide and TypeScript contract. The frontend copies the backend `paired-quotation-v1.ts` dependency and `paired-quotation-v2.ts` consumer contract without changing their definitions. Contract tests compare the copies byte-for-byte after normalizing line endings.

The application uses the backend’s existing scenario-authoring template discovery. Policy v2 is available only when the backend returns the `HONEYVILLE_PAIRED_QUOTATION_V2` template. Selecting it applies that backend-provided template; it is never silently applied to existing scenarios. Other paired-lab drafts keep the earlier policy until the instructor deliberately opts into v2.

No mismatch was found between the Batch 4C TypeScript consumer contract, protocol guide, and the inspected endpoint implementation for the methods consumed here.

## Integrated endpoints and protocol behavior

- `GET /api/v1/economics/competitive-market/sessions/{sessionId}/workspace` is parsed by `protocolVersion`. V1 keeps the prior native quantity and D3 experience. V2 reads its authorized role and slot state from the server, including generation, confirmation, reopen, correction-pending, and resubmission fields.
- `POST /api/v1/sessions/{sessionId}/actions` keeps the existing action and `Idempotency-Key` workflow. For v2, the serialized request includes the current `expectedSlotGeneration` and quantity is exactly `1`. Request identity and pending recovery data are scoped by generation. Same-key retries retain the original serialized body; a new generation gets a new form identity and a new key.
- `GET /api/v1/economics/competitive-market/sessions/{sessionId}/decision-readiness` drives the v2 instructor view. The frontend displays the returned `canExecute`, blockers, slots, correction state, and executed state; local submission counts never establish v2 readiness. The v1-only `decision.corrections_unavailable` response selects the existing v1 instructor experience. Other readiness failures keep execution unavailable and show recovery guidance.
- `POST /api/v1/economics/competitive-market/sessions/{sessionId}/quotation-slots/reopen` sends the backend’s `{teamId, period, actionCode, expectedGeneration, reason}` command with an idempotency key. The response is validated as a `DecisionSlotCorrection`, including instructor/session/team/side/period identity and incremented generation. A successful command triggers authoritative session/readiness refresh.

The Batch 4C implementation does not introduce a new SignalR event or connection for quotations. The frontend uses the existing session refresh/invalidation path, a 10-second student workspace refresh, and a 5-second instructor readiness refresh. World presence and Phaser remain optional; academic HTTP access is independent of them.

## Student confirmation

The existing decision workspace displays the assigned role, period, objectives, authorized own-side information, and v2 slot status. Policy v2 shows the price input and a fixed, read-only one-unit quantity. The first action opens a review step showing price, side, period, and the consequences of confirmation. Only the second, explicit **Confirm quotation** action submits.

After acceptance, the workspace recovers the server acknowledgment and shows the confirmed quotation as a recorded input awaiting instructor-controlled execution. It is not presented as a trade. A sealed slot hides ordinary submission; a backend conflict explains that it cannot replace the confirmation. On reopening, the student must review and confirm again. The changed generation resets local review state and changes the pending-operation identity, preventing a stale key/body from becoming a new opportunity. A refresh or reconnect recovers accepted, reopened, and superseded status from the workspace endpoint.

The student's own quotation history labels superseded entries after reopening. The interface does not show opposing quotations, derive prices or outcomes, or use movement, presence, or submission speed for economic access. Honey Market and direct session access continue to mount the same React workspace.

## Instructor readiness and correction

The v2 instructor panel presents each team’s buyer/seller slot state, generation, pending resubmission, authoritative readiness, and translated backend blocker codes. It contains no quotation prices or private schedules. Execution controls use the backend’s readiness value and remain unavailable if policy/readiness recovery fails. Existing phase transitions and execution commands remain in place.

An instructor can request reopening only for a confirmed, unexecuted slot in Decision while the session is Running or Paused. The form requires a reason, then a separate review and confirmation action. The request contains no replacement price or quantity. The student must submit a new quotation after the slot reopens. The backend remains responsible for authorization, audited persistence, period/generation checks, and rejecting correction after execution. Correction reasons must not disclose private opposing information; instructors should not include it.

## Compatibility, recovery, and privacy

- V1, v2, and unbound scenarios remain distinct. V2 rules and fixed quantity are only rendered for `protocolVersion: 2`; the previous v1 D3 text, forms, and instructor count view remain available only for earlier-policy scenarios.
- A stale generation, duplicate idempotent request, different competing request, superseded receipt, closed period, or correction authorization failure is left to the corresponding backend response. Known conflicts receive targeted student guidance. The client does not silently replace quotes or treat a click as execution.
- A missing acknowledgment does not erase accepted work. Recovery reads the authoritative workspace before allowing an identical retry. Reopening is refreshed from the server; its acknowledgment is historical and is not itself treated as proof of the slot’s current state.
- Student workspace data is keyed by account/session and instructor readiness by account/session. Existing authenticated API handling is retained. No v2 quote payload or private schedule is stored in public labels or rendered in the instructor readiness dashboard.
- Forms keep explicit labels, keyboard operation, and a non-motion confirmation path. They work from the direct session workspace without Phaser or world multiplayer presence.

## Files changed for Batch 4D

- `src/features/competitive-market/paired-quotation-v1.ts` — exact backend v1 contract dependency.
- `src/features/competitive-market/paired-quotation-v2-contracts.ts` — exact backend v2 consumer contract.
- `src/features/competitive-market/laboratory-service.ts` — protocol parsing, generation-aware action bodies, readiness and correction calls/validation.
- `src/features/competitive-market/PairedQuotationWorkspace.tsx` — v2 display, fixed quantity, review/confirm, sealed/reopened recovery.
- `src/features/competitive-market/MarketInstructorProgression.tsx` — v2 readiness, blockers, execution gate, audited reopening.
- `src/features/competitive-market/WorldBindingEditor.tsx` — opt-in backend v2 template selection.
- `src/types/competitive-market.ts` — optional policy version in the authoring content type.
- `tests/paired-quotation-fixtures.ts` — v2 fixture.
- `tests/paired-quotation-v2.test.ts` and `tests/paired-quotation-v2-ui.test.tsx` — contract, generation, confirmation, readiness, and correction tests.
- `tests/paired-quotation-ui.test.tsx` — v2 authoring and explicit earlier-policy readiness behavior regression coverage.
- `e2e/paired-quotation-v2.spec.ts` — independent student/instructor browser contexts, confirmation, reopening, fresh-generation resubmission, screenshots.
- `e2e/paired-quotation.spec.ts` — earlier-policy mock now returns the documented v1 readiness-unavailable response.
- `docs/bee-world-batch-4d/` — browser screenshots.

The working tree also contains pre-existing, uncommitted Batch 4B files and unrelated classroom/world changes. They were preserved. The list above identifies the files added or edited for this Batch 4D work.

## Verification

- `npm test`: **208 tests passed across 24 files**.
- `npm run build`: **passed**. Vite reports existing SignalR annotation notices and the large Phaser game chunk; TypeScript and bundling complete successfully.
- `npm run test:world:browser`: **23 passed, 1 skipped**. This includes the v2 multi-context correction flow, prior v1/direct/world access tests, classroom regressions, and Honeyville browser tests. The skipped test is the existing live-backend world test.
- New browser coverage uses fixture-backed HTTP responses. It is not evidence of a deployed backend, multi-user network capacity, or live classroom compatibility. Browser screenshots show the implemented React experience against those fixtures: [student confirmation review](bee-world-batch-4d/student-confirmation-review.png) and [instructor readiness](bee-world-batch-4d/instructor-readiness.png).
- No real instructor/buyer/seller accounts or reachable backend were available for the live 4D sequence. The browser run’s existing session-hub proxy logged connection refused; v2 quotation calls and readiness/correction endpoints were therefore exercised only through test fixtures. No real execution or released model outcome is claimed.
- The browser suite’s existing 30-bee simulated rendering run measured about **14.0 FPS** and **41.96 MB JS heap** in headless Chromium with SwiftShader, 12 reported hardware threads, and simulated events at 100 ms intervals. This is a software-rendered, fixture simulation, not a 4D workload or live-network performance result. Batch 4D adds no Phaser rendering workload.

## Deployment and classroom blockers

1. Deploy the backend supporting both policies and apply its `20261126062348_DecisionSlotsAndCorrections` migration before publishing or starting policy-v2 sessions.
2. Run the real instructor, designated buyer, and designated seller acceptance path against that deployment, including correction and resubmission, readiness, execution, and released results.
3. Confirm the deployed scenario-authoring catalog publishes the v2 template and that deployed workspace protocol 2 and instructor readiness responses match the consumed contract.
4. Complete live accessibility review with keyboard and screen-reader use. Automated tests verify labels and keyboard-compatible controls but are not a formal accessibility audit.
5. Retain the earlier-policy D3 limitation for v1 scenarios. Policy v2 supports the defined one-unit confirmation/correction flow but does not change the economic model or establish competitive equilibrium, welfare, or individual profit.

No backend files, economic equations, scoring, or leaderboard behavior were changed.
