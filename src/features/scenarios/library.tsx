import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useAuth, useRuntime } from "../../app/runtime";
import {
  BackgroundStatus,
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/states";
import { keys } from "../../lib/api/query";
import { scenarioDiscovery } from "./discovery";
import type {
  AuthoringModelSummary,
  PublishedScenarioVersionSummary,
  ScenarioSummary,
  SimulationDefinitionSummary,
} from "../../types/discovery";
import type { MacroScenarioContent } from "../../types/short-run-macro";
import type { CompetitiveMarketScenarioContent } from "../../types/competitive-market";
import { blankMacro } from "../short-run-macro/authoring";
import { blankMarket } from "../competitive-market/authoring";
import { macroAuthoring, marketAuthoring } from "./service";
import { courseService } from "../courses/service";
import { Pagination } from "../instructor/classrooms";
import { resolveScenarioUiState, scenarioDraftRoute } from "./ui-state";

type Model = "Economics.ShortRunMacro" | "Economics.CompetitiveMarket";
type StatusFilter = "Active" | "Ready" | "Drafts" | "Archived";

const statusLabels: Record<StatusFilter, string> = {
  Active: "Active scenarios",
  Ready: "Ready to use",
  Drafts: "Drafts",
  Archived: "Archived",
};

const modelLabel = (id: string) => {
  if (id === "Economics.ShortRunMacro") return "Short-Run Macroeconomics";
  if (id === "Economics.CompetitiveMarket") return "Competitive Market";
  return id;
};

function summarizeScenario(scenario: ScenarioSummary): string[] {
  const points: string[] = [];
  if (scenario.maximumRounds) points.push(`${scenario.maximumRounds} rounds`);
  return points;
}

function toRouteModel(modelIdentifier: string): "macro" | "market" {
  return modelIdentifier.endsWith("ShortRunMacro") ? "macro" : "market";
}

function modelDescription(model: Model): string {
  if (model === "Economics.ShortRunMacro") {
    return "Students manage growth, inflation, unemployment, and economic policy.";
  }
  return "Students participate in markets, pricing, buying, and selling.";
}

function templateFallbackTitle(code: string): string {
  return code
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function compatibleDefinition(
  definitions: SimulationDefinitionSummary[],
  model: Model,
): SimulationDefinitionSummary | null {
  return (
    definitions.find((x) => x.authorableModelIdentifiers.includes(model)) ??
    null
  );
}

function statusQueryParams(filter: StatusFilter): {
  status?: "Draft" | "Published" | "Archived";
  includeArchived?: boolean;
} {
  if (filter === "Ready") return { status: "Published" };
  if (filter === "Drafts") return { status: "Draft" };
  if (filter === "Archived") return { status: "Archived" };
  return { includeArchived: false };
}

export function ScenarioLibraryPage() {
  const { api } = useRuntime();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const status = (params.get("show") ?? "Active") as StatusFilter;
  const model = (params.get("model") ?? "") as Model | "";
  const search = params.get("search") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const classroomId = params.get("launchFor") ?? "";

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };

  const scenarioParams = statusQueryParams(
    statusLabels[status] ? status : "Active",
  );

  const scenarios = useQuery({
    queryKey: keys.scenarioLists(
      user!.id,
      scenarioParams.status ?? "Active",
      model,
      search,
      page,
      25,
    ),
    queryFn: ({ signal }) =>
      scenarioDiscovery(api).scenarios(
        {
          ...scenarioParams,
          modelIdentifier: model || undefined,
          search: search || undefined,
          page,
          pageSize: 25,
        },
        signal,
      ),
  });

  const models = useQuery({
    queryKey: ["authoring-models"],
    queryFn: ({ signal }) => scenarioDiscovery(api).models(signal),
  });

  const discoveredModels =
    models.data?.filter(
      (x: AuthoringModelSummary) => x.scenarioAuthoringSupported,
    ) ?? [];

  const hasFilter =
    search.trim().length > 0 || model.length > 0 || status !== "Active";

  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Scenarios</p>
        <h1>{classroomId ? "Choose a scenario" : "Scenario library"}</h1>
        <p>
          {classroomId
            ? "Pick a ready-to-use scenario for this classroom."
            : "Create, prepare, and launch simulations for your classes."}
        </p>
        <Link className="button-link" to="/instructor/scenarios/create">
          Create Scenario
        </Link>
        <Link className="button-link secondary" to="/instructor/scenarios/ai/new">
          Create with AI
        </Link>
      </header>

      <section className="library-toolbar" aria-label="Scenario filters">
        <div className="input-row">
          <label className="sr-only" htmlFor="scenario-search">
            Search scenarios
          </label>
          <input
            id="scenario-search"
            value={search}
            onChange={(e) => setFilter("search", e.target.value)}
            placeholder="Search scenarios..."
          />
          <label className="sr-only" htmlFor="scenario-show">
            Filter by status
          </label>
          <select
            id="scenario-show"
            value={statusLabels[status] ? status : "Active"}
            onChange={(e) => setFilter("show", e.target.value)}
          >
            <option value="Active">Active scenarios</option>
            <option value="Ready">Ready to use</option>
            <option value="Drafts">Drafts</option>
            <option value="Archived">Archived</option>
          </select>
          <label className="sr-only" htmlFor="scenario-model">
            Filter by simulation type
          </label>
          <select
            id="scenario-model"
            value={model}
            onChange={(e) => setFilter("model", e.target.value)}
          >
            <option value="">All simulation types</option>
            {discoveredModels.map((x) => (
              <option key={`${x.identifier}:${x.version}`} value={x.identifier}>
                {x.displayName}
              </option>
            ))}
          </select>
        </div>
      </section>

      {models.isError && <ErrorState error={models.error} />}

      <section>
        <div className="section-heading">
          <h2>{statusLabels[status] ?? statusLabels.Active}</h2>
          <BackgroundStatus active={scenarios.isFetching} />
        </div>

        {scenarios.isPending ? (
          <LoadingState label="Loading scenarios" />
        ) : scenarios.isError ? (
          <ErrorState
            error={scenarios.error}
            retry={() => void scenarios.refetch()}
          />
        ) : scenarios.data.items.length === 0 ? (
          <EmptyState
            title={
              hasFilter
                ? "No scenarios match these filters"
                : "You haven't created a scenario yet."
            }
          >
            <p>
              {hasFilter
                ? "Try adjusting your search or filters."
                : "Scenarios describe the situation your students will work through during a simulation."}
            </p>
            {!hasFilter && (
              <p>
                <Link to="/instructor/scenarios/create">
                  Create Your First Scenario
                </Link>
              </p>
            )}
          </EmptyState>
        ) : (
          <>
            <div className="card-grid">
              {scenarios.data.items.map((scenario) => (
                <ScenarioCard
                  classroomId={classroomId}
                  scenario={scenario}
                  key={scenario.scenarioId}
                />
              ))}
            </div>
            <Pagination
              page={scenarios.data.page}
              pageSize={scenarios.data.pageSize}
              total={scenarios.data.totalCount}
              onPage={(next) => setFilter("page", String(next))}
            />
          </>
        )}
      </section>
    </>
  );
}

