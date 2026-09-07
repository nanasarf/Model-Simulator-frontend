# Frontend Milestone 1 architecture

## Status and contract authority

The foundation and scenario discovery integration are implemented. Active-session model routing, capability recovery, round-readiness recovery, and prior-submission recovery remain dependent on the documented runtime transport. Full gameplay remains out of scope.

The supplied workspace file [`frontend-handoff`](../../frontend-handoff) was read completely before implementation. The adjacent backend checkout was inspected at commit `35f885be3069b3cfb25fe8e0d8725cefe8eeedd8`. Where source and handoff differ, the frontend preserves the source transport shape and explicitly records the mismatch below. No economic calculations or client-derived permissions compensate for missing backend information.

The handoff recommends OpenAPI generation. The configured Development URL is `http://localhost:5070/swagger/v1/swagger.json`; no server was listening during implementation. A complete usable response schema could therefore not be verified. Transport types were transcribed from backend records and projection serializers. `scripts/snapshot-contracts.mjs` is a deliberately narrow, fail-on-unknown-type source snapshot utility for the inspected positional model records, not a general C# or OpenAPI generator. The committed output builds without requiring backend source. To review a new backend revision:

```powershell
node scripts/snapshot-contracts.mjs <backend-checkout>
npm run build
npm test
```

Review serializer options, enum converter attributes, endpoint behavior, and projection dictionaries separately. The source utility cannot establish security semantics or decide whether a payload is suitable for students.

## Structure

The starting repository contained only a README, with no selected framework. The app uses React, TypeScript in strict mode, Vite, React Router, TanStack Query, and the Microsoft SignalR client.

| Location | Responsibility |
| --- | --- |
| `src/app` | Runtime dependency construction, routing, authenticated responsive shell, styling |
| `src/components` | Loading, background-update, empty, error, conflict states and error boundary |
| `src/features/auth` | Sign-in, registration, route gates and forbidden UX |
| `src/features/courses` | Documented provisioning service; no invented discovery routes |
| `src/features/scenarios` | Typed authoring/template service and versioned saves |
| `src/features/sessions` | Generic REST recovery/history and existing-session entry |
| `src/features/instructor` | Instructor home, template catalog, separately gated console/download services |
| `src/features/student` | Minimal student home and session entry |
| `src/features/simulation` | Generic active-session context, recovery coordinator, model registry |
| `src/features/short-run-macro` | Typed macro placeholder and actual macro capability constants |
| `src/features/competitive-market` | Typed market placeholder and actual market capability constants |
| `src/lib/api` | Central transport, query identities, versioned-save helper, binary download helper |
| `src/lib/auth` | Token vault, claim-derived user state, auth lifecycle |
| `src/lib/signalr` | Dedicated session connection lifecycle and event subscriptions |
| `src/lib/permissions`, `errors`, `idempotency` | Reusable cross-cutting infrastructure |
| `src/types` | Separate platform, auth, scenario, session, projection, analytics/replay, macro and market contracts |

Generic session context contains no macro indicators, market prices, private values, assessments, or model calculations. `visibleState` remains the actual JSON transport value until model identity can authorize a specific typed interpretation.

## API integration

`ApiClient` is the only fetch implementation. Feature services supply documented paths and typed bodies/results. It supports JSON, request cancellation, access-token attachment, a single retry after an explicit authenticated 401, anonymous auth operations, RFC Problem Details, and authenticated CSV/binary responses. No component implements token or fetch logic.

`VITE_API_ORIGIN` is an optional backend origin, with no `/api/v1` suffix. The default uses same-origin `/api/v1` and `/hubs/sessions`. Vite proxies these paths to `API_PROXY_TARGET`, defaulting to the backend launch profile's `http://localhost:5070`. Production must serve the built assets with SPA fallback and reverse-proxy these two paths, including WebSocket upgrades. The inspected backend does not configure CORS; same-origin deployment avoids relying on unimplemented cross-origin support. Use HTTPS in production. Do not embed server secrets in `VITE_*` variables.

