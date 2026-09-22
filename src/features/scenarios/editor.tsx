import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth, useRuntime } from "../../app/runtime";
import {
  BackgroundStatus,
  ErrorState,
  LoadingState,
} from "../../components/states";
import { keys } from "../../lib/api/query";
import type { SaveResult } from "../../lib/api/concurrency";
import type {
  MacroDraft,
  MacroPreviewResult,
  MacroScenarioContent,
  PolicyIntensity,
} from "../../types/short-run-macro";
import type { MacroAssessmentDimension } from "../../types/analytics-replay";
import type {
  CompetitiveMarketDraft,
  CompetitiveMarketScenarioContent,
  MarketPreviewResult,
  MarketAssessmentDimension,
  MarketIntensity,
} from "../../types/competitive-market";
import type { AuthoringIssue, ValidationReport } from "../../types/scenarios";
import { LinesField, NumberField, TextField } from "./fields";
import { macroAuthoring, marketAuthoring, type EditDraft } from "./service";

type Model = "macro" | "market";
type AnyDraft = MacroDraft | CompetitiveMarketDraft;
type AnyContent = MacroScenarioContent | CompetitiveMarketScenarioContent;

type SaveState = "saved" | "unsaved" | "saving" | "failed" | "conflict";
type BuilderStep =
  | "scenario"
  | "players"
  | "rules"
  | "world"
  | "learning"
  | "review";

interface BuilderRole {
  code: string;
  name: string;
  description: string;
  enabled: boolean;
  decisions: string[];
  canSeeIndicators: boolean;
  objectives: string[];
}

interface BuilderRule {
  id: string;
  actor: string;
  decision: string;
  effectTarget: string;
  effectDirection: string;
  strength: "Small" | "Moderate" | "Strong";
  condition: string;
  explanation: string;
}

interface FriendlyIssue {
  message: string;
  step: BuilderStep;
}

const builderSteps: Array<{ key: BuilderStep; title: string }> = [
  { key: "scenario", title: "Scenario" },
  { key: "players", title: "Players & Decisions" },
  { key: "rules", title: "Game Rules" },
  { key: "world", title: "World & Events" },
  { key: "learning", title: "Learning Goals" },
  { key: "review", title: "Review" },
];

const macroRoleMeta: Record<string, { name: string; description: string }> = {
  GOVERNMENT: {
    name: "Government",
    description: "Sets fiscal direction through spending and tax choices.",
  },
  CENTRAL_BANK: {
    name: "Central Bank",
    description: "Adjusts monetary policy and responds to inflation pressure.",
  },
  BUSINESS: {
    name: "Business",
    description: "Makes production, hiring, and investment decisions.",
  },
  HOUSEHOLD_LABOR: {
    name: "Household / Labor",
    description: "Responds through spending, saving, and labor choices.",
  },
};

const macroDecisionCatalog = [
  {
    code: "SET_FISCAL_POLICY",
    role: "GOVERNMENT",
    label: "Set fiscal policy",
    denied: ["Adjust monetary policy", "Choose business strategy"],
  },
  {
    code: "SET_MONETARY_POLICY",
    role: "CENTRAL_BANK",
    label: "Adjust monetary policy",
    denied: ["Government spending", "Tax policy"],
  },
  {
    code: "SET_BUSINESS_STRATEGY",
    role: "BUSINESS",
    label: "Choose business strategy",
    denied: ["Set policy rate", "Set taxes"],
  },
  {
    code: "SET_HOUSEHOLD_LABOR_STANCE",
    role: "HOUSEHOLD_LABOR",
    label: "Set household/labor behavior",
    denied: ["Government spending", "Business production planning"],
  },
] as const;

const marketRoleMeta: Record<string, { name: string; description: string }> = {
  BUYER: {
    name: "Buyers",
    description: "Decide bid behavior and purchasing choices.",
  },
  SELLER: {
    name: "Sellers",
    description: "Set ask behavior and selling strategy.",
  },
  GOVERNMENT: {
    name: "Government",
    description: "Applies market policy for the scenario.",
  },
};

const marketDecisionCatalog = [
  {
    code: "SUBMIT_BUYER_BID",
    role: "BUYER",
    label: "Submit buyer bid",
    denied: ["Set seller asks", "Apply market tax"],
  },
  {
    code: "SUBMIT_SELLER_ASK",
    role: "SELLER",
    label: "Submit seller ask",
    denied: ["Set buyer bid", "Apply market subsidy"],
  },
  {
    code: "SUBMIT_MARKET_PREDICTION",
    role: "GOVERNMENT",
    label: "Submit market prediction",
    denied: ["Directly trade in market"],
  },
] as const;

const macroSuggestedRules: Omit<BuilderRule, "id">[] = [
  {
    actor: "Central Bank",
    decision: "Tighten monetary policy",
    effectTarget: "Investment",
    effectDirection: "decreases",
    strength: "Moderate",
    condition: "",
    explanation:
      "Higher borrowing costs discourage investment and cool aggregate demand.",
  },
  {
    actor: "Government",
    decision: "Increase spending",
    effectTarget: "Aggregate demand",
    effectDirection: "increases",
    strength: "Moderate",
    condition: "",
    explanation: "Additional spending raises short-run demand in the economy.",
  },
  {
    actor: "Business",
    decision: "Increase investment",
    effectTarget: "Productive capacity",
    effectDirection: "increases",
    strength: "Small",
    condition: "Only when demand is stable",
    explanation: "Investment expands future output capacity over time.",
  },
];

const marketSuggestedRules: Omit<BuilderRule, "id">[] = [
  {
    actor: "Firm",
    decision: "Increase price",
    effectTarget: "Quantity demanded",
    effectDirection: "decreases",
    strength: "Moderate",
    condition: "",
    explanation:
      "Higher prices reduce purchasing willingness, lowering quantity demanded.",
  },
  {
    actor: "Market price",
    decision: "increases",
    effectTarget: "Household consumption",
    effectDirection: "decreases",
    strength: "Moderate",
    condition: "",
    explanation:
      "As prices rise, purchasing power falls and households consume less.",
  },
];

const macroAssessmentOptions: Array<{
  value: MacroAssessmentDimension;
  title: string;
  description: string;
}> = [
  {
    value: 0,
    title: "Prediction accuracy",
    description: "Can students anticipate likely direction of change?",
  },
  {
    value: 1,
    title: "Causal reasoning",
    description: "Can students explain why change happened?",
  },
  {
    value: 2,
    title: "Trade-off awareness",
    description: "Can students identify gains and sacrifices?",
  },
  {
    value: 5,
    title: "Policy reasoning",
    description: "Can students justify policy decisions using evidence?",
  },
];

const marketAssessmentOptions: Array<{
  value: MarketAssessmentDimension;
  title: string;
  description: string;
}> = [
  {
    value: 1,
    title: "Demand and supply reasoning",
    description: "Can students reason about shifts in demand and supply?",
  },
  {
    value: 2,
    title: "Elasticity reasoning",
    description: "Can students reason about sensitivity to price changes?",
  },
  {
    value: 3,
    title: "Surplus reasoning",
    description: "Can students explain consumer and producer surplus outcomes?",
  },
  {
    value: 6,
    title: "Causal market reasoning",
    description: "Can students explain why observed outcomes happened?",
  },
];

