# Model Simulator: educational experience and frontend foundations

**Established:** 2026-11-20. **Audience:** frontend, backend, academic scenario authors, and teaching staff.

**Status:** The experience principles below are permanent product requirements established by the frontend foundational directive. The implementation audit describes the checked-out code, including existing uncommitted classroom/role work. The future Batch 4B section is a preliminary integration proposal, not implementation authorization or a gameplay contract. Backend Batch 4A is proposed, not implemented; the coordinated academic specification and approved gameplay contracts remain dependencies.

**Change boundary:** This alignment task creates this document only. It does not implement Batch 4B, economic mechanics, new endpoints, model calculations, assets, navigation changes, or a visual redesign. Existing implementations and unrelated work must remain intact.

## 1. Product thesis and permanent principles

Model Simulator is a university-level interactive educational laboratory presented through an immersive virtual civilization. Students should experience, analyze, and understand consequences within mathematically grounded models. Engagement supports learning; success must depend on subject knowledge, analytical reasoning, assumptions, and sound decisions rather than gaming ability.

The frontend must observe these requirements in every future batch:

1. **Academic access is independent of locomotion.** Every essential decision, constraint, objective, released observation, and required reflection needs an accessible direct route. Travel, collision, avatar control, a presence lease, a working GPU, or loading the map must not be prerequisites for academic participation.
2. **No advantage from speed or repetition.** Do not award economic or academic benefits for reaching a facility first, clicking faster, sending more requests, having gaming experience, exploring longer, or rendering more frames. Do not introduce resource-clicking tasks, reflex challenges, movement rewards, outcome-affecting upgrades, or artificial experience points.
3. **One simulation and one authoritative action path.** World and direct interactions open the same academic functionality and use the same backend permissions, constraints, submission semantics, and released information. They are navigation alternatives, not separate markets or simulation implementations.
4. **The backend determines economic truth.** Do not invent prices, quantities, endowments, production, employment, inflation, welfare, personal assets, evaluation rules, or numerical outcomes. Frontend calculators require explicit approval, model-consistent definitions, and clear labeling.
5. **Knowledge and disclosure are controlled.** A label, institution, chart, tooltip, world animation, or export must not reveal information beyond the approved role/team/session scope and release policy. Difficulty settings cannot grant confidential information in the browser.
6. **Submission is not execution.** Distinguish editing, acknowledged submission, period closure, model processing, released results, and reflection. An HTTP acknowledgment is not evidence that a market has cleared or an economic outcome has occurred.
7. **Individual learning is distinct from collective outcomes.** Keep individual recommendations, reasoning, expectations, feedback, team decisions, and team or market-wide results distinguishable. Submitting an action does not establish sole authorship or individual academic quality. Individual evaluation is private by default; wealth is not a primary academic leaderboard.
8. **Preserve Honeyville and its ownership boundaries.** Retain Phaser, the tilemap, original artwork, movement, collision geometry, camera, multiplayer presence, reconciliation, and lifecycle cleanup. React owns accessible academic interfaces and services; Phaser owns spatial presentation. Preserve classroom enrollment, session lifecycle, role assignment, and existing economic behavior.
9. **Degrade gracefully without bypassing access checks.** A failed renderer or movement connection must not unnecessarily disable working academic services. Authentication failure, access revocation, unsupported academic contracts, or unavailable authoritative decision services still fail closed.
10. **Use a mature academic visual language.** Favor readable typography, restrained animation, clear analytical information, responsive layouts, and minimal distraction. Do not turn this alignment into an unrelated redesign or make the experience resemble a children's reward game.

### Proximity decision

Proximity may suggest optional context, identify a nearby institution, and offer a convenient entry point. It must not restrict essential economic information or actions. The direct route must provide the same approved information at the same release point, not a reduced substitute.

This supersedes the essential-action proximity assumptions in older architecture proposals. In particular, the adjacent backend architecture proposal's sections on world context/proximity gating and its presence protocol's discussion of possible future proximity checks are historical proposals, not approval to require an avatar pose for academic work. Those documents are preserved; this directive requires the revised Batch 4A proposal to resolve the conflict before implementation. Do not simulate proximity on the direct route, grant a privileged bypass token, or create unequal permission paths.

## 2. Evidence and implementation baseline

This review inspected the following existing sources. Links identify evidence, not approval of future behavior.