Requests use `credentials: omit`: the backend uses JSON tokens, not cookies. The transport does not invent ETags, If-Match, refresh cookies, trace endpoints, or lifecycle idempotency headers. Scenario discovery sends only its documented page/filter parameters. RFC Problem Details `traceId` is preserved; traceparent/correlation response headers are fallback support references. The backend generates its own `HttpContext.TraceIdentifier`; there is no documented client correlation-header contract to invent.

CSV downloads share the authenticated transport and 401 behavior. `saveDownload` creates and revokes a temporary object URL and uses a caller-provided filename because the backend does not provide one.

## Authentication and user state

The backend issues `{ accessToken, refreshToken, accessTokenExpiresAt }` in JSON. `AuthSession` owns tokens and the centralized state: `loading`, `anonymous`, `authenticated`, or `expired`. The current user contains only the JWT subject, issued platform roles, and returned access-token expiration. The backend does not issue email/display-name claims; the shell displays the subject identifier and platform roles instead.

The browser vault uses **sessionStorage**, scoped to the current tab, to preserve recovery across reloads without durable localStorage credentials. A JavaScript SPA cannot make a JSON refresh secret HttpOnly. Session storage remains script-readable; the backend would need a different documented auth model to improve this boundary. Tokens are never written to logs, query keys, URLs by app code, telemetry, or persistent query caches. SignalR itself uses the documented access-token query transport when required for WebSockets/SSE, so server/reverse-proxy logs must redact that transport parameter.

Startup rotates persisted refresh credentials once before exposing protected content. There is no invented `/me`. The returned JWT's `sub` and `http://schemas.microsoft.com/ws/2008/06/identity/claims/role` claims are read for display/navigation, matching `TokenService`. Decoding does not verify token authenticity; the backend refresh and subsequent authorized calls remain authoritative.

Before an authenticated request, an access token within 30 seconds of expiration is refreshed. An explicit API 401 triggers one refresh/retry; a concurrent request that already rotated tokens lets the rejected request retry using the newer access token. Refresh is single-flight per runtime. The retry reuses the serialized request body and logical idempotency key. No ambiguous network failure automatically retries a mutation. A second 401 invalidates the session without looping. Revoked/reused refresh tokens and changed security stamps are handled through the same backend invalid-token flow. Refresh failure, including an ambiguous network failure, clears local credentials: blindly retrying a rotated secret could revoke its family.

Logout waits for an in-flight rotation, sends the replacement refresh token to the documented logout endpoint, and clears local credentials even if server revocation cannot be confirmed. The login screen reports an unconfirmed server logout. User/role changes cancel and clear query caches, preventing a new identity or demoted role from receiving earlier cached instructor data.

Session storage may be copied by browser duplicate-tab behavior. Refresh coordination is per runtime, not cross-tab; independently opened tabs should sign in independently. A duplicated refresh family may be revoked by the backend's reuse detection and then correctly requires sign-in. Do not turn sessionStorage into shared localStorage without implementing a reviewed cross-tab rotation protocol.

Registration posts the documented email/password body and displays backend Identity validation. It creates a Student account, does not automatically enroll/join, and routes the user to sign-in after success. Password complexity remains backend-authoritative.

## Permissions and routes

`hasPlatformRole`, `isInstructor`, `hasCapability`, and `canPerform` provide UI availability only. Instructor policy includes `Instructor` and `PlatformAdministrator`, matching `Program.cs`. Student policy requires `Student`; administrators do not implicitly gain student action rights. Simulation role codes never grant platform access. Capability comparisons use backend capability names defined inside each model feature; unavailable grants fail closed.

Protected route groups: `/instructor`, `/instructor/scenarios`, `/instructor/sessions`, `/student`, `/student/sessions`, and `/simulation/:sessionId`. `/auth` and `/auth/register` are public. Initial protected rendering waits for authentication. Wrong-role navigation shows a forbidden page. Expired sessions redirect to sign-in with a restricted internal return path; external return URLs cannot be used. Resource 404s use wording compatible with intentionally hidden ownership failures.