function ScenarioCard({
  scenario,
  classroomId,
}: {
  scenario: ScenarioSummary;
  classroomId: string;
}) {
  const state = resolveScenarioUiState(scenario);
  const teachingMetadata = summarizeScenario(scenario);
  const primaryHref = classroomId
    ? `${state.primaryHref}${state.primaryHref.includes("?") ? "&" : "?"}classroomId=${encodeURIComponent(classroomId)}`
    : state.primaryHref;

  return (
    <article className="card scenario-card compact">
      <div className="scenario-card-head">
        <p className="eyebrow">{modelLabel(scenario.modelIdentifier)}</p>
        <span className={`scenario-status ${state.teachingStatus}`}>
          {state.badgeLabel}
        </span>
      </div>

      <h3>{scenario.title}</h3>
      {scenario.summary && <p>{scenario.summary}</p>}

      {state.helperLabel && <p className="muted">{state.helperLabel}</p>}

      {teachingMetadata.length > 0 && (
        <p className="muted">{teachingMetadata.join(" • ")}</p>
      )}
      <p className="muted">
        Updated {new Date(scenario.updatedAt).toLocaleDateString()}
      </p>

      <div className="button-row">
        <Link to={primaryHref}>{state.primaryActionLabel}</Link>
        {state.secondaryActionLabel && state.secondaryHref && (
          <Link className="secondary" to={state.secondaryHref}>
            {state.secondaryActionLabel}
          </Link>
        )}

        <details className="actions-menu">
          <summary>...</summary>
          <div className="actions-panel">
            {scenario.publishedVersionId && (
              <Link
                to={`/instructor/scenarios/${scenario.scenarioId}/versions`}
              >
                View version history
              </Link>
            )}
            {scenario.lifecycleStatus !== "Draft" && (
              <Link to={scenarioDraftRoute(scenario)}>Continue Editing</Link>
            )}
            {scenario.lifecycleStatus === "Draft" && (
              <Link to={scenarioDraftRoute(scenario)}>
                Duplicate from editor
              </Link>
            )}
          </div>
        </details>
      </div>
    </article>
  );
}