function useLeaveWarning(dirty: boolean) {
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const links = (event: MouseEvent) => {
      if (!dirty || event.defaultPrevented || event.button !== 0) return;
      const anchor = (event.target as Element).closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank") return;
      if (
        !window.confirm(
          "You have unsaved scenario changes. Leave without saving?",
        )
      ) {
        event.preventDefault();
      }
    };

    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", links);

    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", links);
    };
  }, [dirty]);
}

function modelName(model: Model): string {
  return model === "macro" ? "Short-Run Macroeconomics" : "Competitive Market";
}

function lifecycleLabel(status: string): string {
  if (status === "Published") return "Ready to use";
  return status;
}

function saveStateLabel(state: SaveState): string {
  if (state === "saved") return "All changes saved";
  if (state === "unsaved") return "Unsaved changes";
  if (state === "saving") return "Saving...";
  if (state === "conflict")
    return "Changes conflict with a newer server version";
  return "Save failed";
}

function friendlyIssue(issue: AuthoringIssue): FriendlyIssue {
  const code = issue.code.toLowerCase();
  if (code.includes("role") || code.includes("action")) {
    return {
      step: "players",
      message:
        issue.message || "At least one role needs an available decision.",
    };
  }
  if (
    code.includes("shock") ||
    code.includes("event") ||
    code.includes("round")
  ) {
    return {
      step: "world",
      message: issue.message || "An event is missing required setup.",
    };
  }
  if (code.includes("objective") || code.includes("learning")) {
    return {
      step: "learning",
      message: issue.message || "Learning goals need one more pass.",
    };
  }
  if (
    code.includes("condition") ||
    code.includes("configuration") ||
    code.includes("bound")
  ) {
    return {
      step: "world",
      message: issue.message || "World settings need an adjustment.",
    };
  }
  return {
    step: "scenario",
    message: issue.message || "Please review this scenario section.",
  };
}