Student recovery imports only the generic `/state` and `/history` service. Instructor consoles have a separate typed service that checks platform availability before issuing a request. Students never request instructor consoles and filter their results. No live control room or private-data display is implemented.

## Query/cache and recovery

`keys` defines identities for current-user (reserved; auth is an external store), authoring model discovery, instructor definitions, filtered/paged scenario lists, scenario/version metadata, templates, sessions, state/history, consoles, analytics, and replay. Scenario list keys include identity and every backend filter/page input. Server data lives in TanStack Query; auth and connection state do not duplicate query data.

Queries have a 15-second stale time, no automatic retry, and background refetch on window focus. Mutations never retry automatically. SignalR invalidation targets the current user's specific session prefix; it does not refetch the model catalog, other sessions, or scenarios. Active matching queries refetch; inactive matching projections are marked stale.

Opening `/simulation/{id}` fetches authorized state and then history, retaining the exact returned `version`. The generic context restores status, phase, round number, caller participant, team ID, assigned role codes, and **participant/pre-start readiness**. Missing model/capability/current-round readiness/prior-submission context is explicitly `null` as a frontend availability state, not appended to the transport DTO. No team names or model names are fabricated.

History is recovered and counted but not displayed as raw JSON. The current history endpoint is not a complete prior-submission projection; the frontend does not reconstruct hidden submissions from events.

Tab visibility restoration fetches fresh state/history. During disconnection the last recovered context remains visible with a textual stale/disconnected indication. Failed REST recovery is shown separately. No unverified economic projection is rendered while model identity is absent.

## SignalR

Hub path: `/hubs/sessions`, authenticated with `accessTokenFactory` from `AuthSession`. Every mounted session owns a dedicated connection. Automatic reconnect delays are 0, 2, 10 and 30 seconds. Initial or exhausted reconnect failures offer a manual Reconnect action. A transient hub failure does not clear authentication.

On initial connection and each reconnect: authenticate, invoke `JoinSession(sessionId)`, then refetch authoritative state and history. The UI only reports Connected after that sequence succeeds. There is no durable websocket event replay.

Subscriptions include documented notifications and source-confirmed lifecycle notifications: `SessionStateChanged`, `TeamChanged`, `ParticipantChanged`, `ActionSubmitted`, `ResultsAvailable`, `ParticipantJoined`, `RoleAssignmentChanged`, `ParticipantReadyChanged`, `RoundPhaseChanged`, `SessionPaused`, `SessionResumed`, `ActionSubmissionStatusChanged`. Notification payloads are not interpreted as authoritative state. Reconnect does not install handlers again; cleanup removes each handler and stops the connection. Stopping is necessary because the implemented `LeaveSession` removes only the session group, not the team group.

Connection state uses text as well as colored indicators: Connected, Reconnecting, Disconnected. Auth invalidation transitions to the explicit session-expired sign-in state. Live connections and cached protected content unmount at that boundary.

## Model UI registry

The registry resolves exact `identifier:version` keys to separate macro/market components:

- `Economics.ShortRunMacro:1.0.0`
- `Economics.CompetitiveMarket:1.0.0`

Each adapter accepts its model's typed authorized projection and displays a milestone placeholder. No phase-specific abstraction is introduced before full gameplay proves it necessary. The active session cannot call the registry yet: neither `/state` nor `/history` supplies model identity/version. The frontend deliberately does not inspect `quarter`/`round`, roles, private payloads, or URL hints to guess identity, and does not probe console endpoints to discover it. Registry resolution is tested independently; this is not equivalent to working live model routing.

## Errors, validation, idempotency and concurrency

`ApiProblem` normalizes HTTP status, type, title, detail, errorCode, fieldErrors and traceId. Actual domain codes appear in `title`, so the parser preserves them there and also exposes errorCode. Empty policy bodies and non-JSON errors are supported. Classification distinguishes validation, unauthenticated, unauthorized, missing/hidden resources, lifecycle, readiness, duplicate execution/resource, idempotency, concurrency, publication blockers, missing capability, and generic rule denial. A 404 does not reveal ownership. `rule.denied` does not reveal whether the failed condition was a submission limit; the UI cannot truthfully label it as one.

