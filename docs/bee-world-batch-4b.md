# Bee World Batch 4B — Paired Quotation Laboratory frontend

Implemented 2026-11-21. Frontend integration only; backend equations, matching, classroom admission, role assignment, simulation execution, Phaser geometry and multiplayer protocols are unchanged.

**Pilot status: blocked by unresolved D3 and pending live classroom acceptance.** Fixture-backed browser tests exercise the actual React and Phaser interfaces; they do not establish live backend compatibility or classroom readiness.

## Handoff and contracts

Inspected the adjacent `../../ModelSimulator-backend` checkout: `docs/bee-world-batch-4a.md`, `docs/bee-world-paired-quotation-v1.md`, `docs/contracts/paired-quotation-v1.ts`, educational foundations and Honeyville scenario design. Also reviewed this repository's educational experience directive and existing authoring, auth, session connection, world bootstrap and React/Phaser ownership. Verified the implementation in `CompetitiveMarketAuthoring.cs`, `PairedQuotationLabPolicy.cs`, workspace DTO/projection code and existing action/lifecycle handlers.

Backend HEAD at verification: `98c8f6cd820e3a2b4aaa31504e188304ffacb9bb`. Its unrelated classroom-lobby working changes were not edited. Consumer contract is **paired quotation HTTP protocol v1**, gameplay **Honeyville.PairedQuotation v1**, model **Economics.CompetitiveMarket 1.0.0**. The TypeScript consumer file is copied without semantic changes to `src/features/competitive-market/paired-quotation-contracts.ts`; SHA-256 of that file: `621115da449b945872bde8f52a14de974828a70fb17f482b65709e90ca5db59e`. A test compares the normalized source with the backend copy when that checkout is available.

| Contract or operation | Frontend integration |
| --- | --- |
| `GET /api/v1/world/templates?modelIdentifier=Economics.CompetitiveMarket&modelVersion=1.0.0` | Instructor-only compatible catalog; exact returned binding copied on explicit selection |
| Existing `/api/v1/economics/competitive-market/scenario-authoring/templates` and `/drafts` create/edit/validate/publish | Actual `HONEYVILLE_PAIRED_QUOTATION` content, versioned saves, backend blockers/warnings |
| `GET /api/v1/economics/competitive-market/sessions/{id}/workspace` | Student-authorized context, roles, own information/receipts, permitted actions, period and release state |
| `POST /api/v1/sessions/{id}/actions` | Existing authenticated action workflow; `Idempotency-Key`, assignment/team, native quotation payload, `expectedRound`, `expectedPhase: Decision` |
| `PUT /api/v1/sessions/{id}/rounds/current/readiness` | Explicit `{ready:true}` after accepted work; separate from initial participant readiness |
| Existing `/commands/advance-phase` and `/rounds/current/execute` | Instructor progression and per-team `{teamId,executionId}` execution |
| Existing owned-instructor `/console` and session `/setup` | Team names, current-period counts and execution status; raw privileged economic payloads omitted from this view's query cache |
| Existing `/hubs/sessions`, `JoinSession` and session event subscriptions | Invalidate authorized HTTP data after actions, phase/results, participant/role changes and reconnection |
| Existing `/hubs/world` presence protocol v1 | Unchanged; no economic command is sent through presence or Phaser |

No disagreement requiring a new protocol was found. Backend omissions/limits needing coordination are listed below; none was replaced by a frontend economic rule.

## Authoring and binding

The existing scenario builder's World & Events step discovers compatible worlds through the authenticated catalog. It preserves unbound drafts, shows an unverified binding rather than silently replacing it, and distinguishes a presentation binding from explicit laboratory opt-in. Template IDs, hashes and compatibility are never fabricated.

Instructors can review and explicitly apply the complete backend laboratory template. Applying it clearly replaces draft configuration, roles/objectives and prompts while retaining the scenario name. The lab editor exposes authored BUYER/SELLER objectives, own-side private-information settings and supported configuration fields. It explains the fixed single period and configured synthetic units without changing native submitted-quantity bounds. Unsupported policy, shocks, custom gameplay effects and welfare-assessment controls are absent for laboratory drafts. Existing non-laboratory authoring remains available.

Saves preserve `world`, `pairedQuotationLaboratory`, objectives and disclosure flags. Publication retains the existing expected-version workflow and authoritative validation. Warnings are visible even when there are no blockers. Publication errors triggered from the header are now visible outside Review as well. Laboratory review and the CompetitiveMarket publication page explicitly distinguish publication/launch eligibility from classroom readiness. Authoring previews are labeled as configured-input previews, not learner-submitted outcomes, and do not display legacy welfare metrics for the laboratory.

