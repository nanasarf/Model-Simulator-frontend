# Frontend Milestone 2: scenario authoring

## Contract scope and discovery

Scenario authoring follows the backend handoff in `ModelSimulator-backend/docs/frontend-integration-handoff.md`. The requested frontend-local `docs/frontend-integration-handoff.md` is absent. No endpoint was inferred to compensate.

The backend discovery contract now supplies safe authoring models, owned definitions, filtered/paged Draft/Published/Archived collections, immutable published-version metadata, definition-level version history, and template metadata. The frontend does not accept owner IDs or use client-side pseudo-discovery. Creation selects a returned owned simulation definition; model identity is pinned on publication. Typed authoring endpoints remain responsible for full template content and draft mutations.

## Shared authoring shell

Macro and market drafts use one shell for title, lifecycle/version display, section navigation, explicit save state, validation, deterministic preview, publication, cloning, archiving, errors, and concurrency recovery. Model-specific fields live in their own feature modules and never enter generic scenario infrastructure.

The shell uses explicit saves. Local edits survive navigation among editor sections. Browser unload/reload is guarded while edits are dirty. A stale save preserves the local draft, fetches the current server document through the Milestone 1 concurrency helper, and requires explicit user review; it never resubmits with a newer version automatically.

Draft create and clone operations retain one idempotency key for the logical request. Update, archive, and publish send `expectedVersion` in the JSON body exactly as documented. Publish is disabled until the draft is saved and the latest backend validation says it is publishable with zero blockers. Publishing requires confirmation and makes the loaded editor immutable. Clone remains available for immutable versions. Archive confirmation states that frozen and historical sessions are unchanged.

## Model-specific editors

ShortRunMacro sections cover briefing and maximum quarters; learning goals; the six typed starting indicators with backend bounds; the four supported roles, their objectives, institutional-indicator visibility, four authorable actions, and three intensities; economic team objectives and assessment dimensions; the five implemented shock types; and discussion/debrief prompts.

CompetitiveMarket sections cover briefing and rounds; learning goals; aggregate demand/supply configuration; participant/unit counts; exact policy enum values and policy parameters; buyer, seller, and government roles; the three implemented actions; assessment dimensions; the four implemented shock types; role-private visibility; and teaching prompts. The UI explicitly states that private valuations/costs are model-generated, cannot be authored as arrays, and remain hidden from other students during gameplay.

## Validation and preview

Both editors call their model's backend `validate` endpoint. Blockers and warnings are separate, code and message are preserved, and stable issue-code categories can navigate to a relevant section. Human-readable messages are never parsed for routing. Preview calls the model-specific backend with a seed and renders only returned frame counts and diagnostics; no economic trajectory or clearing logic runs in the browser.

## Security and boundaries

Every scenario route remains inside the Instructor route gate. Ownership is enforced by the backend and intentionally hidden 404s remain undisclosed. Templates are cloned into owned drafts rather than edited. Public/student code imports no authoring service or instructor draft projection. Published and archived documents are not editable. No private market values, model coefficients, preview calculations, readiness rules, fake library rows, or unsupported lifecycle states are created client-side.