Forms use labeled email/password fields and required validation, and validate GUID syntax for the backend's `{id:guid}` routes. No guessed string limits, scoring logic, economics rules, readiness calculations, or publication checks are duplicated. Server field errors are rendered in an alert with support reference where supplied.

`logicalOperation` creates one immutable serialized body and UUID per user action. Supported names correspond only to action submission, macro/market draft creation or cloning, and macro comment creation. Network retries must reuse this same object. A new user action creates a new key. Do not mutate the body under the same key or automatically create a replacement after a conflict. Execution uses its documented body `executionId`, not an invented HTTP header. Other lifecycle endpoints receive no inferred idempotency header.

`saveVersioned` snapshots unsaved input and sends the original resource version through the endpoint's `expectedVersion` JSON field. On `concurrency.conflict`, it refetches the authoritative resource once and returns `{ kind: 'conflict', draft, authoritative }`. It preserves the draft even when refetch fails. The caller must explicitly review/merge and submit a new save. No newer backend state is overwritten automatically. The macro/market authoring services exercise this helper with `document.version`. Session `version` is retained for cache/context, but no unsupported version header/body field is added to lifecycle commands. Comment/draft version requirements follow the same shared strategy.

## Home surfaces and accessibility

Instructor home uses the live public model catalog and an existing-session entry. Scenarios uses the two authenticated template endpoints. Neither invents owned resources or metrics. Student home offers an existing-session ID entry and explains instructor provisioning; real participation/session status appears only after authorized recovery. There is no join code, self-join, fake collection, or invented list request.

The shell includes role-aware navigation, current account, sign-out, connection status and an error boundary. Responsive CSS covers desktop, tablet and phone. The student shell has fewer navigation links. Accessibility foundations include semantic landmarks/headings, skip link, visible focus, route focus, labeled forms, native validation, alert/status regions, minimum 44px targets, non-color-only states, overflow-safe IDs, and reduced-motion support. No third-party fonts or image requests are required.

## Confirmed backend/handoff mismatches and acceptance blockers

| Finding | Source evidence | Frontend behavior / remaining requirement |
| --- | --- | --- |
| Recovery lacks model identifier/version, manifest, capability grants, role-assignment IDs, round readiness, prior submissions | `Application/Classrooms/WorkflowContracts.cs`, `SessionRecoveryView`; `Infrastructure/Persistence/EfClassroomWorkflow.cs`, `RecoverAsync` | No invented fields. Show unavailable context; model routing and complete submission recovery are blocked until an authorized backend contract supplies it. |
| Instructor recovery is not full console state | `RecoverAsync` generates visible state only if the caller is a participant with a team/snapshot, using assigned capabilities; owners without a participant receive null | Separate console service exists; never assume Instructor implies a full recovery payload. |
| Macro projection example differs from actual JSON | `ShortRunMacroModel.GenerateVisibleStateAsync` emits `assessments`, `policyConflicts`, `causalExplanations`, `laggedEffect`, not an ordinary student `lastReport` object | Projection types mirror the serializer. Full `MacroState` is only the `MACRO_VIEW_ALL` branch. |
| Market projection exposes data broader than promised | `CompetitiveMarketModel.GenerateVisibleStateAsync` includes unfiltered `lastResult`; `MarketRoundResult.transactions` includes buyer valuations/seller costs; capability-gated `buyerInformation`/`sellerInformation` are whole state arrays | Private data is not displayed. This is a **backend confidentiality defect**; hiding it in UI does not secure the response. Must be fixed server-side before student gameplay. |
| Assessment dimension serialization is numeric | `MacroAssessmentDimension` and `MarketAssessmentDimension` lack `JsonStringEnumConverter`; inspected HTTP/local JSON options do not add it. Intensity/policy enums do have converter attributes | Numeric assessment union values are preserved in transport types; no silent conversion to the handoff's string enum names. Needs backend/handoff alignment. |
| Action error catalog differs | `Application/Actions/SubmitAction.cs` emits `capability.denied`, `action.phase_denied`, `action.unknown`, `team.forbidden`, `rule.denied` | Normalize implemented capability/phase codes as well as documented codes. Cannot distinguish generic rule failure from submission limit. |
| Additional readiness failures | `EfClassroomWorkflow` emits `session.not_ready`, `team.not_ready`, `round.not_ready` | Normalize as readiness conflicts. |
| Action event differs | `EfRuntimeStore.AddSubmissionAsync` publishes `ActionSubmissionStatusChanged`; workflow publishes participant/role/phase-specific names | Subscribe to source-confirmed names in addition to documented events. |
| Missing course/classroom/session lists and self-join are confirmed backend gaps | Handoff §§3, 8 and endpoint inventory | Scenario/definition/version/template discovery is now available; no course/classroom/session list or self-join workaround is invented. |
| OpenAPI/live server unavailable during verification | No listener at the launch-profile localhost:5070 URL | Build and HTTP/hub-fixture tests pass independently. Real authentication, authorization, refresh rotation and WebSocket handshake still require a running configured backend. |