function slugifyRole(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function createRule(): BuilderRule {
  return {
    id: crypto.randomUUID(),
    actor: "Central Bank",
    decision: "Adjust policy",
    effectTarget: "Investment",
    effectDirection: "decreases",
    strength: "Moderate",
    condition: "",
    explanation: "",
  };
}

function parseRules(content: AnyContent): BuilderRule[] {
  const discussion = content.discussionPrompts ?? [];
  const parsed: BuilderRule[] = [];
  for (const line of discussion) {
    if (!line.startsWith("RULE::")) continue;
    const [
      ,
      actor,
      decision,
      effectTarget,
      effectDirection,
      strength,
      condition,
      explanation,
    ] = line.split("::");
    parsed.push({
      id: crypto.randomUUID(),
      actor: actor || "",
      decision: decision || "",
      effectTarget: effectTarget || "",
      effectDirection: effectDirection || "",
      strength: (strength as BuilderRule["strength"]) || "Moderate",
      condition: condition || "",
      explanation: explanation || "",
    });
  }
  return parsed;
}

function nonRuleDiscussion(content: AnyContent): string[] {
  return (content.discussionPrompts ?? []).filter(
    (line) => !line.startsWith("RULE::"),
  );
}

function serializeRule(rule: BuilderRule): string {
  return [
    "RULE",
    rule.actor,
    rule.decision,
    rule.effectTarget,
    rule.effectDirection,
    rule.strength,
    rule.condition,
    rule.explanation,
  ].join("::");
}

function macroWorldLevel(
  value: number,
  kind: "growth" | "inflation" | "unemployment" | "debt",
): string {
  if (kind === "growth") {
    if (value < 98) return "Weak";
    if (value > 103) return "Strong";
    return "Moderate";
  }
  if (kind === "inflation") {
    if (value <= 2.5) return "Low";
    if (value <= 5) return "Moderate";
    return "High";
  }
  if (kind === "unemployment") {
    if (value < 4.5) return "Low";
    if (value <= 7) return "Moderate";
    return "High";
  }
  if (value < 45) return "Low";
  if (value <= 70) return "Moderate";
  return "High";
}

function macroWorldToValues(
  level: string,
  kind: "growth" | "inflation" | "unemployment" | "debt",
): number {
  if (kind === "growth") {
    if (level === "Weak") return 95;
    if (level === "Strong") return 106;
    return 100;
  }
  if (kind === "inflation") {
    if (level === "Low") return 2;
    if (level === "High") return 7;
    return 4;
  }
  if (kind === "unemployment") {
    if (level === "Low") return 4;
    if (level === "High") return 8.5;
    return 6;
  }
  if (level === "Low") return 40;
  if (level === "High") return 85;
  return 60;
}

function simulationSummary(
  model: Model,
  content: AnyContent,
  rules: BuilderRule[],
): string[] {
  if (model === "macro") {
    const macro = content as MacroScenarioContent;
    const roleCount = macro.roles.filter((r) => r.enabled).length;
    return [
      `${macro.maximumQuarters} rounds`,
      `${roleCount} players`,
      `${rules.length} game rules`,
      `${macro.scheduledShocks.length} events`,
      `${macro.learningObjectives.length} learning goals`,
    ];
  }

  const market = content as CompetitiveMarketScenarioContent;
  const roleCount = market.roles.filter((r) => r.enabled).length;
  return [
    `${market.maximumRounds} rounds`,
    `${roleCount} players`,
    `${rules.length} game rules`,
    `${market.configuration.scheduledShocks?.length ?? 0} events`,
    `${market.learningObjectives.length} learning goals`,
  ];
}

export function ScenarioEditorPage() {
  const { model, draftId } = useParams();
  const selected: Model =
    model === "macro"
      ? "macro"
      : model === "market"
        ? "market"
        : (null as never);
  const { api, queries } = useRuntime();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!selected || !draftId) {
    return (
      <ErrorState
        error={new Error("Unknown scenario type or missing draft ID.")}
      />
    );
  }

  const service =
    selected === "macro" ? macroAuthoring(api) : marketAuthoring(api);
  const key = keys.scenario(user!.id, selected, draftId);

  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => service.get(draftId, signal) as Promise<AnyDraft>,
  });

  const [name, setName] = useState("");
  const [content, setContent] = useState<AnyContent | null>(null);
  const [rules, setRules] = useState<BuilderRule[]>([]);
  const [dirty, setDirty] = useState(false);
  const [step, setStep] = useState<BuilderStep>("scenario");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [conflict, setConflict] = useState<AnyDraft | null>(null);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [preview, setPreview] = useState<
    MacroPreviewResult | MarketPreviewResult | null
  >(null);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [showAdvancedWorld, setShowAdvancedWorld] = useState(false);

  const immutable =
    publishedId !== null ||
    query.data?.document.status === "Published" ||
    query.data?.document.status === "Archived";

  useEffect(() => {
    if (!query.data || content) return;
    setName(query.data.document.name);
    const cloned = structuredClone(query.data.content) as AnyContent;
    setContent(cloned);
    setRules(parseRules(cloned));
  }, [query.data, content]);

  useLeaveWarning(dirty);

  const markDirty = () => {
    setDirty(true);
    setSaveState("unsaved");
    setValidation(null);
  };

  const updateContent = (next: AnyContent) => {
    setContent(next);
    markDirty();
  };

  const withRules = (base: AnyContent): AnyContent => {
    const serialized = rules.map(serializeRule);
    const otherDiscussion = nonRuleDiscussion(base);
    return {
      ...base,
      discussionPrompts: [...otherDiscussion, ...serialized],
    } as AnyContent;
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!query.data || !content) throw new Error("Draft is not loaded.");
      return service.save(
        draftId,
        query.data as never,
        { name, content: withRules(content) } as never,
      ) as Promise<SaveResult<AnyDraft, EditDraft<AnyContent>>>;
    },
    onMutate: () => setSaveState("saving"),
    onSuccess: (result) => {
      if (result.kind === "conflict") {
        setSaveState("conflict");
        setConflict(result.authoritative);
        return;
      }
      queries.setQueryData(key, result.resource);
      setDirty(false);
      setSaveState("saved");
      setValidation(null);
    },
    onError: () => setSaveState("failed"),
  });

  const validate = useMutation({
    mutationFn: () => service.validate(draftId),
    onSuccess: setValidation,
  });

  const previewMutation = useMutation({
    mutationFn: () =>
      selected === "macro"
        ? macroAuthoring(api).preview<MacroPreviewResult>(draftId, { seed: 1 })
        : marketAuthoring(api).preview<MarketPreviewResult>(draftId, {
            seed: 1,
          }),
    onSuccess: setPreview,
  });

  const publish = useMutation({
    mutationFn: () =>
      service.publish(draftId, {
        expectedVersion: query.data!.document.version,
      }),
    onSuccess: (result) => {
      setPublishedId(result.scenarioVersionId);
      setStep("review");
    },
  });

  const archive = useMutation({
    mutationFn: () =>
      service.archive(draftId, {
        expectedVersion: query.data!.document.version,
      }),
    onSuccess: () => void queries.invalidateQueries({ queryKey: key }),
  });

  const duplicate = useMutation({
    mutationFn: (cloneName: string) =>
      service.clone(
        service.prepareClone(draftId, cloneName) as never,
      ) as Promise<AnyDraft>,
    onSuccess: (draft) =>
      navigate(`/instructor/scenarios/${selected}/${draft.document.id}`),
  });

  const friendlyIssues = useMemo(
    () =>
      [...(validation?.blockers ?? []), ...(validation?.warnings ?? [])].map(
        friendlyIssue,
      ),
    [validation],
  );

  if (query.isPending || !content)
    return <LoadingState label="Loading scenario builder" />;
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );

  const lifecycle = query.data.document.status;

  return (
    <>
      <header className="page-heading">
        <Link to="/instructor/scenarios">Back to Scenarios</Link>
        <div className="editor-title">
          <h1>{name || "Untitled scenario"}</h1>
          <span className={`scenario-status ${lifecycle.toLowerCase()}`}>
            {lifecycleLabel(lifecycle)}
          </span>
        </div>
        <p>{modelName(selected)}</p>
        <p className="muted" role="status">
          {saveStateLabel(saveState)}
        </p>
      </header>

      {immutable && (
        <section className="notice">
          <h2>
            {lifecycle === "Archived"
              ? "Archived scenario"
              : "Published scenario"}
          </h2>
          <p>
            This published scenario is locked so simulations always use the
            version you prepared.
          </p>
        </section>
      )}

      <div className="authoring-layout scenario-builder-layout">
        <nav
          className="step-nav scenario-builder-nav"
          aria-label="Scenario builder sections"
        >
          <h3>Scenario Builder</h3>
          {builderSteps.map((item, index) => (
            <button
              type="button"
              key={item.key}
              className={step === item.key ? "active secondary" : "secondary"}
              aria-current={step === item.key ? "step" : undefined}
              onClick={() => setStep(item.key)}
            >
              <span>{index + 1}</span>
              {item.title}
            </button>
          ))}
        </nav>

        <section
          className="editor-panel scenario-builder-panel"
          aria-labelledby="scenario-builder-heading"
        >
          <div className="section-heading">
            <h2 id="scenario-builder-heading">
              {builderSteps.find((s) => s.key === step)?.title}
            </h2>
            <BackgroundStatus active={query.isFetching} />
          </div>

          <fieldset disabled={immutable}>
            {step === "scenario" && (
              <ScenarioStoryEditor
                model={selected}
                name={name}
                setName={(next) => {
                  setName(next);
                  markDirty();
                }}
                content={content}
                onChange={updateContent}
              />
            )}

            {step === "players" && (
              <PlayersAndDecisionsEditor
                model={selected}
                content={content}
                onChange={updateContent}
              />
            )}

            {step === "rules" && (
              <RuleBuilder
                model={selected}
                rules={rules}
                onChange={(next) => {
                  setRules(next);
                  markDirty();
                }}
              />
            )}

            {step === "world" && (
              <WorldSetupEditor
                model={selected}
                content={content}
                onChange={updateContent}
                showAdvanced={showAdvancedWorld}
                setShowAdvanced={setShowAdvancedWorld}
              />
            )}

            {step === "learning" && (
              <LearningGoalEditor
                model={selected}
                content={content}
                onChange={updateContent}
              />
            )}

            {step === "review" && (
              <ScenarioReview
                model={selected}
                content={content}
                rules={rules}
                dirty={dirty}
                validation={validation}
                issues={friendlyIssues}
                preview={preview}
                publishedId={publishedId}
                validatePending={validate.isPending}
                pending={previewMutation.isPending || publish.isPending}
                error={validate.error || previewMutation.error || publish.error}
                onValidate={() => validate.mutate()}
                onPreview={() => previewMutation.mutate()}
                onPublish={() => publish.mutate()}
                onFix={(target) => setStep(target)}
              />
            )}
          </fieldset>

          <div className="editor-actions">
            <button
              type="button"
              disabled={immutable || !dirty || save.isPending}
              onClick={() => save.mutate()}
            >
              Save Draft
            </button>

            <details className="actions-menu">
              <summary>...</summary>
              <div className="actions-panel">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    const next = window.prompt(
                      "Name for the duplicate scenario",
                      `${name} copy`,
                    );
                    if (next?.trim()) duplicate.mutate(next.trim());
                  }}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={immutable}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Archive this scenario? Existing sessions are not changed.",
                      )
                    ) {
                      archive.mutate();
                    }
                  }}
                >
                  Archive
                </button>
              </div>
            </details>
          </div>

          {save.error && <ErrorState error={save.error} />}
          {archive.error && <ErrorState error={archive.error} />}
          {duplicate.error && <ErrorState error={duplicate.error} />}

          {conflict && (
            <section className="state error" role="alert">
              <h2>A newer draft version is available</h2>
              <p>
                Your unsaved changes are still here. The server now has a newer
                version. Review your work and reload when you are ready.
              </p>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setContent(null);
                  setRules([]);
                  setConflict(null);
                  setDirty(false);
                  void query.refetch();
                }}
              >
                Load Latest Saved Version
              </button>
            </section>
          )}
        </section>
      </div>
    </>
  );
}

function ScenarioStoryEditor({
  model,
  name,
  setName,
  content,
  onChange,
}: {
  model: Model;
  name: string;
  setName(next: string): void;
  content: AnyContent;
  onChange(next: AnyContent): void;
}) {
  const rounds =
    model === "macro"
      ? (content as MacroScenarioContent).maximumQuarters
      : (content as CompetitiveMarketScenarioContent).maximumRounds;

  return (
    <div className="form-grid">
      <h3>What situation will your students enter?</h3>
      <TextField
        id="builder-name"
        label="Scenario name"
        value={name}
        onChange={setName}
        required
      />
      <TextField
        id="builder-situation"
        label="Describe the situation to your students"
        value={content.briefing}
        onChange={(next) => onChange({ ...content, briefing: next })}
        required
        multiline
      />
      <label htmlFor="builder-rounds">
        How long should the simulation run?
      </label>
      <select
        id="builder-rounds"
        value={rounds}
        onChange={(event) => {
          const value = Number(event.target.value);
          if (model === "macro") {
            const current = content as MacroScenarioContent;
            onChange({ ...current, maximumQuarters: value });
          } else {
            const current = content as CompetitiveMarketScenarioContent;
            onChange({
              ...current,
              maximumRounds: value,
              configuration: { ...current.configuration, maximumRounds: value },
            });
          }
        }}
      >
        {[4, 5, 6, 7, 8, 9, 10].map((count) => (
          <option key={count} value={count}>
            {count} rounds
          </option>
        ))}
      </select>
      <TextField
        id="builder-understand"
        label="What should students be trying to understand?"
        value={content.debriefPrompts?.[0] ?? ""}
        onChange={(next) => {
          const prompts = [...(content.debriefPrompts ?? [])];
          if (prompts.length === 0) prompts.push(next);
          else prompts[0] = next;
          onChange({ ...content, debriefPrompts: prompts });
        }}
        multiline
      />
    </div>
  );
}