| Evidence | What it establishes |
|---|---|
| [Batch 2 report](bee-world-batch-2.md), [map](../src/features/world/honeyville.json), [map parser](../src/features/world/map.ts), [prefabs](../src/features/world/prefabs.ts) | Existing 64×48 world, six facilities, original assets, static placement and information zones |
| [Honeyville page](../src/features/world/HoneyvillePage.tsx), [Phaser owner](../src/features/world/PhaserWorld.tsx), [scene](../src/features/world/game.ts), [bridge](../src/features/world/bridge.ts) | React/Phaser ownership, proximity inspection, panels, movement, asset failures and cleanup |
| [Presence adapter](../src/features/world/presence.ts), [v1 contracts](../src/features/world/presence-contracts.ts), [Batch 3B report](bee-world-batch-3b.md) | Separate presence transport, movement lease, bounded sender, snapshots, revisions, epochs, reconciliation and historical validation |
| [Session workspace](../src/features/simulation/workspace.tsx), [session service](../src/features/sessions/service.ts), [recovery types](../src/types/sessions.ts), [API client](../src/lib/api/client.ts) | Direct session recovery, generic action submission, explicit instructor execution, and authenticated request handling |
| [CompetitiveMarket adapter](../src/features/competitive-market/adapter.tsx), [projection types](../src/types/projections.ts), [world bootstrap parser](../src/features/world/contracts.ts) | Current placeholder academic UI, known projection privacy warning, and allowlisted world-board presentation |
| [Instructor setup](../src/features/instructor/sessions.tsx), [classroom session list](../src/features/instructor/classroom-sessions.tsx), [student selection](../src/features/student/session-selection.tsx), [classroom flow report](classroom-session-role-flow.md) | Existing classroom-centered discovery, role/team controls, admission and lifecycle seams; some remain uncommitted working-tree changes |
| [Browser acceptance](../e2e/honeyville.spec.ts), [live acceptance opt-in](../e2e/world-live.spec.ts), [presence tests](../tests/world-presence.test.ts), [scene-owner tests](../tests/world-lifecycle.test.tsx) | What deterministic browser/unit tests cover and what still requires a live environment |

The adjacent backend checkout was also reviewed: `docs/bee-world-architecture-proposal.md`, `docs/bee-world-presence-v1.md`, `docs/bee-world-backend-audit.md`, `src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketModel.cs`, and the current classroom workflow. These establish the existing team/round model and older proposals; they are not a verified academic specification for the proposed Nectar Market experience. Coordinated permanent educational foundations, the revised Batch 4A proposal, and a new approved academic scenario specification were not located in the checked-out documentation during this audit. Their absence here does not substitute for backend-team approval or imply they cannot be in preparation elsewhere.

The product owner reports initial manual student testing of session entry and Honeyville exploration. This is useful evidence of basic usability. It does not establish fair economic gameplay, accessibility, a 30-student live capacity, reliable reconnection under classroom load, or parity between world and direct academic access.

## 3. Honeyville review and fairness findings

No movement-based economic reward or production mechanic was found in the current Honeyville implementation. Movement updates go through the dedicated presence adapter; facility panels do not submit economic actions. The session workspace submits separately through the authenticated academic service. This is a sound foundation, but it is not yet a complete dual-access educational experience.

| Existing or proposed interaction | Finding and educational risk | Required direction for a later approved batch |
|---|---|---|
| Local movement, collision, camera and remote bee interpolation | Immersive presentation; no economic-state write was found in the scene. Faster movement presently affects exploration convenience. | Preserve; never use speed, distance, time exploring or successful collision navigation as evidence of learning or entitlement. |
| Facility inspection requires entering a local zone; the guide lists facilities without direct inspection controls | Proximity currently gates informational panels. The market board can contain released indicators, so users who cannot navigate do not yet have a demonstrated equivalent presentation of that information. An academic advantage has not been measured, but this is a parity gap. | Provide a direct institution/information directory and the same released board data in the academic workspace. Optional visiting may add atmosphere, not exclusive economically useful information. |
| Future proposals to require presence, proximity, a controlling lease, or arriving at a building before submitting | Would make essential access depend on movement, networking and hardware. | Reject for essential academic actions; revise Batch 4A accordingly. Server permission, model, period and disclosure checks still apply to both routes. |
| Current generic JSON action editor | Requires technical JSON knowledge and exposes action codes rather than a guided academic decision form. Constraints and objectives are not developed into usable student guidance. | Replace only in approved Batch 4B with verified action-specific forms; do not invent their economics now. |
| Current action selection and submission state | The action list filters phases, but the selected action is retained independently; the submit control does not fully express pause/closure/freshness eligibility. Submission uses the first recovered assignment, which needs action-capability mapping review when multiple assignments exist. Backend rejection is not a sufficient final student experience. | Use a shared eligibility resolver over approved role/capability/phase/constraint data. Reset or reconcile stale selections; make closure and recoverable errors understandable. No frontend permission bypass. |
| Each current submit attempt constructs a fresh idempotency key | The client correctly avoids automatic retry after an ambiguous network failure, but a later manual attempt with a different key is not proven equivalent to retrying the same logical decision. Repeated clicks could produce multiple distinct requests if backend policy permits. | Require verified submission identity, acknowledgment recovery, replacement and order-count rules. Retain one identity for an approved retry of the same unchanged logical submission; do not blindly retry with a new key. Idempotency is not an academic quota policy. |
| Price-sorted orders in the current CompetitiveMarket implementation | Price ordering is visible in source; fair handling of equal-price orders, multiple orders, revisions and arrival timing has not been approved for this academic scenario. Do not infer a neutral allocation policy merely because the simulation is round-based. | Academic/backend owners must verify permutation/tie cases, order limits and repeat submissions. No first-click opportunity or scoring advantage; do not introduce a frontend matching algorithm. |
| Available team/role slots can become full | Early access or low latency could affect role choice. Choosing a role is not itself a measure of academic merit, and desirable roles may differ in information and responsibility. | Teaching policy must define fair role allocation and accommodations before assessed use. Instructor assignment is already available; reservation, rotation or allocation algorithms need approval rather than a new frontend competition. |
| Limited information and raw history | `MarketWorkspace` remains a placeholder. Generic history is not an individual reasoning record or a verified analytical comparison. | Build a clear Observe–Reflect workspace after the approved specification. Do not present missing objectives, feedback or predictions as available features. |
| A submitted account and team result can be identified | Identity records an operation; team economic success cannot establish each member's reasoning or contribution. | Keep provenance and learning evaluation separate; do not grade from presence, clicking, role selection or submission counts. |
| Wealth, motion, visits or online-time leaderboards and avatar upgrades | Not current functionality; would undermine the stated educational basis if introduced as primary achievement measures. | Exclude from academic ranking and economic advantage. Any future assessment requires a separate approved rubric, privacy policy and evidence model. |