## Student workspace and submission

One `PairedQuotationWorkspace` component provides scenario title/team name through the existing lobby, plus authoritative period, role, model, team identity, phase/status, frozen objectives, own-side schedules, own receipts and backend limitations. Missing metadata does not substitute an economic condition. Missing and explicitly empty objectives remain distinct. An unsupported role receives no quotation form.

The buyer/seller form uses the matching own assignment and authorized action (`SUBMIT_BUYER_BID` / `SUBMIT_SELLER_ASK`). Submission eligibility follows the workspace, Running status and Decision phase, with backend validation final. Inputs retain price 0–10000 and integer quantity 1–1000. The configured one synthetic unit is not presented as a personal inventory or a quantity-one restriction.

Price text is validated using decimal digit/coefficient limits and serialized as a JSON **number token**, preserving .NET decimal precision without JavaScript float rounding. Own accepted receipt price tokens are retained from raw JSON text for exact display. Released result prices already arrive as authoritative decimal strings. These utilities validate/format inputs only; no frontend economic matching, surplus or outcome calculation is introduced.

A synchronous in-flight fence and shared user/session/team/period/assignment/action query state prevent rapid duplicate activation and preserve the same operation between navigation paths. Each logical request gets one UUID key and an immutable serialized body. A 202 acknowledgment is checked against session, account, team, assignment, action, period and key; accepted input is never labeled an executed trade. Success refreshes authorized state/workspace. Known validation/conflict responses remain explicit, including stale period feedback after the workspace advances.

For an uncertain network/5xx response, the request body/key are retained. Retry is manual, requires a successful authoritative recovery first, and uses the identical key/body; no fresh quotation is generated to work around a timeout. A recovered accepted receipt suppresses replay/additional quotation even when the lost response cannot be attributed to that key. While paused, completed, unauthorized or outside Decision, retries are disabled and accepted work is read-only.

Session storage contains only scoped pending-request recovery metadata, not authoritative economic state, wallets or model outcomes. It supports reload recovery; accepted acknowledgments remove the pending marker. Logout/account replacement/expiry clears pending quotation metadata through the existing token vault. In-memory query data is cleared by the existing runtime identity boundary. If storage is unavailable, in-memory recovery remains; recovery across reload cannot then be guaranteed.

## Equivalent world and direct navigation

- Direct: existing student session route renders the academic workspace with an ordinary keyboard-accessible anchor. No canvas, avatar, presence connection, proximity or bootstrap is required.
- World: the Honey Market proximity prompt/`E` interaction opens the same React component. The world guide also offers an unconditional Open Honey Market workspace control, independent of traversal. Both paths use identical HTTP services, assignment checks, forms and receipt state.
- World failure: asset/renderer errors leave the guide control and direct workspace link available. Bootstrap/access/ended-world states also retain the direct link. The market workspace is outside Phaser's renderer boundary, and economic commands never depend on the movement lease. Leaving the world still destroys its one scene/canvas and scoped subscriptions.
- Legacy/unbound: only the backend's explicit `market.lab_required` or `market.session_required` response permits the pre-existing legacy workspace/market board fallback. Authentication, authorization, contract or transient API errors do not silently expose generic economic actions.

No world economic animation was added: the existing binding supplies a released information board, not a supported production/employment/inventory model. The academic result view handles no-trade semantics correctly without inventing environmental consequences.

## Lifecycle, instructor controls and outcomes

The existing session lifecycle remains authoritative: Briefing → Decision → Locked → per-team execution/Simulation → Results after all teams → Reflection → Completed. The new instructor panel displays current period, team quotation counts and execution state, submits existing commands, and surfaces backend errors. Counts are advisory; zero/multiple quotes, readiness, authorization and phase admissibility are checked on the server. Non-laboratory markets are not assigned a fabricated one-quote rule. Existing instructor controls and classroom/session launch/setup workflows are preserved.

Execution IDs remain stable for a team/period while the instructor panel is mounted, including uncertain retries. After remount, server execution status and existing duplicate-execution protection remain authoritative; no client-side execution store is introduced.

Outcomes come exclusively from `releasedResult`. The UI distinguishes unexecuted, executed/withheld, released, Reflection and Completed, and labels the result's originating period explicitly. Previous-period data is never relabeled as current. A no-trade result uses null price and zero exchanged quantity; an actual matched zero price remains a matched result. The UI shows supported aggregate quantities and the model's unweighted mean-of-pair-prices interpretation. It offers no invented demand/supply curve, equilibrium claim, validated welfare, personal profit or attribution of collective intellectual authorship.