function PlayersAndDecisionsEditor({
  model,
  content,
  onChange,
}: {
  model: Model;
  content: AnyContent;
  onChange(next: AnyContent): void;
}) {
  const roles: BuilderRole[] =
    model === "macro"
      ? buildMacroRoles(content as MacroScenarioContent)
      : buildMarketRoles(content as CompetitiveMarketScenarioContent);

  const updateRole = (updated: BuilderRole) => {
    if (model === "macro") {
      onChange(applyMacroRoleUpdate(content as MacroScenarioContent, updated));
      return;
    }
    onChange(
      applyMarketRoleUpdate(
        content as CompetitiveMarketScenarioContent,
        updated,
      ),
    );
  };

  const addRole = () => {
    const name = window.prompt("What role will the student play?");
    if (!name?.trim()) return;
    const code = slugifyRole(name.trim());

    if (model === "macro") {
      const current = content as MacroScenarioContent;
      onChange({
        ...current,
        roles: [
          ...current.roles,
          {
            code,
            enabled: true,
            canSeeInstitutionalIndicators: false,
            objectives: [],
          },
        ],
      });
      return;
    }

    const current = content as CompetitiveMarketScenarioContent;
    onChange({
      ...current,
      roles: [
        ...current.roles,
        { code, enabled: true, seePrivateInformation: false, objectives: [] },
      ],
    });
  };

  return (
    <div className="form-grid">
      <h3>Who are the students in this simulation?</h3>
      <div className="card-grid role-grid">
        {roles.map((role) => (
          <RoleDesigner key={role.code} role={role} onChange={updateRole} />
        ))}
      </div>
      <button type="button" className="secondary" onClick={addRole}>
        + Add another role
      </button>
    </div>
  );
}

function RoleDesigner({
  role,
  onChange,
}: {
  role: BuilderRole;
  onChange(next: BuilderRole): void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="card role-card">
      <div className="section-heading">
        <h4>{role.name}</h4>
        <label className="inline-toggle">
          <input
            type="checkbox"
            checked={role.enabled}
            onChange={(event) =>
              onChange({ ...role, enabled: event.target.checked })
            }
          />
          Active
        </label>
      </div>
      <p>{role.description}</p>
      <h5>Decisions</h5>
      <ul>
        {role.decisions.map((decision) => (
          <li key={decision}>{decision}</li>
        ))}
      </ul>
      <button
        type="button"
        className="secondary"
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Hide Role Settings" : "Edit Role"}
      </button>
      {expanded && <DecisionDesigner role={role} onChange={onChange} />}
    </article>
  );
}

