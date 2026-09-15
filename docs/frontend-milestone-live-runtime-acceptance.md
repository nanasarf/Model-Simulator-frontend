# Live runtime acceptance milestone

This milestone validates the existing classroom-to-runtime path against a running backend. It is intentionally an acceptance artifact, not another state-management layer.

## Manual browser path

1. Sign in as an Instructor and open **Classrooms**.
2. Open a real classroom, verify the server roster and existing sessions.
3. Open a launchable published ShortRunMacro scenario and launch it for that classroom.
4. In setup, create a team, assign roster participants, and assign roles from the frozen manifest.
5. Rename the team, repeat the same request with the same `Idempotency-Key` (no duplicate change), then reuse that key with a different name (Problem Details `idempotency.conflict`).
6. Open setup in a second instructor tab, perform a correction in the first tab, and submit the stale version from the second tab. Verify `concurrency.conflict`, authoritative refetch, and preserved unsaved input.
7. Confirm readiness blockers disable Start. Resolve them through backend setup operations, start the session, and verify navigation to `/simulation/{sessionId}`.
8. Sign in as an assigned Student in a separate browser profile. Open **My Sessions**, select the session, and verify recovery shows the server model/version, team, role, capabilities, phase, round, readiness, permitted actions, and visible state.
9. Refresh the student runtime. The same recovery projection must be restored without manual IDs.
10. Force a SignalR disconnect/reconnect (or temporarily stop the websocket) and verify the UI enters reconnecting/disconnected states, then refetches authoritative state after reconnection.
11. Verify Instructor pause/resume changes server state and is reflected in the Student runtime.
12. Verify a Student cannot recover another student's session/private submission or invoke an unauthorized action.
13. Submit an authorized ShortRunMacro action, refresh, and verify the submission is recovered from the backend. The ShortRunMacro adapter must render only the authorized projection.

## Automated smoke runner

`node scripts/live-runtime-acceptance.mjs` runs authenticated HTTP checks when configured with `API_ORIGIN`, `INSTRUCTOR_EMAIL`, `INSTRUCTOR_PASSWORD`, `STUDENT_EMAIL`, and `STUDENT_PASSWORD`. Optional `SESSION_ID`, `TEAM_ID`, `STUDENT_ID`, and `ASSIGNMENT_ID` enable correction replay/conflict checks against an existing draft session. The runner never fabricates IDs or state; absent values are reported as skipped.

The browser portion remains manual until Playwright (or an equivalent browser runner) is available.