The workspace refreshes every 10 seconds, on focus, manually and through existing session invalidations. Authoritative HTTP recovery works independently of classroom SignalR and world presence. Accepted backend work survives reconnect/reload. Scope validation rejects foreign account/session/team snapshots. Late submission callbacks do not repopulate data after identity changes. Period/assignment changes receive separate form state; stale rejection notices remain visible across period refreshes.

## Privacy, accessibility and connection state

Student data comes from the student workspace/lobby, never the instructor console. Only own-side schedules and own receipts are rendered. Unexpected counterpart schedules are removed from presentation data; unreleased numeric results fail closed. The instructor summary drops private payloads and raw model state before caching, retaining only counts and executed period. Existing privileged diagnostic routes are not repurposed as learner results.

Essential controls use ordinary labeled inputs/buttons, semantic headings/tables, keyboard submission, textual validation and status/alert regions. Price uses decimal input mode; quantity uses numeric input mode. Narrow layouts stack fields/context. No chart, canvas or animation is required to participate; no new animation was introduced. Browser checks cover keyboard focus/submission at 390px with reduced-motion preference. These are functional accessibility checks, not a completed screen-reader or formal contrast audit.

The existing shell's **Disconnected** state is emitted by `SessionConnection` for `/hubs/sessions`, including transport/start failures, JoinSession failures or failed HTTP recovery during join. `/hubs/world` has its own presence status. The session message now explains this distinction; a disconnected live channel does not establish that academic HTTP is unavailable. Browser failure injection verifies continued academic access. No live incident trace was available, so the cause of the earlier manually observed indicator has not been established.

## Tests and evidence

Fixtures follow the consumer DTOs and native schemas, including decimal numeric requests and string result prices. Browser fixtures supply predeclared model results; the harness does not claim to execute backend economics.

- Contract tests: unchanged consumer source, exact decimal serialization/receipt display, native quantity bounds, identity/input schema guards, release protection/period attribution, no-trade versus matched zero and counterpart exclusion.
- Interaction tests: buyer/seller/unsupported role, validation, duplicate activation, idempotency, uncertain-response recovery, reload recovery, recovered acceptance, stale-period notices, pause/completion, previous-period Reflection, session isolation, explicit legacy fallback, catalog binding selection/template application/private options, instructor D3 conflicts/stable execution identity and paused execution.
- Actual browser interfaces: three independent authenticated fixture contexts (instructor, buyer, seller), real Phaser Honey Market proximity interaction, shared receipts across direct/world paths, backend-fixture execution/release/Reflection, asset/presence failure fallback, catalog authoring/save/publication, rejected binding/publication, narrow-screen keyboard access and failed classroom transport.
- Existing regression coverage retains auth, classroom flows, role changes, multiplayer ordering/ownership/recovery and scene/component cleanup. Browser performance benchmark cases are intentionally excluded from regression reruns to preserve the earlier Batch 3B measurement artifacts.

### Recorded validation results

| Check | Result |
| --- | --- |
| Final `npm test` | **200 passed, 22 files**, 11.77s; includes 25 new contract/academic interaction tests |
| Browser regression with the two historical benchmark cases excluded | 19 passed, one legacy traversal timed out, one opt-in live presence case skipped |
| Final targeted browser rerun: collision traversal plus all five Batch 4B browser cases | **6 passed**, 1.6min; all 20 non-live regression cases have passing evidence across these runs |
| Final `npm run build` | **Passed**; main JS 551.70kB / 158.89kB gzip, lazy Phaser chunk 1695.63kB / 385.47kB gzip; existing SignalR annotation and bundle-size warnings remain |
| Live economic classroom acceptance | **Not run**: no local backend/listening classroom service or instructor/buyer/seller credentials |

The initial concurrent unit/build/browser run exposed an existing team-create timing assertion; the subsequent isolated full unit run passed. The legacy traversal also exceeded its original cumulative 60-second budget and, on its 850px leg, its per-move budget under software rendering. Trace coordinates showed continued movement, not a collision on that clear route. Its final fixture uses a 120-second total budget and a clear-path waypoint, retains 20 seconds per leg and all building/perimeter/focus assertions, and passes. An intermediate development-server reload interrupted another run; the final passing browser run used stable sources. These results do not establish ordinary-laptop frame rate or live multiplayer/network capacity.

### Screenshots

Actual implemented interfaces, rendered in headless Microsoft Edge using contract-backed HTTP/hub fixtures; these are not live classroom captures:

- [Scenario binding and private-information options](bee-world-batch-4b/scenario-binding.png)
- [Honey Market academic panel in the Phaser world](bee-world-batch-4b/honey-market-workspace.png)
- [Direct buyer workspace and recovered receipt](bee-world-batch-4b/buyer-workspace.png)
- [Instructor per-team execution](bee-world-batch-4b/instructor-progression.png)
- [Released, period-labeled aggregate outcomes](bee-world-batch-4b/released-outcomes.png)
- [Narrow-screen keyboard-accessible workspace](bee-world-batch-4b/mobile-decision-workspace.png)

No new rendering/network-capacity benchmark is claimed. Phaser assets, interpolation and movement transmission are unchanged. The earlier [Batch 3B simulated rendering measurement](bee-world-batch-3b/rendering-metrics.json) recorded approximately 23.69fps / 48.7ms p95 with 30 bees under headless Edge software rendering; it is historical simulated rendering evidence, not live network capacity or an ordinary-laptop target achieved by this batch. Re-profile the integrated laboratory on classroom hardware before pilot use.

## D3, contract limits and pilot prerequisites

1. **D3 remains unresolved.** Native quantity bounds are retained. Distinct additional keys add quotations and can block laboratory closure/execution with `market.lab_ambiguous_quotations`. No first/last-wins, amendment, cancellation or silent discard is implemented. The UI discourages additional accepted work with an explicit UI-only safeguard; it does not claim a backend one-submission quota. Instructor errors explain preserve-history/new-session recovery. Cross-tab/account concurrency still requires a resolved backend opportunity/revision policy.
2. Workspace receipts do not expose their idempotency keys and no per-receipt GET is implemented. After a lost response the client cannot prove which pending key produced an existing receipt; it conservatively avoids replay/new quotations and shows authoritative own work.
3. Published-version and instructor console metadata do not identify the lab opt-in as a dedicated capability. Authoring has the actual flag; the generic market instructor panel uses conditional lab explanations and server validation rather than inventing a lab status. Publication summaries show a conditional paired-lab disclaimer for this model/version.
4. Individual reasoning/recommendations, saved predictions, private feedback, scoring and debrief submission contracts are absent. Reflection is a released-results review and instructor-led discussion, not an invented assessment system.
5. No running local backend or authenticated instructor/buyer/seller credentials were available. Live authoring→binding→launch→quotation→execution→release→Reflection remains **unverified**. Existing opt-in live presence acceptance is skipped without its environment prerequisites. A fixture pass is not live acceptance.
6. Before classroom pilot: approve/implement/test D3; run a real fresh classroom with instructor and authorized buyer/seller, including multiple tabs, withdrawal, paused retry, lost acknowledgment and all-team release; verify private false/true publications and frozen legacy grants; audit screen-reader/zoom/contrast/focus behavior; measure ordinary-laptop performance and real network reconnection; investigate the actual disconnected incident with service-specific traces.

## Exact changed files

Modified frontend files (the Honeyville browser fixture explicitly declares legacy lab opt-out; its long collision traversal retains all geometry checks and 20-second per-leg deadlines, adds a clear-path waypoint, and allows a 120-second cumulative software-rendering budget):

- `src/features/scenarios/editor.tsx`
- `src/features/scenarios/library.tsx`
- `src/features/simulation/workspace.tsx`
- `src/features/world/HoneyvillePage.tsx`
- `src/lib/api/client.ts`
- `src/lib/auth/session.ts`
- `src/types/competitive-market.ts`
- `e2e/honeyville.spec.ts`
- `e2e/classroom-roles.spec.ts`

Added frontend/test files:

- `src/features/competitive-market/paired-quotation-contracts.ts`
- `src/features/competitive-market/laboratory-service.ts`
- `src/features/competitive-market/quotation-decimal.ts`
- `src/features/competitive-market/quotation-storage.ts`
- `src/features/competitive-market/PairedQuotationWorkspace.tsx`
- `src/features/competitive-market/WorldBindingEditor.tsx`
- `src/features/competitive-market/MarketInstructorProgression.tsx`
- `src/features/competitive-market/laboratory.css`
- `tests/paired-quotation-fixtures.ts`
- `tests/paired-quotation-contract.test.ts`
- `tests/paired-quotation-ui.test.tsx`
- `e2e/paired-quotation.spec.ts`
- `docs/bee-world-batch-4b.md`
- The six `docs/bee-world-batch-4b/*.png` screenshots linked above.

No backend files, equations, movement assets or historical benchmark artifacts were changed.
