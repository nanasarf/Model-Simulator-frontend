# Classroom-centered sessions and roles

Implemented frontend flow, 2026-11-14. Backend source was inspected; this change adds no backend endpoints, persistence model, migrations or economic logic.

## Intended teaching structure

A classroom is the main home for its approved students. Inside it, the instructor wants named topic sessions such as Supply and Demand, International Trade, and Comparative Advantage. Scenarios are games played within those topic sessions. A student joins the classroom once, enters an available session, then chooses a role or receives an instructor assignment for that game.

## Frontend behavior now available

- Instructor classroom pages list only that classroom’s sessions, with **Add a session**, **Assign student roles**, and **Open session** links.
- Scenario selection started from a classroom carries its classroom ID to the existing published-scenario launch form. Retired session-code instructions were removed.
- Setup links return to the classroom. Instructors create teams and explicitly open or close entry for classroom members.
- Joined participants appear in the role panel, including students still needing a team. Instructors can assign teams and available scenario roles. Role capacity is scoped per team; another participant’s full role is disabled.
- Student navigation includes **My Classrooms**. A classroom page checks membership before requesting its sessions, then displays joinable games and sessions the student has already entered.
- Joining an available session uses the existing classroom-member admission endpoint, without a session code or another approval request.
- The student waiting room lets an active participant select a team and role through self-service endpoints. Full teams and taken roles are disabled; the student’s own current role stays selectable. Changing teams clears role/readiness according to the server response.
- Authoritative lobby recovery updates instructor-assigned roles, rejected selections, and changing capacity. Lobby/setup/classroom-session queries refresh periodically; existing session invalidation refreshes the waiting room as well.
- The instructor runtime also links to role management. Selection and instructor assignment are locked outside Draft, matching existing backend lifecycle checks. Roles are game permissions, never changes to Student/Instructor account grants.

The current backend requires a student to enter the selected session before an instructor can put that student on a team or assign a role. Classroom enrollment alone is not a session participant record. The frontend shows this distinction and does not impersonate student joins or assign a classroom-wide economic role.

## Existing contracts used

Verified in backend `ClassroomEndpoints.cs`, `WorkflowContracts.cs`, `EfClassroomWorkflow.cs`, and `EfClassroomWorkflow.Lobby.cs`:

| Purpose | Existing endpoint |
|---|---|
| Instructor classroom session list | `GET /api/v1/sessions?classroomId=…` |
| Student’s approved classrooms | `GET /api/v1/me/classrooms` |
| Member-visible sessions | `GET /api/v1/classrooms/{classroomId}/sessions` |
| Scenario-backed game creation | `POST /api/v1/classrooms/{classroomId}/sessions` |
| Instructor setup / role templates | `GET /api/v1/sessions/{sessionId}/setup` |
| Open / close entry | `POST /api/v1/sessions/{sessionId}/open` or `/close` |
| Student entry | `POST /api/v1/sessions/{sessionId}/join` |
| Lobby / available teams and role slots | `GET /api/v1/sessions/{sessionId}/lobby` |
| Student team selection | `PUT /api/v1/sessions/{sessionId}/participants/me/team` with `{teamId}` |
| Student role selection | `PUT /api/v1/sessions/{sessionId}/participants/me/role` with `{roleCode}` |
| Instructor team assignment | Existing team member/move endpoints |
| Instructor role assignment | `POST /api/v1/sessions/{sessionId}/role-assignments` with `{teamId,userId,roleCode}` |

`SessionLobbyView` and its nested public records are transcribed into frontend types. `isOpen`/`isReadOnly` on instructor setup come from the actual setup projection. Student lobby data is user/session scoped and uses student-authorized APIs; it does not request the instructor setup/console.

## Backend work still required for the full topic hierarchy

The current persistent session is one game run bound to exactly one frozen `ScenarioVersionId` and session manifest. It has no independent topic title and no collection of scenario games beneath it. Existing `Course` is a parent of classroom in the current database; it is not the topic-session entity described above.

To represent the intended hierarchy honestly, the backend needs to define and expose:

1. A classroom-owned, named topic session (for example International Trade), independent from a particular frozen scenario version.
2. One or more game runs under each topic session, each retaining its own scenario version, participants, team roles, readiness, lifecycle, results and world-presence scope.
3. Authorized topic/game discovery and management contracts for instructors and approved classroom members, plus a migration/compatibility plan for existing one-scenario sessions.
4. A clear policy for whether roles can be provisionally assigned before a student enters a game. The current `AddTeamMemberAsync` explicitly rejects non-admitted participants, and `AssignRoleAsync` requires an active participant on that team.

No topic title, multi-game grouping or role assignment is fabricated in browser storage. Until backend support lands, **Add a session** creates one scenario-backed game through the existing API. Multiple games under one named topic session remain unavailable.

An additional source-level consistency issue needs backend review: student `SelectRoleAsync` resets participant readiness, whereas instructor `AssignRoleAsync` currently does not. The frontend displays server-authoritative readiness and does not pretend this was changed. Assignment while Running/Paused is rejected by the existing Draft-only contract, so the UI locks those controls.

## Validation

New automated coverage checks student team/role selection, exact request bodies, full teams/roles, preserved current roles, server rejection recovery, instructor-driven recovery, membership checks, classroom-scoped discovery, instructor assignment, admission opening, and post-launch locking. Existing admission, runtime isolation, creation, Honeyville and simulation tests are retained.

`e2e/classroom-roles.spec.ts` runs real React/SignalR clients in two independent Edge contexts: classroom member enters, chooses Buyer, instructor reassigns Seller, both views converge. It uses deterministic HTTP/WebSocket fixtures, not a live backend, and does not establish live classroom compatibility. Screenshots are written to `test-results/classroom-instructor-roles.png` and `test-results/classroom-student-roles.png` during that test.

Final validation:

| Check | Result |
|---|---|
| `npm run build` | Passed: TypeScript and Vite production build |
| `npm test` | 175 passed across 20 files |
| Functional browser regression, excluding the two existing rendering benchmarks | 15 passed, 1 live-backend test skipped; zero failed |
| Focused two-context classroom/role acceptance after final keyboard-focus change | Passed |
| Scoped Git whitespace check | Passed |

The browser suite uses headless Edge and deterministic API/SignalR fixtures; live classroom verification still needs a running compatible backend and real test accounts. Existing SignalR annotation and bundle-size warnings remain. No test-only behavior is included in production services, and earlier Batch 3B performance evidence was not regenerated by this change.