The implementation does not assert that JWT validation or server initialization succeeds in a live environment; those need the smoke test below. Backend responsibilities remain outside this frontend milestone's modification scope.

## Verification and live follow-up

Run `npm ci`, `npm test`, and `npm run build`. Verification passed all 56 tests across six files and the production build with zero TypeScript errors. Tests cover successful/failed sign-in, expiration, refresh failure/rotation/single-flight, logout, route authorization and no protected flash, actual problem codes and validation fields, stable idempotency, versioned save/refetch with preserved drafts, targeted event invalidation, reconnect group/recovery ordering, duplicate-handler cleanup, typed registry resolution, routed session refresh/reconnect, and student endpoint separation.

Tests use transport fixtures only inside `tests/`; production code never falls back to mock data. Registry tests prove extension boundaries; they do not claim absent live model metadata is recovered. Build emits two harmless upstream SignalR/Rollup annotation warnings; there are no TypeScript errors.

Before accepting the complete milestone against a running backend:

1. Start the configured backend/database, then `npm run dev`. Sign in with provisioned Instructor and Student accounts.
2. Open an existing accessible session ID. Confirm real state/history and authenticated SignalR JoinSession. Try a wrong-role route and an unavailable session.
3. Allow access-token expiry; confirm a single refresh and rotated token. Revoke a refresh family/change security stamp server-side and confirm sign-in recovery without a loop.
4. Reload, hide/resume the tab, and interrupt/reconnect the network. Confirm authoritative phase/round/team/role return and listeners do not duplicate.
5. Resolve the backend model/capability/readiness/submission transport gaps and market privacy defect. Only then wire the active-session registry and verify both real model projections.

No full scenario authoring, gameplay controls, economics, analytics dashboards, replay visualizations, projector, LMS, or new backend endpoints are implemented.

## Milestone 2 scenario authoring

The Instructor Scenarios route now hosts the supported scenario-authoring workflow. Generic discovery supplies safe model metadata, owned definitions, filtered/paged Draft/Published/Archived collections, immutable published-version metadata, definition-level history, and template metadata. Creation selects an owned definition from discovery; typed model endpoints remain responsible for full template content and draft mutations.

The shared editor owns lifecycle/version presentation, explicit save state, dirty-page protection, validation, preview, publish confirmation, clone/archive actions, and conflict recovery. ShortRunMacro and CompetitiveMarket field editors remain separate modules. Validation and preview are backend-authoritative; publish requires a saved draft and a successful validation report with no blockers. Create/clone use stable logical idempotency operations, while edit/archive/publish send the returned draft version as `expectedVersion`. Published and archived documents are immutable in the UI.

See `docs/frontend-milestone-2-scenario-authoring.md` for editor sections, private-data boundaries, endpoint behavior, and the precise backend gaps.
