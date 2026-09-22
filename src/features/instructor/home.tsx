import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth, useRuntime } from "../../app/runtime";
import { keys } from "../../lib/api/query";
import { EmptyState, ErrorState, LoadingState } from "../../components/states";
import { courseService } from "../courses/service";
import { scenarioDiscovery } from "../scenarios/discovery";
import { resolveScenarioUiState } from "../scenarios/ui-state";
import type { ScenarioSummary } from "../../types/discovery";
import type { SessionSummary } from "../../types/classrooms";

const modelLabel = (id: string) => {
  if (id === "Economics.ShortRunMacro") return "Short-Run Macroeconomics";
  if (id === "Economics.CompetitiveMarket") return "Competitive Market";
  return "Simulation";
};

const toRouteModel = (modelIdentifier: string): "macro" | "market" =>
  modelIdentifier.endsWith("ShortRunMacro") ? "macro" : "market";

function sessionStateLabel(status: string): string {
  const lower = status.toLowerCase();
  if (lower === "draft" || lower === "lobby") return "Lobby open";
  if (lower === "active" || lower === "inprogress" || lower === "running")
    return "Live";
  if (lower === "paused") return "Paused";
  if (lower === "completed") return "Completed";
  return status;
}

function isLiveLike(status: string): boolean {
  const lower = status.toLowerCase();
  return (
    lower === "draft" ||
    lower === "lobby" ||
    lower === "active" ||
    lower === "inprogress" ||
    lower === "paused" ||
    lower === "running"
  );
}

function greetingForTime(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning, Professor.";
  if (hour < 18) return "Good afternoon, Professor.";
  return "Good evening, Professor.";
}