There is no approval here for first-come academic opportunities, per-click resources, personal purchases or inventories, reflex tasks, persistent personal profits, continuous transactions, or traversal-based deadlines. Direct mode must not receive an inferior decision window, slower information release, fewer authorized tools, or fewer opportunities than world mode.

## 4. Proposed dual-navigation structure

The classroom remains the entry point. Existing membership, session selection and role setup are reused. For an authorized game run, the proposed primary navigation is **Decision workspace**, **Information and analysis**, **Outcomes and reflection**, with **Explore Honeyville** as an optional companion. These are information-architecture labels, not new server states or finalized route/DTO names.

```text
Classroom → available session/game → authorized academic session context
                                      ├─ Direct academic navigation ────────┐
                                      └─ Optional Honeyville institution ──┤
                                                                         ↓
                                                Same React academic panel/form
                                                Same role + period + constraints
                                                Same submission service + identity
                                                Same acknowledgment and recovery
                                                Same backend model and release policy
```

An instructor's requested topic-session hierarchy remains a separate backend dependency: the present backend binds a session to one scenario game. This alignment does not implement topic containers, relabel database entities as if that migration had happened, or require that unrelated hierarchy change to replace the existing navigation.

### Route-equivalence requirements

- The existing `/student/sessions/:sessionId` is the direct academic entry seam; `/student/sessions/:sessionId/world` remains optional exploration. A future page may deep-link to an authorized academic panel without loading Phaser. Do not finalize new URL parameters before the integration design is approved.
- World prompts and direct navigation resolve the same approved activity identifier into the same React feature. A facility label alone cannot establish an activity or capability.
- Use one form owner and one logical submission state per active activity. Opening the same activity from the other route must not create a second order, discard an unsent decision without notice, reset an acknowledged state, or erase the student's reasoning. Draft ownership and any persistence need an approved policy.
- Eligibility must come from current authenticated academic state, not `bridge.presence.controlled`, canvas readiness, position, world bootstrap success, or a facility visit.
- React panels remain keyboard- and screen-reader-accessible. A direct information table must contain all authorized information conveyed by a chart, world condition or hover treatment that matters to the exercise.
- World actions never execute from a Phaser movement callback. React uses the existing service seam or an approved versioned extension; the renderer emits optional presentation intent only.
- Entry source may support usability diagnostics under an approved telemetry policy; it must not change allocation, price, grades, permissions or treatment of the decision.

## 5. Future student decision workspace information architecture

The educational cycle is a presentation framework. It must not replace or invent backend lifecycle phases. The manifest and approved academic specification determine which activities are currently possible.