export function ScenarioVersionHistoryPage() {
  const { api } = useRuntime();
  const { user } = useAuth();
  const { scenarioId } = useParams();
  const id = scenarioId!;
  const q = useQuery({
    queryKey: keys.scenarioVersions(user!.id, id),
    queryFn: ({ signal }) => scenarioDiscovery(api).versions(id, signal),
  });

  if (q.isPending) return <LoadingState label="Loading version history" />;
  if (q.isError)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;

  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Version history</p>
        <h1>Published versions</h1>
        <p>Review past published versions of this scenario.</p>
      </header>

      {q.data.length === 0 ? (
        <EmptyState title="No published versions">
          <p>This scenario has not been published yet.</p>
        </EmptyState>
      ) : (
        <div className="card-grid">
          {q.data.map((v) => (
            <article className="card" key={v.publishedVersionId}>
              <p className="eyebrow">
                {v.isLatest
                  ? "Current version"
                  : `Version ${v.scenarioVersionNumber}`}
              </p>
              <h2>{v.title}</h2>
              <p>{modelLabel(v.modelIdentifier)}</p>
              <p>Published {new Date(v.publishedAt).toLocaleDateString()}</p>
              <Link
                to={`/instructor/scenarios/versions/${v.publishedVersionId}`}
              >
                View scenario details
              </Link>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

export function PublishedVersionPage() {
  const { api } = useRuntime();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { versionId } = useParams();
  const [searchParams] = useSearchParams();

  const q = useQuery({
    queryKey: keys.publishedVersion(user!.id, versionId!),
    queryFn: ({ signal }) => scenarioDiscovery(api).version(versionId!, signal),
  });

  const classrooms = useQuery({
    queryKey: keys.classrooms(user!.id, 1, 100),
    queryFn: ({ signal }) => courseService(api).classrooms(1, 100, signal),
  });

  const [chosenClassroom, setChosenClassroom] = useState(
    searchParams.get("classroomId") ?? "",
  );

  const launch = useMutation({
    mutationFn: () =>
      courseService(api).createSession(
        chosenClassroom,
        { scenarioVersionId: versionId!, seed: 1 },
        crypto.randomUUID(),
      ),
    onSuccess: (result) => navigate(`/instructor/sessions/${result.id}/setup`),
  });

  if (q.isPending || classrooms.isPending)
    return <LoadingState label="Loading scenario details" />;
  if (q.isError)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  if (classrooms.isError)
    return (
      <ErrorState
        error={classrooms.error}
        retry={() => void classrooms.refetch()}
      />
    );

  const v: PublishedScenarioVersionSummary = q.data;

  return (
    <>
      <header className="page-heading">
        <Link to="/instructor/scenarios">Back to Scenarios</Link>
        <p className="eyebrow scenario-status published">Ready to use</p>
        <h1>{v.title}</h1>
        <p>{modelLabel(v.modelIdentifier)}</p>
      </header>

      <section className="card">
        <p>
          This published scenario is locked so simulations always use the
          version you prepared.
        </p>
        <p>Published {new Date(v.publishedAt).toLocaleDateString()}</p>
      </section>

      {v.launchable ? (
        <section className="card">
          <h2>Use in Class</h2>
          <p>Choose the classroom where this scenario will run.</p>

          <label htmlFor="launch-classroom">Classroom</label>
          <select
            id="launch-classroom"
            value={chosenClassroom}
            onChange={(e) => setChosenClassroom(e.target.value)}
          >
            <option value="">Choose a classroom</option>
            {classrooms.data.items.map((classroom) => (
              <option key={classroom.classroomId} value={classroom.classroomId}>
                {classroom.name}
              </option>
            ))}
          </select>

          <p className="muted">Students will join using a session code.</p>

          <div className="button-row">
            <Link className="secondary" to="/instructor/scenarios">
              Cancel
            </Link>
            <button
              type="button"
              onClick={() => launch.mutate()}
              disabled={!chosenClassroom || launch.isPending}
            >
              {launch.isPending ? "Opening Session..." : "Open Session"}
            </button>
          </div>

          {!chosenClassroom && (
            <p className="field-help">
              Choose a classroom to open this session.
            </p>
          )}
          {launch.error && <ErrorState error={launch.error} />}
        </section>
      ) : (
        <section className="card">
          <h2>Not ready to launch</h2>
          <p>
            {v.launchabilityReason ??
              "This scenario is not currently launchable."}
          </p>
        </section>
      )}
    </>
  );
}

export function CreateScenarioPage() {
  const { api } = useRuntime();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [model, setModel] = useState<Model>(
    (searchParams.get("model") as Model) || "Economics.ShortRunMacro",
  );
  const [templateCode, setTemplateCode] = useState(
    searchParams.get("template") || "",
  );
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");

  const models = useQuery({
    queryKey: ["authoring-models"],
    queryFn: ({ signal }) => scenarioDiscovery(api).models(signal),
  });

  const definitions = useQuery({
    queryKey: ["definitions"],
    queryFn: ({ signal }) => scenarioDiscovery(api).definitions(signal),
  });

  const templates = useQuery({
    queryKey: ["scenario-templates", model],
    queryFn: ({ signal }) => scenarioDiscovery(api).templates(model, signal),
  });

  const macroContent = useQuery({
    queryKey: ["authoring-content-templates", "macro"],
    queryFn: ({ signal }) => macroAuthoring(api).templates(signal),
  });

  const marketContent = useQuery({
    queryKey: ["authoring-content-templates", "market"],
    queryFn: ({ signal }) => marketAuthoring(api).templates(signal),
  });

  const supportedModels = useMemo(
    () => models.data?.filter((x) => x.scenarioAuthoringSupported) ?? [],
    [models.data],
  );

  const definition = useMemo(
    () => compatibleDefinition(definitions.data ?? [], model),
    [definitions.data, model],
  );

  const create = useMutation({
    mutationFn: async () => {
      if (!definition)
        throw new Error(
          "No compatible workspace is available for this simulation type.",
        );
      if (!name.trim()) throw new Error("Scenario name is required.");

      const selectedTemplate = templateCode.trim();

      if (model === "Economics.ShortRunMacro") {
        const service = macroAuthoring(api);
        const base = selectedTemplate
          ? (macroContent.data?.find((x) => x.code === selectedTemplate)
              ?.content ?? blankMacro())
          : blankMacro();

        const content: MacroScenarioContent = {
          ...base,
          briefing: summary.trim() || base.briefing,
        };

        const draft = await service.create(
          service.prepareCreate({
            simulationDefinitionId: definition.id,
            name: name.trim(),
            content,
          }),
        );

        return { model: "macro", id: draft.document.id };
      }

      const service = marketAuthoring(api);
      const base = selectedTemplate
        ? (marketContent.data?.find((x) => x.code === selectedTemplate)
            ?.content ?? blankMarket())
        : blankMarket();

      const content: CompetitiveMarketScenarioContent = {
        ...base,
        briefing: summary.trim() || base.briefing,
      };

      const draft = await service.create(
        service.prepareCreate({
          simulationDefinitionId: definition.id,
          name: name.trim(),
          content,
        }),
      );

      return { model: "market", id: draft.document.id };
    },
    onSuccess: (result) =>
      navigate(`/instructor/scenarios/${result.model}/${result.id}`),
  });

  if (
    models.isPending ||
    definitions.isPending ||
    templates.isPending ||
    macroContent.isPending ||
    marketContent.isPending
  ) {
    return <LoadingState label="Loading scenario setup" />;
  }

  if (models.isError)
    return (
      <ErrorState error={models.error} retry={() => void models.refetch()} />
    );
  if (definitions.isError)
    return (
      <ErrorState
        error={definitions.error}
        retry={() => void definitions.refetch()}
      />
    );
  if (templates.isError)
    return (
      <ErrorState
        error={templates.error}
        retry={() => void templates.refetch()}
      />
    );
  if (macroContent.isError)
    return (
      <ErrorState
        error={macroContent.error}
        retry={() => void macroContent.refetch()}
      />
    );
  if (marketContent.isError)
    return (
      <ErrorState
        error={marketContent.error}
        retry={() => void marketContent.refetch()}
      />
    );

  const contentTemplates =
    model === "Economics.ShortRunMacro"
      ? macroContent.data
      : marketContent.data;

  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Create a Scenario</p>
        <h1>Create a Scenario</h1>
        <p>
          Choose a simulation type, pick a starting point, and create your
          draft.
        </p>
      </header>

      <section className="card">
        <h2>1. Choose a simulation type</h2>
        <div className="card-grid">
          {supportedModels.map((candidate: AuthoringModelSummary) => {
            const selected = candidate.identifier === model;
            return (
              <article
                className="card"
                key={`${candidate.identifier}:${candidate.version}`}
              >
                <h3>{candidate.displayName}</h3>
                <p>{modelDescription(candidate.identifier as Model)}</p>
                <button
                  type="button"
                  className={selected ? "" : "secondary"}
                  onClick={() => {
                    setModel(candidate.identifier as Model);
                    setTemplateCode("");
                  }}
                >
                  {selected ? "Selected" : "Choose"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>2. How would you like to start?</h2>
        {templates.data.length === 0 ? (
          <p className="muted">
            No recommended templates are available right now for this simulation
            type.
          </p>
        ) : (
          <div className="card-grid">
            {templates.data.map((template) => (
              <article className="card" key={template.templateIdentifier}>
                <h3>
                  {template.title ||
                    templateFallbackTitle(template.templateIdentifier)}
                </h3>
                <p>
                  {template.description ||
                    template.learningPurposeSummary ||
                    "Recommended starting point."}
                </p>
                <button
                  type="button"
                  className={
                    templateCode === template.templateIdentifier
                      ? ""
                      : "secondary"
                  }
                  onClick={() => setTemplateCode(template.templateIdentifier)}
                >
                  {templateCode === template.templateIdentifier
                    ? "Selected template"
                    : "Use Template"}
                </button>
              </article>
            ))}
          </div>
        )}

        <div className="button-row">
          <button
            type="button"
            className={templateCode === "" ? "" : "secondary"}
            onClick={() => setTemplateCode("")}
          >
            Start from scratch
          </button>
        </div>
      </section>

      <section className="card">
        <h2>3. Name your scenario</h2>
        <label htmlFor="scenario-name">Scenario name</label>
        <input
          id="scenario-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Stagflation Crisis"
        />

        <label htmlFor="scenario-summary">Short description (optional)</label>
        <textarea
          id="scenario-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Students manage an economy experiencing high inflation and weak growth."
        />

        <p className="field-help">
          Simulation definitions are resolved automatically in the background.
        </p>

        {definition ? (
          <button
            type="button"
            disabled={create.isPending || !name.trim()}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Creating Scenario..." : "Create Scenario"}
          </button>
        ) : (
          <p className="notice">
            No compatible workspace was found for this simulation type.
          </p>
        )}
        {create.error && <ErrorState error={create.error} />}
      </section>

      <section className="card">
        <h2>Selected starting point</h2>
        <p>
          {templateCode
            ? (contentTemplates.find((x) => x.code === templateCode)?.name ??
              templateFallbackTitle(templateCode))
            : "Start from scratch"}
        </p>
      </section>
    </>
  );
}