function DecisionDesigner({
  role,
  onChange,
}: {
  role: BuilderRole;
  onChange(next: BuilderRole): void;
}) {
  const available = [...new Set(role.decisions)];
  return (
    <div className="role-editor">
      <TextField
        id={`role-name-${role.code}`}
        label="Role name"
        value={role.name}
        onChange={(next) => onChange({ ...role, name: next })}
      />
      <TextField
        id={`role-description-${role.code}`}
        label="Role description"
        value={role.description}
        onChange={(next) => onChange({ ...role, description: next })}
        multiline
      />
      <p className="eyebrow">Students in this role can:</p>
      <div className="checks">
        {available.map((decision) => {
          const checked = role.decisions.includes(decision);
          return (
            <label className="check-field" key={`${role.code}-${decision}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...role.decisions, decision]
                    : role.decisions.filter((item) => item !== decision);
                  onChange({ ...role, decisions: [...new Set(next)] });
                }}
              />
              <span>{decision}</span>
            </label>
          );
        })}
      </div>
      <label className="check-field">
        <input
          type="checkbox"
          checked={role.canSeeIndicators}
          onChange={(event) =>
            onChange({ ...role, canSeeIndicators: event.target.checked })
          }
        />
        <span>View role indicators</span>
      </label>
      <LinesField
        id={`role-objectives-${role.code}`}
        label="Role-specific goals"
        value={role.objectives}
        onChange={(next) => onChange({ ...role, objectives: next })}
      />
    </div>
  );
}

function RuleBuilder({
  model,
  rules,
  onChange,
}: {
  model: Model;
  rules: BuilderRule[];
  onChange(next: BuilderRule[]): void;
}) {
  const suggested =
    model === "macro" ? macroSuggestedRules : marketSuggestedRules;
  return (
    <div className="form-grid">
      <h3>How does this simulation respond to student decisions?</h3>
      <p>Define the relationships students should discover through play.</p>

      <section className="card">
        <h4>Suggested rules</h4>
        <div className="checks">
          {suggested.map((rule, index) => (
            <button
              type="button"
              className="secondary"
              key={`${rule.actor}-${index}`}
              onClick={() =>
                onChange([...rules, { ...rule, id: crypto.randomUUID() }])
              }
            >
              Add: {rule.actor} {rule.decision} {"->"} {rule.effectTarget}{" "}
              {rule.effectDirection}
            </button>
          ))}
        </div>
      </section>

      {rules.map((rule, index) => (
        <article className="card" key={rule.id}>
          <RuleSentenceEditor
            rule={rule}
            onChange={(next) =>
              onChange(rules.map((item) => (item.id === rule.id ? next : item)))
            }
            onRemove={() =>
              onChange(rules.filter((item) => item.id !== rule.id))
            }
          />
          <div className="rule-chain">
            <p>
              {rule.actor} {"->"} {rule.decision}
            </p>
            <p>leads to</p>
            <p>
              {rule.effectTarget} {rule.effectDirection}
            </p>
            <p className="muted">Strength: {rule.strength}</p>
          </div>
        </article>
      ))}

      <button type="button" onClick={() => onChange([...rules, createRule()])}>
        + Add another rule
      </button>
      {rules.length === 0 && (
        <p className="muted">
          Add at least one relationship to define the game logic.
        </p>
      )}
    </div>
  );
}

function RuleSentenceEditor({
  rule,
  onChange,
  onRemove,
}: {
  rule: BuilderRule;
  onChange(next: BuilderRule): void;
  onRemove(): void;
}) {
  return (
    <div className="rule-editor-grid">
      <h4>When this happens...</h4>
      <div className="form-grid columns-2">
        <TextField
          id={`rule-actor-${rule.id}`}
          label="When"
          value={rule.actor}
          onChange={(next) => onChange({ ...rule, actor: next })}
        />
        <TextField
          id={`rule-decision-${rule.id}`}
          label="chooses"
          value={rule.decision}
          onChange={(next) => onChange({ ...rule, decision: next })}
        />
        <TextField
          id={`rule-target-${rule.id}`}
          label="Then"
          value={rule.effectTarget}
          onChange={(next) => onChange({ ...rule, effectTarget: next })}
        />
        <label htmlFor={`rule-direction-${rule.id}`}>
          changes by
          <select
            id={`rule-direction-${rule.id}`}
            value={rule.effectDirection}
            onChange={(event) =>
              onChange({ ...rule, effectDirection: event.target.value })
            }
          >
            <option value="increases">increases</option>
            <option value="decreases">decreases</option>
            <option value="stabilizes">stabilizes</option>
            <option value="becomes volatile">becomes volatile</option>
          </select>
        </label>
      </div>

      <label htmlFor={`rule-strength-${rule.id}`}>
        Strength
        <select
          id={`rule-strength-${rule.id}`}
          value={rule.strength}
          onChange={(event) =>
            onChange({
              ...rule,
              strength: event.target.value as BuilderRule["strength"],
            })
          }
        >
          <option value="Small">Small effect</option>
          <option value="Moderate">Moderate effect</option>
          <option value="Strong">Strong effect</option>
        </select>
      </label>

      <TextField
        id={`rule-condition-${rule.id}`}
        label="Only when... (optional)"
        value={rule.condition}
        onChange={(next) => onChange({ ...rule, condition: next })}
      />
      <TextField
        id={`rule-why-${rule.id}`}
        label="Why does this happen?"
        value={rule.explanation}
        onChange={(next) => onChange({ ...rule, explanation: next })}
        multiline
      />
      <button type="button" className="secondary" onClick={onRemove}>
        Remove rule
      </button>
    </div>
  );
}

function WorldSetupEditor({
  model,
  content,
  onChange,
  showAdvanced,
  setShowAdvanced,
}: {
  model: Model;
  content: AnyContent;
  onChange(next: AnyContent): void;
  showAdvanced: boolean;
  setShowAdvanced(next: boolean): void;
}) {
  if (model === "macro") {
    const macro = content as MacroScenarioContent;
    const world = macro.startingConditions;

    return (
      <div className="form-grid">
        <h3>What does the world look like when the game begins?</h3>
        <div className="form-grid columns-2">
          <label htmlFor="macro-growth">
            Economic growth
            <select
              id="macro-growth"
              value={macroWorldLevel(world.outputIndex, "growth")}
              onChange={(event) =>
                onChange({
                  ...macro,
                  startingConditions: {
                    ...world,
                    outputIndex: macroWorldToValues(
                      event.target.value,
                      "growth",
                    ),
                  },
                })
              }
            >
              <option>Weak</option>
              <option>Moderate</option>
              <option>Strong</option>
            </select>
          </label>
          <label htmlFor="macro-inflation-level">
            Inflation
            <select
              id="macro-inflation-level"
              value={macroWorldLevel(world.inflation, "inflation")}
              onChange={(event) =>
                onChange({
                  ...macro,
                  startingConditions: {
                    ...world,
                    inflation: macroWorldToValues(
                      event.target.value,
                      "inflation",
                    ),
                  },
                })
              }
            >
              <option>Low</option>
              <option>Moderate</option>
              <option>High</option>
            </select>
          </label>
          <label htmlFor="macro-unemployment-level">
            Unemployment
            <select
              id="macro-unemployment-level"
              value={macroWorldLevel(world.unemployment, "unemployment")}
              onChange={(event) =>
                onChange({
                  ...macro,
                  startingConditions: {
                    ...world,
                    unemployment: macroWorldToValues(
                      event.target.value,
                      "unemployment",
                    ),
                  },
                })
              }
            >
              <option>Low</option>
              <option>Moderate</option>
              <option>High</option>
            </select>
          </label>
          <label htmlFor="macro-debt-level">
            Government debt
            <select
              id="macro-debt-level"
              value={macroWorldLevel(world.debtToOutput, "debt")}
              onChange={(event) =>
                onChange({
                  ...macro,
                  startingConditions: {
                    ...world,
                    debtToOutput: macroWorldToValues(
                      event.target.value,
                      "debt",
                    ),
                  },
                })
              }
            >
              <option>Low</option>
              <option>Moderate</option>
              <option>High</option>
            </select>
          </label>
        </div>

        <details
          open={showAdvanced}
          onToggle={(event) =>
            setShowAdvanced((event.target as HTMLDetailsElement).open)
          }
        >
          <summary>Advanced economic settings</summary>
          <div className="form-grid columns-2">
            <NumberField
              id="macro-output-index"
              label="Output index"
              value={world.outputIndex}
              onChange={(value) =>
                onChange({
                  ...macro,
                  startingConditions: { ...world, outputIndex: value },
                })
              }
            />
            <NumberField
              id="macro-potential-output"
              label="Potential output index"
              value={world.potentialOutputIndex}
              onChange={(value) =>
                onChange({
                  ...macro,
                  startingConditions: { ...world, potentialOutputIndex: value },
                })
              }
            />
            <NumberField
              id="macro-policy-rate"
              label="Policy rate"
              value={world.policyRate}
              onChange={(value) =>
                onChange({
                  ...macro,
                  startingConditions: { ...world, policyRate: value },
                })
              }
            />
          </div>
        </details>

        <EventDesigner model={model} content={content} onChange={onChange} />

        <section className="card">
          <h4>What information can each role see?</h4>
          <div className="checks">
            {macro.roles.map((role) => {
              const label = macroRoleMeta[role.code]?.name ?? role.code;
              return (
                <label className="check-field" key={`visibility-${role.code}`}>
                  <input
                    type="checkbox"
                    checked={role.canSeeInstitutionalIndicators}
                    onChange={(event) =>
                      onChange({
                        ...macro,
                        roles: macro.roles.map((item) =>
                          item.code === role.code
                            ? {
                                ...item,
                                canSeeInstitutionalIndicators:
                                  event.target.checked,
                              }
                            : item,
                        ),
                      })
                    }
                  />
                  <span>{label} can see key economic indicators</span>
                </label>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  const market = content as CompetitiveMarketScenarioContent;

  return (
    <div className="form-grid">
      <h3>What does the market world look like when the game begins?</h3>
      <div className="form-grid columns-2">
        <NumberField
          id="market-demand-health"
          label="Demand strength"
          value={market.configuration.demandIntercept}
          onChange={(value) =>
            onChange({
              ...market,
              configuration: {
                ...market.configuration,
                demandIntercept: value,
              },
            })
          }
        />
        <NumberField
          id="market-supply-health"
          label="Supply strength"
          value={market.configuration.supplyIntercept}
          onChange={(value) =>
            onChange({
              ...market,
              configuration: {
                ...market.configuration,
                supplyIntercept: value,
              },
            })
          }
        />
      </div>

      <details
        open={showAdvanced}
        onToggle={(event) =>
          setShowAdvanced((event.target as HTMLDetailsElement).open)
        }
      >
        <summary>Advanced market settings</summary>
        <div className="form-grid columns-2">
          <NumberField
            id="market-demand-slope"
            label="Demand slope"
            value={market.configuration.demandSlope}
            onChange={(value) =>
              onChange({
                ...market,
                configuration: { ...market.configuration, demandSlope: value },
              })
            }
          />
          <NumberField
            id="market-supply-slope"
            label="Supply slope"
            value={market.configuration.supplySlope}
            onChange={(value) =>
              onChange({
                ...market,
                configuration: { ...market.configuration, supplySlope: value },
              })
            }
          />
          <NumberField
            id="market-unit-tax"
            label="Per-unit tax"
            value={market.configuration.unitTax}
            onChange={(value) =>
              onChange({
                ...market,
                configuration: { ...market.configuration, unitTax: value },
              })
            }
          />
          <NumberField
            id="market-unit-subsidy"
            label="Per-unit subsidy"
            value={market.configuration.unitSubsidy}
            onChange={(value) =>
              onChange({
                ...market,
                configuration: { ...market.configuration, unitSubsidy: value },
              })
            }
          />
        </div>
      </details>

      <EventDesigner model={model} content={content} onChange={onChange} />

      <section className="card">
        <h4>What information can each role see?</h4>
        <div className="checks">
          {market.roles.map((role) => {
            const label = marketRoleMeta[role.code]?.name ?? role.code;
            return (
              <label
                className="check-field"
                key={`market-visibility-${role.code}`}
              >
                <input
                  type="checkbox"
                  checked={role.seePrivateInformation}
                  onChange={(event) =>
                    onChange({
                      ...market,
                      roles: market.roles.map((item) =>
                        item.code === role.code
                          ? {
                              ...item,
                              seePrivateInformation: event.target.checked,
                            }
                          : item,
                      ),
                    })
                  }
                />
                <span>{label} can view role-specific market details</span>
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function EventDesigner({
  model,
  content,
  onChange,
}: {
  model: Model;
  content: AnyContent;
  onChange(next: AnyContent): void;
}) {
  if (model === "macro") {
    const macro = content as MacroScenarioContent;
    const rounds = macro.maximumQuarters;

    return (
      <section className="card">
        <div className="section-heading">
          <h4>Events that may occur during the simulation</h4>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...macro,
                scheduledShocks: [
                  ...macro.scheduledShocks,
                  {
                    round: 1,
                    type: "supply_disruption",
                    intensity: "Moderate" as PolicyIntensity,
                  },
                ],
              })
            }
          >
            + Add Event
          </button>
        </div>
        {macro.scheduledShocks.length === 0 ? (
          <p className="muted">No events added yet.</p>
        ) : (
          macro.scheduledShocks.map((event, index) => (
            <article className="card event-card" key={`${event.type}-${index}`}>
              <label htmlFor={`macro-event-type-${index}`}>
                What happens?
                <select
                  id={`macro-event-type-${index}`}
                  value={event.type}
                  onChange={(changeEvent) =>
                    onChange({
                      ...macro,
                      scheduledShocks: macro.scheduledShocks.map(
                        (item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, type: changeEvent.target.value }
                            : item,
                      ),
                    })
                  }
                >
                  <option value="supply_disruption">
                    Energy price increase
                  </option>
                  <option value="demand_slump">Demand slowdown</option>
                  <option value="demand_boom">Demand surge</option>
                  <option value="productivity_boost">Productivity boost</option>
                  <option value="confidence_crisis">Confidence decline</option>
                </select>
              </label>

              <label htmlFor={`macro-event-round-${index}`}>
                When?
                <select
                  id={`macro-event-round-${index}`}
                  value={event.round}
                  onChange={(changeEvent) =>
                    onChange({
                      ...macro,
                      scheduledShocks: macro.scheduledShocks.map(
                        (item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                round: Number(changeEvent.target.value),
                              }
                            : item,
                      ),
                    })
                  }
                >
                  {Array.from({ length: rounds }).map((_, roundIndex) => (
                    <option value={roundIndex + 1} key={roundIndex + 1}>
                      Round {roundIndex + 1}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor={`macro-event-intensity-${index}`}>
                How significant?
                <select
                  id={`macro-event-intensity-${index}`}
                  value={event.intensity}
                  onChange={(changeEvent) =>
                    onChange({
                      ...macro,
                      scheduledShocks: macro.scheduledShocks.map(
                        (item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                intensity: changeEvent.target
                                  .value as PolicyIntensity,
                              }
                            : item,
                      ),
                    })
                  }
                >
                  <option value="Mild">Mild</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Strong">Strong</option>
                </select>
              </label>

              <button
                type="button"
                className="secondary"
                onClick={() =>
                  onChange({
                    ...macro,
                    scheduledShocks: macro.scheduledShocks.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  })
                }
              >
                Remove
              </button>
            </article>
          ))
        )}
      </section>
    );
  }

  const market = content as CompetitiveMarketScenarioContent;
  const rounds = market.maximumRounds;
  const events = market.configuration.scheduledShocks ?? [];

  return (
    <section className="card">
      <div className="section-heading">
        <h4>Events that may occur during the simulation</h4>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...market,
              configuration: {
                ...market.configuration,
                scheduledShocks: [
                  ...events,
                  {
                    round: 1,
                    type: "demand_increase",
                    intensity: "Moderate" as MarketIntensity,
                  },
                ],
              },
            })
          }
        >
          + Add Event
        </button>
      </div>
      {events.length === 0 ? (
        <p className="muted">No events added yet.</p>
      ) : (
        events.map((event, index) => (
          <article className="card event-card" key={`${event.type}-${index}`}>
            <label htmlFor={`market-event-type-${index}`}>
              What happens?
              <select
                id={`market-event-type-${index}`}
                value={event.type}
                onChange={(changeEvent) =>
                  onChange({
                    ...market,
                    configuration: {
                      ...market.configuration,
                      scheduledShocks: events.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, type: changeEvent.target.value }
                          : item,
                      ),
                    },
                  })
                }
              >
                <option value="demand_increase">Demand rises</option>
                <option value="demand_decrease">Demand falls</option>
                <option value="supply_increase">Supply rises</option>
                <option value="supply_decrease">Supply falls</option>
              </select>
            </label>
            <label htmlFor={`market-event-round-${index}`}>
              When?
              <select
                id={`market-event-round-${index}`}
                value={event.round}
                onChange={(changeEvent) =>
                  onChange({
                    ...market,
                    configuration: {
                      ...market.configuration,
                      scheduledShocks: events.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, round: Number(changeEvent.target.value) }
                          : item,
                      ),
                    },
                  })
                }
              >
                {Array.from({ length: rounds }).map((_, roundIndex) => (
                  <option value={roundIndex + 1} key={roundIndex + 1}>
                    Round {roundIndex + 1}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={`market-event-intensity-${index}`}>
              How significant?
              <select
                id={`market-event-intensity-${index}`}
                value={event.intensity}
                onChange={(changeEvent) =>
                  onChange({
                    ...market,
                    configuration: {
                      ...market.configuration,
                      scheduledShocks: events.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              intensity: changeEvent.target
                                .value as MarketIntensity,
                            }
                          : item,
                      ),
                    },
                  })
                }
              >
                <option value="Mild">Mild</option>
                <option value="Moderate">Moderate</option>
                <option value="Strong">Strong</option>
              </select>
            </label>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                onChange({
                  ...market,
                  configuration: {
                    ...market.configuration,
                    scheduledShocks: events.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  },
                })
              }
            >
              Remove
            </button>
          </article>
        ))
      )}
    </section>
  );
}

function LearningGoalEditor({
  model,
  content,
  onChange,
}: {
  model: Model;
  content: AnyContent;
  onChange(next: AnyContent): void;
}) {
  if (model === "macro") {
    const macro = content as MacroScenarioContent;
    const selectedAssessments = macro.assessmentDimensions ?? [];

    return (
      <div className="form-grid">
        <h3>What should students learn from this scenario?</h3>
        <LinesField
          id="macro-learning-goals"
          label="Learning goals"
          value={macro.learningObjectives}
          onChange={(next) => onChange({ ...macro, learningObjectives: next })}
        />

        <section className="card">
          <h4>What should the simulation evaluate?</h4>
          <div className="checks">
            {macroAssessmentOptions.map((option) => (
              <label className="check-field" key={option.value}>
                <input
                  type="checkbox"
                  checked={selectedAssessments.includes(option.value)}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...selectedAssessments, option.value]
                      : selectedAssessments.filter(
                          (item) => item !== option.value,
                        );
                    onChange({
                      ...macro,
                      assessmentDimensions: [
                        ...new Set(next),
                      ] as MacroAssessmentDimension[],
                    });
                  }}
                />
                <span>
                  {option.title}
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="card">
          <h4>Country goals</h4>
          <div className="checks">
            <label className="check-field">
              <input type="checkbox" checked readOnly />
              <span>Keep inflation under control</span>
            </label>
            <label className="check-field">
              <input type="checkbox" checked readOnly />
              <span>Maintain employment</span>
            </label>
            <label className="check-field">
              <input type="checkbox" checked readOnly />
              <span>Support growth</span>
            </label>
            <label className="check-field">
              <input type="checkbox" checked readOnly />
              <span>Manage government debt</span>
            </label>
          </div>
          <details>
            <summary>Set specific targets</summary>
            <div className="form-grid columns-2">
              <NumberField
                id="macro-objective-inf-min"
                label="Inflation minimum"
                value={macro.teamObjectives.inflationMinimum}
                onChange={(value) =>
                  onChange({
                    ...macro,
                    teamObjectives: {
                      ...macro.teamObjectives,
                      inflationMinimum: value,
                    },
                  })
                }
              />
              <NumberField
                id="macro-objective-inf-max"
                label="Inflation maximum"
                value={macro.teamObjectives.inflationMaximum}
                onChange={(value) =>
                  onChange({
                    ...macro,
                    teamObjectives: {
                      ...macro.teamObjectives,
                      inflationMaximum: value,
                    },
                  })
                }
              />
              <NumberField
                id="macro-objective-unemp"
                label="Unemployment maximum"
                value={macro.teamObjectives.unemploymentMaximum}
                onChange={(value) =>
                  onChange({
                    ...macro,
                    teamObjectives: {
                      ...macro.teamObjectives,
                      unemploymentMaximum: value,
                    },
                  })
                }
              />
              <NumberField
                id="macro-objective-debt"
                label="Debt-to-output maximum"
                value={macro.teamObjectives.debtToOutputMaximum}
                onChange={(value) =>
                  onChange({
                    ...macro,
                    teamObjectives: {
                      ...macro.teamObjectives,
                      debtToOutputMaximum: value,
                    },
                  })
                }
              />
            </div>
          </details>
        </section>
      </div>
    );
  }

  const market = content as CompetitiveMarketScenarioContent;
  const selectedAssessments = market.assessmentDimensions ?? [];

  return (
    <div className="form-grid">
      <h3>What should students learn from this scenario?</h3>
      <LinesField
        id="market-learning-goals"
        label="Learning goals"
        value={market.learningObjectives}
        onChange={(next) => onChange({ ...market, learningObjectives: next })}
      />

      <section className="card">
        <h4>What should the simulation evaluate?</h4>
        <div className="checks">
          {marketAssessmentOptions.map((option) => (
            <label className="check-field" key={option.value}>
              <input
                type="checkbox"
                checked={selectedAssessments.includes(option.value)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...selectedAssessments, option.value]
                    : selectedAssessments.filter(
                        (item) => item !== option.value,
                      );
                  onChange({
                    ...market,
                    assessmentDimensions: [...new Set(next)],
                  });
                }}
              />
              <span>
                {option.title}
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

function ScenarioReview({
  model,
  content,
  rules,
  dirty,
  validation,
  issues,
  preview,
  publishedId,
  validatePending,
  pending,
  error,
  onValidate,
  onPreview,
  onPublish,
  onFix,
}: {
  model: Model;
  content: AnyContent;
  rules: BuilderRule[];
  dirty: boolean;
  validation: ValidationReport | null;
  issues: FriendlyIssue[];
  preview: MacroPreviewResult | MarketPreviewResult | null;
  publishedId: string | null;
  validatePending: boolean;
  pending: boolean;
  error: unknown;
  onValidate(): void;
  onPreview(): void;
  onPublish(): void;
  onFix(step: BuilderStep): void;
}) {
  const summary = simulationSummary(model, content, rules);
  const blockers = validation?.blockers.length ?? 0;

  return (
    <div className="review-publish">
      <h3>Review</h3>
      <ul className="summary-list">
        {summary.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <section className="card scenario-check">
        <h3>Scenario check</h3>
        <button
          type="button"
          className="secondary"
          disabled={validatePending}
          onClick={onValidate}
        >
          {validatePending ? "Checking..." : "Run Scenario Check"}
        </button>

        {!validation && (
          <p className="muted">Run the scenario check before publishing.</p>
        )}

        {validation && blockers === 0 && (
          <>
            <p className="status-text">Everything looks ready.</p>
            <ul>
              <li>Every role has at least one decision</li>
              <li>Game rules are valid</li>
              <li>Starting conditions are complete</li>
              <li>Events are configured</li>
              <li>Learning goals are defined</li>
            </ul>
          </>
        )}

        {validation && blockers > 0 && (
          <>
            <p>
              <strong>{blockers} things need your attention.</strong>
            </p>
            <ul>
              {issues.map((issue, index) => (
                <li key={`${issue.message}-${index}`}>
                  {issue.message}{" "}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onFix(issue.step)}
                  >
                    Fix
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card">
        <h3>Preview Scenario</h3>
        <p>
          If nobody makes unusual decisions, what kind of simulation did you
          create?
        </p>
        <button
          type="button"
          className="secondary"
          disabled={dirty || pending}
          onClick={onPreview}
        >
          Preview Scenario
        </button>
        {dirty && (
          <p className="field-help">Save draft changes before previewing.</p>
        )}
        {preview && (
          <PreviewSummary preview={preview} model={model} content={content} />
        )}
      </section>

      <section className="card">
        <button
          type="button"
          disabled={dirty || pending || !validation?.canPublish || blockers > 0}
          onClick={onPublish}
        >
          {pending ? "Publishing..." : "Publish Scenario"}
        </button>
      </section>

      {publishedId && (
        <section className="notice" role="status">
          <h3>Scenario Ready</h3>
          <p>Your scenario is ready to use with students.</p>
          <Link to={`/instructor/scenarios/versions/${publishedId}`}>
            Launch Simulation
          </Link>
        </section>
      )}

      {error ? <ErrorState error={error} /> : null}
    </div>
  );
}

function PreviewSummary({
  preview,
  model,
  content,
}: {
  preview: MacroPreviewResult | MarketPreviewResult;
  model: Model;
  content: AnyContent;
}) {
  if ("quarters" in preview) {
    const first = preview.quarters[0]?.state;
    const last = preview.quarters[preview.quarters.length - 1]?.state;

    return (
      <section className="preview" aria-live="polite">
        <h4>Preview Economy</h4>
        {first && last ? (
          <ul>
            <li>
              Inflation: {first.inflation.toFixed(1)} {"->"}{" "}
              {last.inflation.toFixed(1)}
            </li>
            <li>
              Growth index: {first.outputIndex.toFixed(0)} {"->"}{" "}
              {last.outputIndex.toFixed(0)}
            </li>
            <li>
              Unemployment: {first.unemployment.toFixed(1)} {"->"}{" "}
              {last.unemployment.toFixed(1)}
            </li>
          </ul>
        ) : (
          <p>{preview.quarters.length} projected rounds returned.</p>
        )}
        <PreviewEventTimeline model={model} content={content} />
      </section>
    );
  }

  const first = preview.rounds[0];
  const last = preview.rounds[preview.rounds.length - 1];
  return (
    <section className="preview" aria-live="polite">
      <h4>Preview Market</h4>
      {first && last ? (
        <ul>
          <li>
            Price: {first.price.toFixed(2)} {"->"} {last.price.toFixed(2)}
          </li>
          <li>
            Quantity exchanged: {first.quantityExchanged.toFixed(0)} {"->"}{" "}
            {last.quantityExchanged.toFixed(0)}
          </li>
          <li>
            Total surplus: {first.totalSurplus.toFixed(1)} {"->"}{" "}
            {last.totalSurplus.toFixed(1)}
          </li>
        </ul>
      ) : (
        <p>{preview.rounds.length} projected rounds returned.</p>
      )}
      <PreviewEventTimeline model={model} content={content} />
    </section>
  );
}

function PreviewEventTimeline({
  model,
  content,
}: {
  model: Model;
  content: AnyContent;
}) {
  const rounds =
    model === "macro"
      ? (content as MacroScenarioContent).maximumQuarters
      : (content as CompetitiveMarketScenarioContent).maximumRounds;
  const events =
    model === "macro"
      ? (content as MacroScenarioContent).scheduledShocks
      : ((content as CompetitiveMarketScenarioContent).configuration
          .scheduledShocks ?? []);
  return (
    <div className="preview-timeline">
      {Array.from({ length: rounds }).map((_, index) => {
        const round = index + 1;
        const hasEvent = events.some((event) => event.round === round);
        return (
          <span key={round} className={hasEvent ? "event-round" : ""}>
            Round {round}
            {hasEvent ? " ⚡" : ""}
          </span>
        );
      })}
    </div>
  );
}

function buildMacroRoles(content: MacroScenarioContent): BuilderRole[] {
  const decisionLabels = new Map<string, string>(
    macroDecisionCatalog.map((decision) => [decision.code, decision.label]),
  );

  return content.roles.map((role) => {
    const meta = macroRoleMeta[role.code] ?? {
      name: role.code,
      description: "Custom role",
    };
    const allowed = macroDecisionCatalog
      .filter((decision) => decision.role === role.code)
      .filter((decision) => content.enabledActions.includes(decision.code))
      .map((decision) => decision.label);

    return {
      code: role.code,
      name: meta.name,
      description: meta.description,
      enabled: role.enabled,
      canSeeIndicators: role.canSeeInstitutionalIndicators,
      decisions: allowed.length
        ? allowed
        : content.enabledActions.map(
            (code) => decisionLabels.get(code) ?? code,
          ),
      objectives: role.objectives,
    };
  });
}

function applyMacroRoleUpdate(
  content: MacroScenarioContent,
  updated: BuilderRole,
): MacroScenarioContent {
  const labelToCode = new Map<string, string>(
    macroDecisionCatalog.map((decision) => [decision.label, decision.code]),
  );
  const nextRoleCodes = content.roles.map((role) => role.code);

  const nextRoles = nextRoleCodes.includes(updated.code)
    ? content.roles.map((role) =>
        role.code === updated.code
          ? {
              ...role,
              enabled: updated.enabled,
              canSeeInstitutionalIndicators: updated.canSeeIndicators,
              objectives: updated.objectives,
            }
          : role,
      )
    : [
        ...content.roles,
        {
          code: updated.code,
          enabled: updated.enabled,
          canSeeInstitutionalIndicators: updated.canSeeIndicators,
          objectives: updated.objectives,
        },
      ];

  const roleCodes = new Set(nextRoles.map((role) => role.code));
  const mappedCodes = updated.decisions
    .map((decision) => labelToCode.get(decision))
    .filter(Boolean) as string[];

  const keepExistingOtherRoles = content.enabledActions.filter((code) => {
    const catalog = macroDecisionCatalog.find(
      (decision) => decision.code === code,
    );
    if (!catalog) return true;
    return catalog.role !== updated.code;
  });

  const nextEnabledActions = [
    ...new Set([...keepExistingOtherRoles, ...mappedCodes]),
  ];

  const roleNameChanged = macroRoleMeta[updated.code]?.name !== updated.name;
  const roleDescriptionChanged =
    macroRoleMeta[updated.code]?.description !== updated.description;
  const roleNotes =
    roleNameChanged || roleDescriptionChanged
      ? [`Role ${updated.name}: ${updated.description}`]
      : [];

  return {
    ...content,
    roles: nextRoles.filter((role) => roleCodes.has(role.code)),
    enabledActions: nextEnabledActions,
    debriefPrompts: [
      ...(content.debriefPrompts ?? []).filter(
        (item) => !item.startsWith(`ROLE::${updated.code}::`),
      ),
      ...roleNotes.map((note) => `ROLE::${updated.code}::${note}`),
    ],
  };
}

function buildMarketRoles(
  content: CompetitiveMarketScenarioContent,
): BuilderRole[] {
  const decisionLabels = new Map<string, string>(
    marketDecisionCatalog.map((decision) => [decision.code, decision.label]),
  );
  const enabledActions = content.enabledActions ?? [];

  return content.roles.map((role) => {
    const meta = marketRoleMeta[role.code] ?? {
      name: role.code,
      description: "Custom role",
    };
    const allowed = marketDecisionCatalog
      .filter((decision) => decision.role === role.code)
      .filter((decision) => enabledActions.includes(decision.code))
      .map((decision) => decision.label);

    return {
      code: role.code,
      name: meta.name,
      description: meta.description,
      enabled: role.enabled,
      canSeeIndicators: role.seePrivateInformation,
      decisions: allowed.length
        ? allowed
        : enabledActions.map((code) => decisionLabels.get(code) ?? code),
      objectives: role.objectives,
    };
  });
}

function applyMarketRoleUpdate(
  content: CompetitiveMarketScenarioContent,
  updated: BuilderRole,
): CompetitiveMarketScenarioContent {
  const labelToCode = new Map<string, string>(
    marketDecisionCatalog.map((decision) => [decision.label, decision.code]),
  );
  const nextRoleCodes = content.roles.map((role) => role.code);

  const nextRoles = nextRoleCodes.includes(updated.code)
    ? content.roles.map((role) =>
        role.code === updated.code
          ? {
              ...role,
              enabled: updated.enabled,
              seePrivateInformation: updated.canSeeIndicators,
              objectives: updated.objectives,
            }
          : role,
      )
    : [
        ...content.roles,
        {
          code: updated.code,
          enabled: updated.enabled,
          seePrivateInformation: updated.canSeeIndicators,
          objectives: updated.objectives,
        },
      ];

  const mappedCodes = updated.decisions
    .map((decision) => labelToCode.get(decision))
    .filter(Boolean) as string[];
  const currentEnabled = content.enabledActions ?? [];
  const keepExistingOtherRoles = currentEnabled.filter((code) => {
    const catalog = marketDecisionCatalog.find(
      (decision) => decision.code === code,
    );
    if (!catalog) return true;
    return catalog.role !== updated.code;
  });

  return {
    ...content,
    roles: nextRoles,
    enabledActions: [...new Set([...keepExistingOtherRoles, ...mappedCodes])],
  };
}