| Cycle | Student-facing information and interaction | Current seam and missing dependencies |
|---|---|---|
| **Observe** | Scenario and purpose; decision period; role/team scope; objectives; authorized information; constraints; instructor notices; status/freshness | Recovery already supplies model, round, phase, assignments, actions and some constraints. Academic objectives, pedagogical explanations, deadlines and announcements require verified content/contracts; do not assume a notice feed exists. |
| **Analyze** | Relevant variables, cost/benefit schedules, approved graphs, prior released observations and decision alternatives | Current visible state and released board are starting points, not complete academic analysis tools. Private information, formula meaning, units, graph inputs and release policy must be approved. |
| **Decide** | A readable supported-action form; legal options and units; proposed decision; conditional reasoning, assumptions, expectations and individual recommendation fields | Existing generic action submission can be reused. Reasoning/recommendation storage, ownership and editable fields are not authorized merely by adding controls; omit unsupported activities or label their absence plainly. |
| **Execute** | Unsubmitted form state; validation; submitted/acknowledged identity; cutoff/closed state; revision policy; waiting for instructor/model processing | Existing submissions and explicit instructor execution are distinct. Deadlines, replacement semantics, shared-team visibility and unknown-outcome recovery need verified contracts. Do not imply instantaneous clearing. |
| **Experience** | Released model outcomes, appropriately scoped team/public results, descriptive graphs, textual economic explanations, optional approved world feedback | Use backend-released results and a reviewed visual mapping. No reveal of unreleased or private detail through animation. No personal profit claim from a team outcome. |
| **Reflect and adapt** | Previous decisions, preserved expectations, actual released outcomes, explicit differences, instructor feedback, and preparation for the next period | Generic event history is insufficient by itself. Structured history, individual attribution, private feedback and comparison semantics need backend support. Do not manufacture a prediction history after outcomes are known. |

### Proposed page order

1. **Academic context and status:** scenario, role, current period/phase, objective summary, and distinct network/availability indicators. Provide a prominent route back to the classroom and an optional Explore link.
2. **Information needed for this decision:** authorized observations, units, source/release period, relevant constraints and availability explanations. Critical information must not depend on scrolling around the map.
3. **Analysis:** approved tables and charts, with a text/table equivalent and a clear distinction between what is known, assumed, predicted, or not disclosed.
4. **Your work:** supported decision controls and, only when approved, personal reasoning and expectations. Explain whether this is an individual recommendation, a team decision, or another specifically authorized contribution.
5. **Submission review and status:** what will be submitted, for which team/role/period, followed by server acknowledgment and recovery controls. Show teammate submission status only if the backend grants it; current recovery is not assumed to expose the complete team's work.
6. **Released outcomes and reflection:** prior results and feedback appropriate to the current release phase. Do not put essential current decisions behind an outcome animation or debrief screen.

Unavailable information should have an honest explanation such as not yet released or not supported, when the backend/content policy can distinguish it. Do not replace an unavailable value with zero, a random demonstration, or a guessed scenario objective. Decorative sections may be omitted so the primary task stays clear.

### Submission communication and integrity

Proposed UI messages must be mapped to actual approved states; they are not a new wire-status enum:

| Situation | Required communication and behavior |
|---|---|
| Editing | “Not submitted” or the approved saved-draft status. Distinguish form editing from a session whose lifecycle status is Draft. Do not claim server persistence without acknowledgment. |
| Validation failure | Identify the relevant field, approved units/bounds and recoverable reason without losing the student's work. Backend validation remains final. |
| Sending | Prevent duplicate activation of this logical submission and preserve its identity. Do not lock unrelated reading tools or require an animation. |
| Acknowledged | Show the authoritative submission identity/status and period. Say that submission is recorded, not that an outcome has executed. |
| Timeout or ambiguous transport failure | Say that confirmation is unavailable. Recover authorized status before declaring success, failure or attempting a duplicate; follow the approved idempotency policy. |
| Period closed, paused or access changed | Explain the authoritative condition. A displayed client countdown cannot grant extra time or override the server. Preserve only the work that an approved retention/access policy permits. |
| Waiting for execution or release | Distinguish instructor closure, model processing, unreleased outcomes and released results if the backend exposes those distinctions. Do not invent processing progress or immediate market transactions. |

Deadlines, if introduced, must use server-provided timing and a common approved decision window. Reminders cannot reward reacting faster, hide essential information until late in the period, or make stronger hardware economically advantageous. Accommodations, extensions, late submissions and fair tie/order handling require backend and teaching policy, not a local timer workaround.

## 6. Reuse of current navigation and instructor features