export function InstructorHome() {
  const { api } = useRuntime();
  const { user } = useAuth();

  const sessions = useQuery({
    queryKey: keys.sessionLists(user!.id, 1, 8, "", "", ""),
    queryFn: ({ signal }) =>
      courseService(api).sessions({ page: 1, pageSize: 8 }, signal),
  });

  const scenarios = useQuery({
    queryKey: keys.scenarioLists(user!.id, "Active", "", "", 1, 6),
    queryFn: ({ signal }) =>
      scenarioDiscovery(api).scenarios(
        { includeArchived: false, page: 1, pageSize: 6 },
        signal,
      ),
  });

  const classrooms = useQuery({
    queryKey: keys.classrooms(user!.id, 1, 1),
    queryFn: ({ signal }) => courseService(api).classrooms(1, 1, signal),
  });

  const liveSessions = useMemo(
    () =>
      (sessions.data?.items ?? []).filter((session) =>
        isLiveLike(session.status),
      ),
    [sessions.data?.items],
  );

  const joinCodeQueries = useQueries({
    queries: liveSessions.slice(0, 2).map((session) => ({
      queryKey: ["session", user!.id, session.sessionId, "join-code", "home"],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        courseService(api).joinCode(session.sessionId, signal),
      staleTime: 15_000,
      retry: false,
    })),
  });

  const recentScenarios = (scenarios.data?.items ?? []).slice(0, 4);
  const readyScenario = (scenarios.data?.items ?? []).find(
    (item) => resolveScenarioUiState(item).teachingStatus === "ready",
  );
  const draftScenario = (scenarios.data?.items ?? []).find(
    (item) => resolveScenarioUiState(item).teachingStatus === "draft",
  );
  const continueSession = liveSessions[0] ?? null;

  const continueCard = continueSession
    ? {
        type: "session" as const,
        title: continueSession.scenarioTitle,
        meta: `${sessionStateLabel(continueSession.status)}${continueSession.currentRound > 0 ? ` • Round ${continueSession.currentRound}` : ""}`,
        cta: "Open Session",
        href:
          continueSession.status.toLowerCase() === "draft"
            ? `/instructor/sessions/${continueSession.sessionId}/setup`
            : `/simulation/${continueSession.sessionId}`,
      }
    : readyScenario
      ? {
          type: "ready" as const,
          title: readyScenario.title,
          meta: `${resolveScenarioUiState(readyScenario).helperLabel ?? "Ready to use"}${readyScenario.launchabilityReason ? ` • ${readyScenario.launchabilityReason}` : ""}`,
          cta: "Use in Class",
          href: `/instructor/scenarios/versions/${readyScenario.publishedVersionId}`,
        }
      : draftScenario
        ? {
            type: "draft" as const,
            title: draftScenario.title,
            meta: `${resolveScenarioUiState(draftScenario).helperLabel ?? "Draft scenario"} • Last edited ${new Date(draftScenario.updatedAt).toLocaleString()}`,
            cta: "Continue Editing",
            href: `/instructor/scenarios/${toRouteModel(draftScenario.modelIdentifier)}/${draftScenario.draftId}`,
          }
        : null;

  if (sessions.isPending || scenarios.isPending || classrooms.isPending) {
    return <LoadingState label="Preparing your teaching workspace" />;
  }

  if (sessions.isError)
    return (
      <ErrorState
        error={sessions.error}
        retry={() => void sessions.refetch()}
      />
    );
  if (scenarios.isError)
    return (
      <ErrorState
        error={scenarios.error}
        retry={() => void scenarios.refetch()}
      />
    );
  if (classrooms.isError)
    return (
      <ErrorState
        error={classrooms.error}
        retry={() => void classrooms.refetch()}
      />
    );

  const hasAnyData =
    sessions.data.items.length > 0 || scenarios.data.items.length > 0;

  if (!hasAnyData) {
    return (
      <>
        <header className="page-heading instructor-hero">
          <p className="eyebrow">Instructor home</p>
          <h1>Welcome to Simulation Platform</h1>
          <p>Create your first classroom simulation in a few minutes.</p>
        </header>

        <section className="card empty-onboarding">
          <ol>
            <li>Choose a simulation type</li>
            <li>Prepare a scenario</li>
            <li>Launch it with a join code</li>
          </ol>
          <div className="button-row">
            <Link className="button-link" to="/instructor/scenarios/create">
              Create Your First Scenario
            </Link>
            <Link
              className="secondary button-link"
              to="/instructor/scenarios/create?template=baseline"
            >
              Explore a template
            </Link>
          </div>
        </section>
      </>
    );
  }

  return (
    <div className="instructor-home">
      <header className="page-heading instructor-hero">
        <p className="eyebrow">Instructor home</p>
        <h1>{greetingForTime()}</h1>
        <p>What would you like to simulate today?</p>
        <p className="muted">
          Create a scenario, launch a session, and bring your students into the
          simulation.
        </p>
        <p className="hero-facts">{classrooms.data.totalCount} classrooms</p>
      </header>

      <section className="primary-actions" aria-label="Primary actions">
        <Link
          className="card primary-action create"
          to="/instructor/scenarios/create"
        >
          <div>
            <p className="eyebrow">Primary</p>
            <h2>Create a Scenario</h2>
            <p>Build a new simulation or start from a template.</p>
          </div>
          <span className="action-arrow" aria-hidden="true">
            →
          </span>
        </Link>

        <Link
          className="card primary-action launch"
          to="/instructor/scenarios?show=Ready"
        >
          <div>
            <p className="eyebrow">Secondary</p>
            <h2>Launch a Simulation</h2>
            <p>
              Choose an existing scenario and create a live student session.
            </p>
          </div>
          <span className="action-arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </section>

      {continueCard && (
        <section>
          <div className="section-heading">
            <h2>Continue</h2>
          </div>
          <article className="card continue-card">
            <h3>{continueCard.title}</h3>
            <p>{continueCard.meta}</p>
            <Link to={continueCard.href}>{continueCard.cta}</Link>
          </article>
        </section>
      )}

      <section>
        <div className="section-heading">
          <h2>Live & Upcoming</h2>
        </div>

        {liveSessions.length === 0 ? (
          <EmptyState title="No live sessions right now">
            <p>
              Launch a simulation to open a lobby and share a join code with
              students.
            </p>
          </EmptyState>
        ) : (
          <div className="card-grid live-grid">
            {liveSessions.slice(0, 2).map((session, index) => {
              const join = joinCodeQueries[index];
              const joinCode = join?.data?.joinCode ?? null;
              return (
                <article
                  className="card live-session-card"
                  key={session.sessionId}
                >
                  <p className="live-pill">
                    <span className="live-dot" aria-hidden="true" />
                    {sessionStateLabel(session.status).toUpperCase()}
                  </p>
                  <h3>{session.scenarioTitle}</h3>
                  <p>{session.classroomName}</p>
                  <p className="muted">
                    Round {session.currentRound} • {session.currentPhase}
                  </p>
                  {joinCode && (
                    <p className="session-code">
                      Session code <strong>{joinCode}</strong>
                    </p>
                  )}
                  <Link
                    to={
                      session.status.toLowerCase() === "draft"
                        ? `/instructor/sessions/${session.sessionId}/setup`
                        : `/simulation/${session.sessionId}`
                    }
                  >
                    Open Session
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="section-heading">
          <h2>Recent Scenarios</h2>
        </div>
        {recentScenarios.length === 0 ? (
          <EmptyState title="No scenarios yet">
            <p>Create a scenario to prepare your next class simulation.</p>
          </EmptyState>
        ) : (
          <div className="card-grid recent-scenarios-grid">
            {recentScenarios.map((scenario) => {
              const state = resolveScenarioUiState(scenario);

              return (
                <article
                  className="card recent-scenario-card"
                  key={scenario.scenarioId}
                >
                  <h3>{scenario.title}</h3>
                  <p>{modelLabel(scenario.modelIdentifier)}</p>
                  <p className={`scenario-status ${state.teachingStatus}`}>
                    {state.badgeLabel}
                  </p>
                  {state.helperLabel && (
                    <p className="muted">{state.helperLabel}</p>
                  )}
                  <div className="button-row">
                    <Link to={state.primaryHref}>
                      {state.primaryActionLabel}
                    </Link>
                    {state.secondaryActionLabel && state.secondaryHref && (
                      <Link className="secondary" to={state.secondaryHref}>
                        {state.secondaryActionLabel}
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <p>
          <Link to="/instructor/scenarios">View all scenarios →</Link>
        </p>
      </section>
    </div>
  );
}
