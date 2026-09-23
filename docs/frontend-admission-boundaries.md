# Admission component boundaries

Student admission presentation is being isolated into `ClassroomJoinCard`, `SessionJoinCard`, and `AdmissionStatusCard`. The existing Student Home still owns page layout and My Sessions recovery until the next admission-state pass.

Instructor session setup remains the coordinator for server setup data. Its next extraction seam is the session header/join-code card, participant panel, team controls, role controls, readiness, and launch controls. No server state is copied into local state by these boundaries.

`src/lib/errors/admission.ts` is the shared Problem Details extraction/mapping foundation. The legacy session join call is intentionally isolated in `SessionJoinCard` for replacement by the session request workflow.