| Existing feature | Preserve and extend only when approved |
|---|---|
| Classroom membership, classroom/session discovery and role setup | Keep the existing admission boundary and classroom-centered navigation. Students must not requalify by reaching a facility. Address first-choice role scarcity through approved teaching policy. |
| Session recovery, query scopes and `/hubs/sessions` invalidations | Reuse for academic freshness and lifecycle. Add approved data to established recovery/service boundaries rather than a second simulation state inside the scene. |
| Generic action service and current submissions | Retain backend authorization and transport handling; later replace raw JSON UX with approved action forms and explicit acknowledgment/recovery. |
| Instructor setup and runtime | Bring role assignment, readiness, period state and released analysis into a coherent teaching workflow. Only enable controls supported by current capabilities and lifecycle. |
| Start, pause, resume, phase advancement and explicit execution | Keep distinctions visible. A student submitting or marking ready must not be represented as automatically executing or releasing the model. Replace free-text phase entry only after verified legal transitions are available to the UI. |
| Existing authoring and compatible world binding | Preserve frozen model/scenario versions. Present learning objectives, initial conditions, shocks or release controls only when their existing or approved contracts actually support them; do not assume live editing exists. |
| History and existing model adapters | Add reviewed analysis incrementally. Preserve current release/privacy boundaries; avoid rebuilding classroom, auth, SignalR or simulation infrastructure for the workspace. |

The future instructor academic control environment should help a professor observe participation, close a decision period, execute/release a model outcome and lead a debrief. Individual reasoning review, feedback, learning evaluation, replay and policy experiments are conditional extensions, not buttons to display as functional now. Presence counts describe connected transports/actors, not attendance quality or intellectual participation.

## 7. Institutions and model-driven world feedback

The current map contains the first six institutions below. Their IDs and positions are already data-driven; no relocation, new building or collision change is proposed in this batch. “Candidate academic connection” means a future reviewed mapping, not a current capability grant.

| Institution and current location | Current implementation | Candidate academic connection and guardrail |
|---|---|---|
| Honey Market — `market.hall` at (768, 640) | Informational panel and allowlisted released round/price/quantity/unmatched indicators | Candidate market information and approved bid/ask/prediction workspace entry. Every essential value and action must also be available directly. No claim of a universal clearing-price formula until reviewed. |
| Production Factory — `production.factory` at (1504, 960) | Static building and explanatory panel; visiting creates no output | Candidate producer-role information or seller decision entry. Do not infer physical production, marginal cost schedules, inventory, employment or individual profit merely from a seller role. |
| Residential Hive — `residential.hive` at (512, 992) | Community context; no personal account, inventory or housing allocation | Candidate consumer/buyer context and authorized schedules. Do not invent household wallets, purchases or welfare. |
| Government Building — `government.hall` at (1280, 640) | Institutional context; visiting grants no policy capability | Candidate policy information/decisions only for supported scenarios and authorized roles. A building is not evidence of a functioning macroeconomic, tax or monetary-control interface. |
| Public Square — `public.square` at (1024, 848) | Arrival, orientation and decorative fountain | Candidate accessible orientation and approved public announcements. It cannot be the only place to read an essential announcement or meet a decision deadline. |
| Nectar Field — `nectar.field` at (576, 384) | Decorative ecological setting; no modeled resource collection | Candidate explanation of an approved model-defined shock. No harvesting, drought consequence, replenishment or resource balance unless the model and release contract actually supply it. |
| Central Bank, Investment Center, Research Institute, International Trading Port / foreign civilizations | Not present as these institutions in the six-facility map | Future capability-driven additions only. A government role does not imply a central bank; a market does not imply international trade, investment accounts or research upgrades. Asset/location/navigation work needs separate authorization. |

An academic institution should be presented as active, informational, unavailable or not supported according to approved model/capability metadata. The current implementation does not yet provide a general authoritative institution-activation contract. Do not derive one from static map names or capability-like strings. Existing decorative buildings may remain visible with clear informational treatment even when a scenario does not activate them.

### Rules for future outcome visualization

- Every economically meaningful effect needs a documented released source field, model/version, period, visibility scope, units and reviewed interpretation. The mapping must remain correct if the student never opens the map.
- Verified modeled production might drive factory activity only in a model that represents production. Shortages or unsold supply may receive a restrained market indicator only after their field definitions are approved; unmatched orders do not establish persistent physical stockpiles.
- Drought visuals require model-defined drought information. A changed honey price alone is not inflation; idle bees or factories are not unemployment; decorative crates are not a persistent inventory.
- Do not generate arbitrary economic random events, fake market movement, celebratory profit rewards or a losing-team environment for visual drama.
- Session-wide presence and team-private economic projections have different scopes. Keep private React overlays local; do not broadcast private information through avatar badges, shared textures, synchronized effects or public institution states.
- Reduced motion must retain the same information in text, tables and static indicators. Decorations such as the current fountain and wing animation carry no authoritative economic meaning.

## 8. Analysis, individual learning and difficulty

Graphs must identify what each series represents: historical released values, current released values, student-entered expectations, approved model predictions, actual outcomes, or explicitly illustrative material. Show period, units, scope and source/availability. Missing observations are not zero; an unreleased outcome must not be reconstructed from a private payload simply because it reached the client.

