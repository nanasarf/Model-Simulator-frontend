# Frontend Milestone 4: Live classroom runtime

The active session workspace now uses the documented runtime transport as its source of truth. It recovers `/state` and `/history`, reconnects SignalR with `JoinSession`, and refetches authoritative state after notifications, reconnects, and tab restoration.

Students can mark participant and current-round readiness. Instructors have guarded start, pause, resume, phase-advance, and exactly-once round-execution controls. Command responses are followed by state refetches; no local phase or result transitions are inferred.

The workspace provides filtered authorized event history, explicit connected/reconnecting/disconnected states, and preserves the last recovered context during transient outages. Published gameplay projection rendering remains model-specific and is intentionally not synthesized from generic state fields.

The handoff currently does not return model/version, capability grants, role-assignment IDs, current-round readiness, or prior-submission projections in `SessionRecoveryView`. Consequently the frontend does not invent action payload identity or expose model gameplay controls until those authoritative fields are available. Competitive-market private-data projection remains a backend confidentiality issue documented in `docs/frontend-architecture.md`.