Demand/supply curves, equilibrium markers, marginal-cost schedules, production functions, time series and expectation/outcome comparisons are candidates. Which are appropriate depends on the approved model and academic level. Do not fit an authoritative curve to a single reported price/quantity pair, reproduce model equations in chart code, or infer economic welfare from an attractive shape. Clearly separate any approved example/illustration from live simulation results, and keep it out of actual result summaries.

The current CompetitiveMarket projection types and backend audit flag possible disclosure of valuation/cost details through `lastResult`. Academic meaning of reported price and welfare measures also needs review. Do not expand those fields into public charts or learning claims before the backend/academic owners resolve disclosure and mathematical semantics. Existing board allowlists are a starting safeguard, not certification of every indicator's academic meaning.

Future individual recommendations, assumptions and expectations should precede collective decisions when the approved exercise calls for that sequence. Preserve distinctions between who authored reasoning, who recommended a choice, who submitted a team action, and which team/market outcome resulted. Any comparison or evaluation needs versioned evidence and an approved rubric; submission attribution and successful team outcomes alone are insufficient. Do not equate a model prediction action with an existing private individual-reasoning or feedback service.

Guided learning may add approved explanations, structured prompts and introductory graphs. Applied economics may reduce scaffolding and emphasize role-specific reasoning. Advanced experimentation may expose more assumptions, uncertainty and sophisticated analysis where authorized. These are pedagogical presentation modes, not client-side permission switches; do not decide confidential disclosure or grading policy independently.

## 9. Essential participation when the world is unavailable

The current direct workspace does not mount the Phaser scene and can be visited independently. Honeyville already has a Return to session link and renderer retry/error handling. This establishes useful separation, not yet a polished or fully tested accessible economic fallback: the current market adapter is a placeholder and the action editor is generic.

The target degradation behavior for later approved implementation is:

| Condition | Academic behavior | Optional world behavior |
|---|---|---|
| Renderer import, WebGL, canvas or asset failure | Keep/open the direct academic workspace when authorized state and decision services work. Do not require a world retry before submitting. | Explain the failure, offer optional retry and preserve direct navigation. Isolate unexpected scene exceptions as well as known asset errors. |
| `/hubs/world` failure, absent peers, expired movement presence or another tab owns movement | Continue academic work through independent academic authorization/services. A movement lease is not submission authority. | Show a subtle presence/observer state; recover snapshots and discard stale actors/poses using the existing adapter. |
| World geometry/protocol mismatch or world bootstrap unavailable | Disable the incompatible spatial presentation as necessary, while independently validating academic model/action contracts. Do not make a geometry hash an academic prerequisite. | No fabricated map compatibility or economic fallback values. Explain map-specific unavailability. |
| Session SignalR disconnected but authenticated HTTP recovery/submission works | Explain that live updates are delayed. Recover current authorized state before acting as required by the approved freshness policy; allow legitimate HTTP participation rather than treating socket loss as universal service loss. | Presence can be available or unavailable independently. Do not label both transports as one unexplained “offline” condition. |
| Pause, closure or period transition | Enforce current server academic eligibility and clearly distinguish reading from editing/submitting. Do not assume a paused avatar means every academic activity is forbidden, or vice versa. | Preserve current pause/movement behavior; optional exploration does not reopen a decision period. |
| Ambiguous academic submission response | Recover the authoritative submission, retain the approved logical identity and show unconfirmed status. Do not report acceptance or execute locally. | Renderer/presence recovery must not create or resend a decision. |
| Academic API unavailable or fully offline | Explain that authoritative participation cannot be confirmed. Do not promise offline execution or secretly queue decisions. Draft retention, if approved, must be labeled and must not replay into a new/closed period. | Static exploration is optional and must not imply the economic session is live. |
| Authentication expired, membership revoked, role/team changed or session terminated | Reauthorize and clear inaccessible state. A cached form, working world socket or local draft cannot confer permission. Completed-session review is subject to authorized history/release rules. | Retain existing revocation/cleanup; remove private panels and sprites as required. |

The design should keep an accessible academic navigation control available before engine loading, through recoverable renderer errors, and during reconnect. Draft/form survival across route changes and unexpected renderer failure needs an explicit ownership/retention design, not a second stateful action form inside the canvas.

## 10. Remaining Batch 3B assurance work

All measurements and test counts in the older reports are historical evidence, not rerun or newly certified by this documentation task. The reported manual student trial supplements that evidence; it does not close the following concerns.

### Live testing and connection states

- The historical Batch 3B report records 161 unit/React tests and 16 browser tests with one real-backend test skipped. The later classroom-flow report records 175 tests and 15 functional browser checks. Those suites cover specific mocked/unit behavior; they are not proof of live gameplay correctness or present source validation.
- Run the existing opt-in live test with two real authorized accounts and a compatible running session. It covers seeing another actor move and one offline/reconnect cycle. Add role/team changes, removal, completion, pause/resume, controller-tab loss/takeover, restart/new epoch, long stalls and repeated reconnect cycles to the live matrix.
- Exercise about 20–30 real transports with representative browsers, database authorization reads, proxy conditions and slow clients. The presence store's documented single-API-instance ownership remains an operational constraint; sticky sessions or a backplane alone are not proof of shared state correctness.
- Separately test loss of the world socket, session socket, renderer, world bootstrap and academic HTTP service. Verify that “multiplayer unavailable” does not become “decision service unavailable” by inference, and that revoked/stale access never continues as authorized.
- Existing snapshot fencing, bounded event buffers, 100ms movement attempts, reconciliation, stale-roster cleanup and disposal should remain regression-tested. They do not establish academic submission deduplication, fairness, deadlines or recovery.

### Accessibility and usability

- Complete an end-to-end keyboard-only and screen-reader exercise through the direct route, with the world absent. Test labels, validation associations, logical tab order, status announcements, submission confirmation, data tables and chart alternatives.
- Audit facility panels' nonmodal/modal semantics and focus behavior; current inspection focuses Close and dismissal focuses the canvas. The direct academic flow needs return-to-origin focus, not an automatic canvas focus when the user came from direct navigation.
- Campus users must not need a hover, color distinction or spatial interpretation to understand essential information. Existing bee/team hover labels and canvas name labels are presentation, not an accessible academic roster or an evaluation signal.
- Test responsive layouts, zoom/reflow, contrast, long translated/academic labels, visible focus, touch alternatives and reduced motion. Existing responsive browser checks are not a complete accessibility audit.
- Test ordinary low-power laptops and assistive-technology/browser combinations. Ensure heavy world work cannot monopolize the main thread or delay form input and authoritative status feedback; provide optional direct-only use.

### Performance evidence and limits

The checked-in [30-bee metrics](bee-world-batch-3b/rendering-metrics.json) report **23.69 FPS**, **48.7ms p95 frame interval** and approximately **43.4MB used JS heap**. The [one-bee baseline](bee-world-batch-3b/baseline-metrics.json) reports **26.12 FPS**, **48.5ms p95** and approximately **31.6MB heap**. Conditions were a five-second Vite-development sample on Windows, Intel i5-11400H/12 logical processors, about 16GiB RAM, headless Edge 157, 1500×1120 viewport and SwiftShader software rendering. The moving sample delivered 1,276 scripted actor events across 44 batches; it was not a backend throughput test.

These measurements do not demonstrate ordinary GPU performance, long-term memory stability, classroom network capacity or an acceptable academic interaction latency. Profile production builds, named ordinary hardware, real network load, long sessions, teardown and reconnect storms. Record frame intervals and academic input/submission latency separately, plus CPU, heap/retention, traffic, server/database cost and cleanup. Add pooling only if profiling identifies allocation churn; existing sprites are reused between updates. Any performance target is a proposed acceptance target for review, not a claim already achieved or a condition for access to learning.

## 11. Preliminary future Batch 4B integration proposal

**Not authorized to implement yet.** The objective is the first academically approved, team-based, round-based Honeyville Nectar Market experience, accessed equally through direct navigation and optional institutions. Its academic question concerns how decentralized decisions determine prices, quantities, allocation and welfare; exact objectives and any supported welfare interpretation must come from the verified specification.

### Approval gates and dependencies

| Dependency | Evidence required before final integration design or coding |
|---|---|
| Backend permanent educational foundations | Written agreement on movement-independent participation, no speed advantage, privacy, individual/team distinctions and failure isolation; resolve conflicts with old proximity proposals. |
| Academic scenario specification | Approved learning objectives, intended student level, assumptions, team/role responsibilities, available information, decision alternatives, constraints, period structure, debrief prompts and explanation of model limitations. |
| Revised Batch 4A proposal and implementation | Reviewed scope followed by implemented, versioned consumer contracts and verified lifecycle/authorization behavior. A proposal or endpoint name alone is insufficient. |
| CompetitiveMarket capability/math verification | Supported actions, price/quantity meanings, synthetic-agent behavior, order/tie/allocation rules, order counts/revisions, policy/shock behavior, release semantics and reference cases. Resolve price/welfare/privacy concerns before showing authoritative learning graphs or effects. |
| Submission and shared-team semantics | Who may submit which decision, how individual recommendations differ, quotas/replacements, idempotency, concurrency/versioning, acknowledgment recovery, audit provenance and fair treatment of equal decisions regardless of UI path or arrival order. |
| Academic lifecycle and timing | Actual allowed phases/transitions, participant versus round readiness, pause/close behavior, deadlines/extensions if any, execution and release states, and reconnection/late-submission policy. No invented server timing or automatic execution. |
| Information disclosure and projections | Field definitions, units/precision, role/team/public scope, release points, history accessibility and known leakage fixes. A public world effect needs a public-approved source; a team result must not be mislabeled a shared 30-student market. |
| Activity/institution presentation binding | Verified relationship between scenario capabilities, supported academic activities, approved forms and optional institution entry points. Model/world compatibility must not make a renderer necessary to submit. No independent frontend gameplay DTO. |
| Reasoning, expectations and feedback | If in initial scope: explicit per-person/team ownership, creation timing, edits, retention, visibility, comparison, consent/access policy and private evaluation contracts. Otherwise defer these capabilities visibly and narrow scope. |
| Graphs and analytical aids | Approved source data and academic interpretation; reference labels/examples; any calculator authorization and limitations. Illustrations stay separate from actual outcomes. |
| Error, recovery and testing contracts | Stable documented errors, authorization/revocation cases, unknown-outcome recovery, retry identities, examples/fixtures and real-backend acceptance accounts/environment. |

The currently known bid, ask and market-prediction action names are existing capabilities to verify, not permission to turn them into a new individual economy. No personal wallets, inventories, producer profits, continuous trades, production loop, scoring or leaderboard belongs in this proposal.

### Conditional frontend work packages

1. **Contract reconciliation and acceptance plan:** compare the approved Batch 4A artifacts with the source, record versions and gaps, and settle a capability-to-activity mapping with academic/backend owners. Stop unsupported portions rather than inventing payloads or formulas.
2. **Shared academic feature:** evolve the existing direct workspace into the approved Observe/Analyze/Decide/Execute presentation. Reuse auth, queries, scoped session context and submission services. Introduce verified action forms, eligibility, understandable status and safe recovery; keep initial scope limited to supported activities.
3. **Equivalent navigation:** have approved world institution prompts open that same React feature; add direct academic/institution access without travel. Ensure one logical draft/submission owner and identical authorization, information, timing and outcomes for both entry paths.
4. **Released analysis and optional world feedback:** add only approved tables, charts, explanations and descriptive effects. Keep calculations authoritative, privacy scopes intact and all essential information accessible without animation or the map.
5. **Reflection and instructor teaching controls:** expose only implemented history/feedback and lifecycle controls. Separate individual learning evidence from team outcomes. Defer unavailable recommendations/evaluations instead of fabricating them.
6. **Verification and rollout review:** run contract, accessibility, equivalence, recovery, privacy, live scenario and ordinary-hardware tests; present concrete evidence to academic/backend/frontend owners before enabling the experience in assessed use.

### Proposed acceptance checks for that later batch

- Two equally authorized students making the same allowed decision through different entry paths have the same information, validation and submission/execution semantics. Neither path requires an avatar lease, movement, a facility visit or a working renderer.
- The complete approved exercise is possible by keyboard and screen reader through direct navigation, including reading outcomes and required reflection where supported.
- Disabling Phaser, breaking its assets, denying world bootstrap, or dropping `/hubs/world` does not prevent otherwise-authorized HTTP academic work. Loss of academic authorization still blocks both routes.
- Phase/pause/closure changes invalidate eligibility in both entry paths. Route changes, repeated activation, multiple tabs and ambiguous responses cannot create unapproved duplicate decisions or replay work into another period.
- Backend reference tests establish fair order/count/tie behavior; varying movement, rendering speed, click rate, request order or UI entry path does not produce an unapproved academic advantage. The UI does not claim a fairness guarantee that the model has not verified.
- Authorized information has matching direct text/table access; private data never appears in shared world visuals. No illustrative graph, personal expectation or unreleased result is presented as an authoritative model outcome.
- Student expectations, individual reasoning, team submissions and released outcomes retain their approved distinctions. No personal learning score is inferred from submitting, visiting or being online.
- Real-backend classroom acceptance, ordinary-laptop profiling, long-session recovery, teardown and assistive-technology testing are documented separately from mocked browser tests. Existing simulation, classroom and multiplayer regressions remain intact.

## 12. Alignment completion and change control

This document completes the requested principles, implementation review, fairness audit, dual navigation proposal, decision-workspace information architecture, instructor/session reuse plan, institution review, failure-continuity design, Batch 3B concern register, preliminary Batch 4B proposal and backend/academic dependency list.

Only this Markdown file is added by the alignment task. No gameplay contracts have been finalized; no Batch 4B implementation, model calculation, new institution or mechanic is introduced. Existing pending work is reviewed as evidence and preserved. Validation for this task is document/source review, local-link and coverage checks, and verification that existing file contents remain unchanged; it is not a fresh build, accessibility certification, performance run or live gameplay test.
