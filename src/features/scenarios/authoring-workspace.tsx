import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/runtime';
import { ApiProblem } from '../../lib/errors/problem';
import { ErrorState, LoadingState } from '../../components/states';
import { scenarioDiscovery } from './discovery';
import { BackendScenarioBlueprintGenerator } from './generator';
import type {
  AuthoringCatalog,
  BlueprintValidationReport,
  BlueprintIssue,
  ScenarioAiRevisionResult,
  ScenarioBlueprint,
  ScenarioModelRecommendation,
} from '../../types/authoring';

const sections = [
  { id: 'overview', title: 'Overview' },
  { id: 'learning-objectives', title: 'Learning Objectives' },
  { id: 'roles', title: 'Roles' },
  { id: 'decisions', title: 'Student Decisions' },
  { id: 'starting-world', title: 'Starting World' },
  { id: 'rules', title: 'Economic Rules' },
  { id: 'shocks', title: 'Shocks' },
  { id: 'assessment', title: 'Assessment' },
  { id: 'final-review', title: 'Final Review' },
] as const;
type SectionId = typeof sections[number]['id'];
type Proposal = { id: string; status: string; version: number; currentRevisionNumber: number; linkedDraftId?: string; modelIdentifier?: string; modelVersion?: string; approvedSections?: string[]; sections?: Record<string, string>; reviewVersion?: number };
type PendingRevision = ScenarioAiRevisionResult & { section: SectionId; instruction: string; originalBlueprint: ScenarioBlueprint };
type AcceptedRevision = { instruction: string };
const dependentSections: Record<SectionId, SectionId[]> = {
  overview: ['learning-objectives', 'roles', 'decisions', 'starting-world', 'rules', 'shocks', 'assessment', 'final-review'],
  'learning-objectives': ['rules', 'shocks', 'assessment', 'final-review'],
  roles: ['decisions', 'rules', 'final-review'],
  decisions: ['rules', 'final-review'],
  'starting-world': ['rules', 'shocks', 'final-review'],
  rules: ['shocks', 'assessment', 'final-review'],
  shocks: ['assessment', 'final-review'],
  assessment: ['final-review'],
  'final-review': [],
};
const modelLabels: Record<string, string> = {
  'Economics.CompetitiveMarket': 'Competitive Market',
  'Economics.ShortRunMacro': 'Short-Run Macroeconomics',
};
const humanize = (code: string) => code.replace(/[_-]/g, ' ').replace(/\b\w/g, x => x.toUpperCase());
const terminal = (status?: string) => status === 'Rejected' || status === 'ConvertedToScenario';

export function AiScenarioAuthoringPage() {
  const { api } = useRuntime();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const discovery = useMemo(() => scenarioDiscovery(api), [api]);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('Economics.ShortRunMacro');
  const [modelVersion, setModelVersion] = useState('1.0.0');
  const [recommendation, setRecommendation] = useState<ScenarioModelRecommendation | null>(null);
  const [modelChosen, setModelChosen] = useState(false);
  const [blueprint, setBlueprint] = useState<ScenarioBlueprint | null>(null);
  const [saved, setSaved] = useState<ScenarioBlueprint | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [report, setReport] = useState<BlueprintValidationReport | null>(null);
  const [semanticWarnings, setSemanticWarnings] = useState<BlueprintIssue[]>([]);
  const [validatedVersion, setValidatedVersion] = useState<number | null>(null);
  const [validatedRevision, setValidatedRevision] = useState<number | null>(null);
  const [approved, setApproved] = useState<Set<SectionId>>(() => new Set());
  const [sectionStates, setSectionStates] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [revisionInstruction, setRevisionInstruction] = useState('');
  const [revision, setRevision] = useState<PendingRevision | null>(null);
  const [acceptedRevision, setAcceptedRevision] = useState<AcceptedRevision | null>(null);
  const [discardDialog, setDiscardDialog] = useState(false);
  const [approvalDialog, setApprovalDialog] = useState(false);
  const [sectionInstruction, setSectionInstruction] = useState('');
  const proposalId = searchParams.get('proposal');
  const catalog = useQuery({
    queryKey: ['authoring-catalog', model, modelVersion],
    queryFn: ({ signal }) => discovery.authoringCatalog(model, modelVersion, signal),
    enabled: !!modelChosen || !!proposalId,
  });
  const recovered = useQuery({
    queryKey: ['scenario-proposal', proposalId],
    queryFn: ({ signal }) => discovery.proposal(proposalId!, signal),
    enabled: !!proposalId && !proposal,
  });
  const dirty = !!blueprint && (!saved || JSON.stringify(blueprint) !== JSON.stringify(saved));
  const validationCurrent = !!proposal && !dirty && !report?.blockers.length &&
    report?.isValid === true && validatedVersion === proposal.version && validatedRevision === proposal.currentRevisionNumber;
  const reviewSections = sections.filter(s => s.id !== 'final-review').map(s => s.id);
  const fullyReviewed = reviewSections.every(s => approved.has(s) && sectionStates[s] !== 'Stale' && sectionStates[s] !== 'NeedsChanges');
  const eligible = !!proposal && !!blueprint && !dirty && fullyReviewed && validationCurrent &&
    proposal.status === 'Validated';

  useEffect(() => {
    const value = recovered.data;
    if (!value || blueprint) return;
    const restored = value.blueprint;
    setBlueprint(restored);
    setSaved(restored);
    setProposal(value);
    setModel(value.modelIdentifier);
    setModelVersion(value.modelVersion);
    setModelChosen(true);
    setSectionStates(value.sections ?? {});
    setReport(value.validationSnapshot?.report ?? null);
    setValidatedVersion(value.validationSnapshot?.proposalVersion ?? null);
    setValidatedRevision(value.validationSnapshot?.revisionNumber ?? null);
    setSemanticWarnings(value.semanticWarnings ?? []);
    setApproved(new Set((value.approvedSections ?? []).filter((section): section is SectionId =>
      sections.some(item => item.id === section && item.id !== 'final-review'))));
    setActiveSection('overview');
  }, [recovered.data, blueprint]);

  useEffect(() => {
    if (!dirty) return;
    const preventClose = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventClose);
    return () => window.removeEventListener('beforeunload', preventClose);
  }, [dirty]);

  if (proposalId && recovered.isPending && !proposal)
    return <LoadingState label="Recovering your saved proposal" />;
  if (proposalId && recovered.isError && !proposal)
    return <ErrorState error={recovered.error} retry={() => void recovered.refetch()} />;
  if (catalog.isError)
    return <ErrorState error={catalog.error} retry={() => void catalog.refetch()} />;

  const recommend = async () => {
    setBusy(true); setError(undefined); setProgress('Asking the authoring service to recommend a model…');
    try {
      const result = await discovery.recommendModel(prompt);
      setRecommendation(result);
      setModel(result.modelIdentifier);
      setModelVersion(result.modelVersion);
      setModelChosen(false);
      setProgress('');
    } catch (cause) { setError(cause); setProgress(''); }
    finally { setBusy(false); }
  };

  const createProposal = async (result: ScenarioBlueprint) => {
    const created = await discovery.createProposal(result);
    setProposal(created);
    setSaved(result);
    setBlueprint(result);
    setReport(null);
    setValidatedVersion(null);
    setApproved(new Set());
    setSearchParams({ proposal: created.id }, { replace: true });
    setActiveSection('overview');
  };

  const generate = async () => {
    setBusy(true); setError(undefined); setProgress('Generating a scenario blueprint with the selected model…');
    try {
      if (!catalog.data) throw new Error('The selected model catalog is not available.');
      const result = await new BackendScenarioBlueprintGenerator(api).generateProposal({
        professorPrompt: prompt,
        modelIdentifier: model,
        modelVersion,
        authoringCatalog: catalog.data,
      }, setProgress);
      setProgress('Saving the generated proposal for recovery…');
      await createProposal(result.blueprint);
      setReport(result.validation);
      setSemanticWarnings(result.semanticWarnings ?? result.semanticValidation?.warnings ?? []);
      setProgress('');
    } catch (cause) { setError(cause); setProgress(''); }
    finally { setBusy(false); }
  };

  const save = async (source = acceptedRevision ? 'AiRevision' : 'ProfessorEdit', instruction = acceptedRevision?.instruction) => {
    if (!blueprint) return;
    setBusy(true); setError(undefined);
    try {
      const result = proposal
        ? await discovery.updateProposal(proposal.id, proposal.version, blueprint, source, instruction)
        : await discovery.createProposal(blueprint);
      setProposal(result);
      setSaved(blueprint);
      setReport(null);
      setValidatedVersion(null);
      const recovered = await discovery.proposal(result.id);
      setReport(recovered.validationSnapshot?.report ?? null);
      setValidatedVersion(recovered.validationSnapshot?.proposalVersion ?? null);
      setValidatedRevision(recovered.validationSnapshot?.revisionNumber ?? null);
      setProposal(recovered);
      setSectionStates(recovered.sections ?? {});
      setApproved(new Set((recovered.approvedSections ?? []).filter((s): s is SectionId => reviewSections.some(section => section === s))));
      setSemanticWarnings(recovered.semanticWarnings ?? []);
      setRevision(null);
      setAcceptedRevision(null);
    } catch (cause) { setError(cause); }
    finally { setBusy(false); }
  };

  const validate = async () => {
    if (!proposal) return;
    setBusy(true); setError(undefined); setProgress('Validating the saved proposal against backend model rules…');
    try {
      const result = await discovery.validateProposal(proposal.id);
      setReport(result);
      setSemanticWarnings(result.semanticWarnings ?? []);
      setValidatedVersion(result.proposalVersion ?? proposal.version);
      setValidatedRevision(result.revisionNumber ?? proposal.currentRevisionNumber);
      setProposal(current => current ? { ...current, status: result.isValid ? 'Validated' : 'Draft' } : current);
      setProgress('');
      setActiveSection('final-review');
    } catch (cause) { setError(cause); setProgress(''); }
    finally { setBusy(false); }
  };

  const revise = async () => {
    if (!proposal || !blueprint || !revisionInstruction.trim() || activeSection === 'final-review') return;
    if (dirty) {
      setError(new Error('Save your current edits before requesting an AI revision.'));
      return;
    }
    setBusy(true); setError(undefined); setProgress(`Preparing an AI revision for ${sections.find(x => x.id === activeSection)?.title ?? 'this section'}…`);
    try {
      const result = await discovery.reviseProposalSection(proposal.id, proposal.version, activeSection, revisionInstruction);
      setSemanticWarnings(result.semanticWarnings ?? result.semanticValidation?.warnings ?? []);
      setRevision({ ...result, section: activeSection, instruction: revisionInstruction, originalBlueprint: blueprint });
      setProgress('');
    } catch (cause) { setError(cause); setProgress(''); }
    finally { setBusy(false); }
  };

  const editBlueprint = (next: ScenarioBlueprint) => {
    setBlueprint(next);
    const dependents = revision?.dependentSectionsAffected?.filter((s): s is SectionId => sections.some(x => x.id === s)) ?? dependentSections[activeSection];
    const invalidated = new Set<SectionId>([activeSection, ...dependents]);
    setApproved(current => new Set([...current].filter(section => !invalidated.has(section))));
    setSectionStates(current => ({ ...current, [activeSection]: 'NeedsChanges', ...Object.fromEntries(dependents.map(section => [section, 'Stale'])) }));
    setRevision(null);
  };

  const approveSection = async () => {
    if (!proposal || !blueprint || dirty || terminal(proposal.status) || activeSection === 'final-review') return;
    setBusy(true); setError(undefined);
    try {
      const result = await discovery.approveProposalSection(proposal.id, proposal.version, activeSection);
      setProposal(current => current ? { ...current, status: result.status, version: result.version, currentRevisionNumber: result.currentRevisionNumber } : current);
      setSectionStates(result.sections ?? {});
      setApproved(new Set(result.approvedSections.filter((section): section is SectionId =>
        sections.some(item => item.id === section && item.id !== 'final-review'))));
      const next = sections.findIndex(s => s.id === activeSection) + 1;
      setActiveSection(sections[Math.min(next, sections.length - 1)]?.id ?? 'final-review');
    } catch (cause) { setError(cause); }
    finally { setBusy(false); }
  };

  const changeModel = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    if (blueprint && next !== model) {
      setModel(next);
      setModelVersion('1.0.0');
      setModelChosen(true);
      setRecommendation(null);
      setDiscardDialog(true);
      return;
    }
    setModel(next);
    setModelVersion('1.0.0');
    setModelChosen(true);
  };

  const confirmNewProposal = () => {
    setBlueprint(null); setSaved(null); setProposal(null); setReport(null); setValidatedVersion(null);
    setApproved(new Set()); setRevision(null); setDiscardDialog(false); setPrompt('');
    setSearchParams({}, { replace: true });
    setRecommendation(null); setModelChosen(true);
  };

  const openDraft = () => {
    if (!proposal?.linkedDraftId) return;
    const kind = (proposal.modelIdentifier ?? blueprint?.modelIdentifier ?? '').includes('Competitive') ? 'market' : 'macro';
    navigate(`/instructor/scenarios/${kind}/${proposal.linkedDraftId}`);
  };

  const sectionStatus = (section: SectionId) => {
    if (sectionStates[section] === 'Stale') return 'Stale';
    if (sectionStates[section] === 'NeedsChanges') return 'Needs Changes';
    if (approved.has(section)) return 'Approved';
    if (report && !validationCurrent && (section === 'rules' || section === 'final-review')) return 'Validation Required';
    if (dirty && activeSection === section) return 'Needs Changes';
    return 'Not Reviewed';
  };

  return (
    <main className="scenario-authoring">
      <header className="page-heading">
        <p className="eyebrow">Instructor authoring studio</p>
        <h1>Create a Simulation with AI</h1>
        <p>Turn a learning goal into a reviewable proposal. Your work is saved as a draft; publishing remains in the normal scenario editor.</p>
      </header>

      {!blueprint && (
        <section className="card prompt-card" aria-labelledby="learning-goal-title">
          <div className="prompt-intro">
            <p className="eyebrow">Start with a learning goal</p>
            <h2 id="learning-goal-title">What should students learn?</h2>
            <p>Describe the economic concept, the decisions students should make, and the outcome they should understand.</p>
          </div>
          <label htmlFor="learning-goal">Learning concept</label>
          <textarea id="learning-goal" rows={5} value={prompt} maxLength={4000} onChange={event => setPrompt(event.target.value)} placeholder="For example: Create an introductory economics simulation teaching how increased consumer income shifts demand and changes market equilibrium." />
          <p className="muted">{prompt.length}/4000 characters. The server sends your request to its configured AI provider; no provider key is sent to the browser.</p>
          <div className="prompt-examples" aria-label="Example learning goals">
            {['Demand and supply equilibrium', 'Stagflation', 'Inflation and unemployment', 'Price ceilings and shortages', 'Tax incidence'].map(example =>
              <button className="secondary" key={example} type="button" onClick={() => setPrompt(`Create an introductory economics simulation teaching ${example.toLowerCase()}.`)}>{example}</button>)}
          </div>
          <div className="authoring-actions">
            <button type="button" disabled={!prompt.trim() || busy} onClick={() => void recommend()}>{busy && progress.startsWith('Asking') ? 'Recommending…' : 'Recommend a simulation model'}</button>
          </div>
          {recommendation && <section className="recommendation-card" aria-label="Model recommendation">
            <div><p className="eyebrow">Model suggestion</p><h3>{modelLabels[recommendation.modelIdentifier] ?? humanize(recommendation.modelIdentifier)}</h3><p>{recommendation.rationale}</p><p className="muted">Suggested from the learning-goal topic · model version {recommendation.modelVersion}</p></div>
            <button type="button" disabled={busy} onClick={() => { setModel(recommendation.modelIdentifier); setModelVersion(recommendation.modelVersion); setModelChosen(true); }}>Use this model</button>
          </section>}
          <label htmlFor="simulation-model">Simulation model</label>
          <select id="simulation-model" value={model} onChange={changeModel}>
            <option value="Economics.ShortRunMacro">Short-Run Macroeconomics</option>
            <option value="Economics.CompetitiveMarket">Competitive Market</option>
          </select>
          {recommendation && model !== recommendation.modelIdentifier && <p className="notice">You selected a different model. The recommendation will not replace your choice.</p>}
          {modelChosen && <button className="secondary" type="button" disabled={!prompt.trim() || busy || catalog.isPending} onClick={() => void generate()}>
            {busy && !progress.startsWith('Asking') ? 'Creating proposal…' : `Generate with ${modelLabels[model] ?? humanize(model)}`}
          </button>}
          {catalog.isPending && modelChosen && <p role="status">Loading the selected model's authoring catalog…</p>}
          {progress && <p className="authoring-progress" role="status" aria-live="polite"><span className="loading-mark" aria-hidden="true"/>{progress}</p>}
          {error !== undefined && <ErrorState error={error}/>}
        </section>
      )}

      {blueprint && proposal && catalog.data && (
        <div className="scenario-workspace">
          <nav className="scenario-step-nav" aria-label="Scenario review sections">
            <p className="eyebrow">Review proposal</p>
            {sections.map((section, index) => <button key={section.id} type="button" className={activeSection === section.id ? 'active' : ''} aria-current={activeSection === section.id ? 'step' : undefined} onClick={() => setActiveSection(section.id)}>
              <span className="step-number">{index + 1}</span><span>{section.title}<small>{sectionStatus(section.id)}</small></span>
            </button>)}
            <p className="muted">Proposal v{proposal.version} · revision {proposal.currentRevisionNumber}</p>
            {dirty && <p role="status" className="notice">Unsaved changes</p>}
            {report && !validationCurrent && <p role="status" className="notice">Saved proposal needs current validation.</p>}
          </nav>

          <section className="scenario-section card" aria-labelledby="current-section-title">
            <p className="eyebrow">Section {sections.findIndex(s => s.id === activeSection) + 1} of {sections.length}</p>
            <h2 id="current-section-title">{sections.find(s => s.id === activeSection)?.title}</h2>
            <SectionEditor section={activeSection} blueprint={blueprint} catalog={catalog.data} report={report} onChange={editBlueprint} onNavigate={setActiveSection}/>
            {revision?.section === activeSection && <RevisionReview revision={revision} pending={busy} onRetry={() => void revise()} onReject={() => setRevision(null)} onAccept={() => { setSemanticWarnings(revision.semanticWarnings ?? revision.semanticValidation?.warnings ?? []); editBlueprint(revision.proposedBlueprint); setAcceptedRevision({ instruction: revision.instruction }); setRevision(null); setRevisionInstruction(''); }}/>}
            {activeSection !== 'final-review' && <>
              <div className="section-ai-tools">
                <label htmlFor="revision-instruction">Ask AI to improve this section</label>
                <textarea id="revision-instruction" rows={3} value={revisionInstruction} onChange={event => setRevisionInstruction(event.target.value)} placeholder={`For example: make the ${sections.find(s => s.id === activeSection)?.title.toLowerCase()} clearer for first-year students.`}/>
                <button className="secondary" type="button" disabled={!proposal || activeSection === 'starting-world' || dirty || !revisionInstruction.trim() || busy || terminal(proposal.status)} onClick={() => void revise()}>{busy && progress.startsWith('Preparing') ? 'Preparing suggestion…' : 'Generate a section revision'}</button>
                {activeSection === 'starting-world' && <p className="muted">AI revision is unavailable for this model-specific structured data. You can edit supported values manually.</p>}
              </div>
              {progress && <p role="status" className="authoring-progress" aria-live="polite">{progress}</p>}
              <div className="authoring-actions section-actions">
                <button type="button" className="secondary" disabled={!dirty || busy || terminal(proposal.status)} onClick={() => void save()}>{acceptedRevision ? 'Save accepted AI revision' : 'Save changes'}</button>
                <button type="button" disabled={!proposal || dirty || busy || approved.has(activeSection) || terminal(proposal.status)} onClick={approveSection}>Approve section</button>
              </div>
              {dirty && <p className="muted">Save your changes before approving this section. Editing a section clears its approval and dependent review statuses.</p>}
            </>}
            {error !== undefined && <ErrorState error={error}/>}
          </section>

          <aside className="scenario-assistant" aria-label="Review guidance">
            <section className="card">
              <p className="eyebrow">Review context</p>
              <h2>{modelLabels[blueprint.modelIdentifier] ?? humanize(blueprint.modelIdentifier)}</h2>
              <p>Version {blueprint.modelVersion}</p>
              {recommendation && <p>{recommendation.rationale}</p>}
              <p className="muted">AI suggestions are proposals. They never replace your work without acceptance and save.</p>
            </section>
            <section className="card">
              <h3>Review progress</h3>
              <p>Validation freshness: {validatedVersion === null ? 'Not yet validated' : validationCurrent ? 'Current' : 'Stale'}</p>
              <ul className="review-progress">{sections.filter(s => s.id !== 'final-review').map(section => <li key={section.id}><span>{section.title}</span><strong>{sectionStatus(section.id)}</strong></li>)}</ul>
            </section>
            {(report || semanticWarnings.length > 0) && <section className="card">
              <h3>Backend validation</h3>
              {report && <><p>{report.isValid ? 'No blocking issues were found.' : `${report.blockers.length} blocking issue(s) require attention.`}</p>
              {report.blockers.length > 0 && <h4>Blocking Issues</h4>}{report.blockers.slice(0, 3).map(issue => <button className="issue-link" type="button" key={issue.code + issue.path} onClick={() => setActiveSection(sectionForPath(issue.path))}>{issue.message}</button>)}
              {report.warnings.length > 0 && <h4>Structural Warnings</h4>}{report.warnings.slice(0, 3).map(issue => <p className="muted" key={issue.code + issue.path}>{issue.message}</p>)}</>}
              {semanticWarnings.length > 0 && <><h4>Pedagogical / Semantic Warnings</h4><ul>{semanticWarnings.map((issue, index) => <li key={issue.code + issue.path + index}><button type="button" className="issue-link" onClick={() => setActiveSection(sectionForPath(issue.path))}>{issue.message}</button></li>)}</ul></>}
            </section>}
          </aside>

          {activeSection === 'final-review' && <section className="card final-review">
            <h2>Final review</h2>
            <p>Sections approved: {approved.size}/{reviewSections.length}. Review status does not replace backend validation.</p>
            {dirty && <p role="status" className="notice">Save your changes before validation or final approval.</p>}
            <button type="button" disabled={!proposal || dirty || busy || terminal(proposal.status)} onClick={() => void validate()}>{busy && progress.startsWith('Validating') ? 'Validating…' : 'Validate saved proposal'}</button>
            {report && <ValidationReport report={report} onNavigate={setActiveSection}/>}
            {proposal.status === 'ConvertedToScenario' ? <button type="button" onClick={openDraft}>Open scenario draft</button> : <>
              <button type="button" disabled={!eligible || busy} onClick={() => setApprovalDialog(true)}>Approve proposal and continue to editor</button>
              {!eligible && <p className="muted">Final approval requires all sections approved, no unsaved edits, and a current successful backend validation.</p>}
            </>}
          </section>}
        </div>
      )}

      {discardDialog && <div role="dialog" aria-modal="true" aria-labelledby="new-proposal-title" className="confirmation-backdrop"><section className="card confirmation-dialog">
        <h2 id="new-proposal-title">Start a new proposal?</h2><p>Your current proposal remains saved on the server. This workspace will open a new proposal, and its section review checklist must be completed separately.</p>
        <button className="secondary" type="button" onClick={() => setDiscardDialog(false)}>Keep current proposal</button><button type="button" onClick={confirmNewProposal}>Continue with new model</button>
      </section></div>}

      {approvalDialog && <div role="dialog" aria-modal="true" aria-labelledby="approve-proposal-title" className="confirmation-backdrop"><section className="card confirmation-dialog">
        <h2 id="approve-proposal-title">Approve this scenario proposal?</h2><p>This creates a normal scenario draft. It does not publish the scenario.</p>
        <button className="secondary" type="button" onClick={() => setApprovalDialog(false)}>Cancel</button><button type="button" disabled={busy} onClick={() => void approveProposal(api, proposal!, setProposal, setError, setBusy, setApprovalDialog, navigate)}>{busy ? 'Creating draft…' : 'Confirm approval'}</button>
      </section></div>}
    </main>
  );
}

async function approveProposal(
  api: Parameters<typeof scenarioDiscovery>[0],
  proposal: Proposal,
  setProposal: (value: Proposal) => void,
  setError: (value: unknown) => void,
  setBusy: (value: boolean) => void,
  setOpen: (value: boolean) => void,
  navigate: ReturnType<typeof useNavigate>,
) {
  setBusy(true); setError(undefined);
  try {
    const result = await scenarioDiscovery(api).approveProposal(proposal.id, proposal.version, crypto.randomUUID());
    if (typeof result?.scenarioDraftId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.scenarioDraftId) || result.scenarioDraftId === '00000000-0000-0000-0000-000000000000') throw new ApiProblem(502, 'about:blank', 'Draft handoff unavailable', 'Approval returned an invalid draft reference. Reload this saved proposal to recover the created draft.');
    if (!['Economics.CompetitiveMarket', 'Economics.ShortRunMacro'].includes(result.modelIdentifier)) throw new ApiProblem(502, 'about:blank', 'Draft handoff unavailable', 'Approval returned an unsupported model. Reload this saved proposal to recover the created draft.');
    const next = { ...proposal, ...result, linkedDraftId: result.scenarioDraftId, status: 'ConvertedToScenario' };
    setProposal(next); setOpen(false);
    const kind = (result.modelIdentifier ?? proposal.modelIdentifier ?? '').includes('Competitive') ? 'market' : 'macro';
    navigate(`/instructor/scenarios/${kind}/${result.scenarioDraftId}`);
  } catch (cause) { setError(cause); setOpen(false); }
  finally { setBusy(false); }
}

function SectionEditor({ section, blueprint, catalog, report, onChange, onNavigate }: {
  section: SectionId;
  blueprint: ScenarioBlueprint;
  catalog: AuthoringCatalog;
  report: BlueprintValidationReport | null;
  onChange: (value: ScenarioBlueprint) => void;
  onNavigate: (value: SectionId) => void;
}) {
  const text = (label: string, value: string, update: (value: string) => void, multiline = false) => <label className="form-field">{label}{multiline
    ? <textarea rows={3} value={value} onChange={event => update(event.target.value)}/>
    : <input value={value} onChange={event => update(event.target.value)}/>}</label>;
  if (section === 'overview') return <div className="section-editor">
    {text('Scenario title', blueprint.title, title => onChange({ ...blueprint, title }))}
    {text('Summary', blueprint.summary, summary => onChange({ ...blueprint, summary }), true)}
    {text('Student briefing', blueprint.studentBriefing, studentBriefing => onChange({ ...blueprint, studentBriefing }), true)}
    {text('Instructor notes', blueprint.instructorNotes ?? '', instructorNotes => onChange({ ...blueprint, instructorNotes }), true)}
    <label>Recommended rounds<input type="number" min="1" value={blueprint.recommendedRounds} onChange={event => onChange({ ...blueprint, recommendedRounds: Number(event.target.value) })}/></label>
    <p className="muted">Model {blueprint.modelIdentifier} · version {blueprint.modelVersion}</p>
  </div>;
  if (section === 'learning-objectives') return <div className="section-editor">
    {blueprint.learningObjectives.map((objective, index) => <article className="review-item" key={`${objective.code}-${index}`}>
      <strong>Objective {index + 1}</strong><p className="muted">Code: {humanize(objective.code)}</p>
      {text('Learning objective', objective.description, description => onChange({ ...blueprint, learningObjectives: blueprint.learningObjectives.map((item, i) => i === index ? { ...item, description } : item) }), true)}
      <button className="secondary" type="button" onClick={() => onChange({ ...blueprint, learningObjectives: blueprint.learningObjectives.filter((_, i) => i !== index) })}>Remove objective</button>
    </article>)}
    <button className="secondary" type="button" onClick={() => onChange({ ...blueprint, learningObjectives: [...blueprint.learningObjectives, { code: `objective-${blueprint.learningObjectives.length + 1}`, description: '' }] })}>Add learning objective</button>
  </div>;
  if (section === 'roles') return <div className="section-editor role-grid">
    {blueprint.roles.map((role, index) => <article className="review-item" key={`${role.code}-${index}`}>
      <p className="eyebrow">{humanize(role.code)}</p>
      {text('Role name', role.displayName, displayName => onChange({ ...blueprint, roles: blueprint.roles.map((item, i) => i === index ? { ...item, displayName } : item) }))}
      {text('Description', role.description, description => onChange({ ...blueprint, roles: blueprint.roles.map((item, i) => i === index ? { ...item, description } : item) }), true)}
      {text('Responsibilities (one per line)', role.responsibilities.join('\n'), value => onChange({ ...blueprint, roles: blueprint.roles.map((item, i) => i === index ? { ...item, responsibilities: value.split('\n') } : item) }), true)}
      <p><strong>Allowed decisions:</strong> {role.decisionCodes.map(humanize).join(', ') || 'None specified'}</p>
      <p className="muted">Participants: {role.minimumParticipants}–{role.maximumParticipants}</p>
    </article>)}
  </div>;
  if (section === 'decisions') return <div className="section-editor">
    {blueprint.decisions.map((decision, index) => <article className="review-item" key={`${decision.code}-${index}`}>
      <p className="eyebrow">{humanize(decision.code)}</p>
      {text('Decision name', decision.displayName, displayName => onChange({ ...blueprint, decisions: blueprint.decisions.map((item, i) => i === index ? { ...item, displayName } : item) }))}
      {text('Student-facing description', decision.description, description => onChange({ ...blueprint, decisions: blueprint.decisions.map((item, i) => i === index ? { ...item, description } : item) }), true)}
      <p><strong>Available to:</strong> {decision.allowedRoleCodes.map(humanize).join(', ')}</p>
      <p><strong>When:</strong> {decision.availablePhases.map(humanize).join(', ')}</p>
    </article>)}
  </div>;
  if (section === 'starting-world') return <div className="section-editor">
    <p>Review the model-provided starting conditions. Edit simple values directly; backend validation checks model compatibility.</p>
    <WorldValues value={blueprint.startingWorld} onChange={startingWorld => onChange({ ...blueprint, startingWorld })}/>
  </div>;
  if (section === 'rules') return <div className="section-editor">
    {blueprint.rules.map((rule, index) => <article className="review-item rule-card" key={`${rule.id}-${index}`}>
      <p className="eyebrow">{humanize(rule.trigger)}</p>
      {text('Rule name', rule.name, name => onChange({ ...blueprint, rules: blueprint.rules.map((item, i) => i === index ? { ...item, name } : item) }))}
      {text('Economic explanation', rule.explanation, explanation => onChange({ ...blueprint, rules: blueprint.rules.map((item, i) => i === index ? { ...item, explanation } : item) }), true)}
      {text('Instructor description', rule.description, description => onChange({ ...blueprint, rules: blueprint.rules.map((item, i) => i === index ? { ...item, description } : item) }), true)}
      <p><strong>Supported indicators:</strong> {extractCodes(rule.effects, 'variables').filter(code => catalog.indicators.includes(code)).map(humanize).join(', ') || 'No supported indicator effects identified'}</p>
      <details><summary>Advanced rule details</summary><h4>Conditions</h4><pre>{JSON.stringify(rule.conditions, null, 2)}</pre><h4>Effects</h4><pre>{JSON.stringify(rule.effects, null, 2)}</pre><p className="muted">These technical values are validated against the selected model's rule compiler.</p></details>
    </article>)}
  </div>;
  if (section === 'shocks') return <div className="section-editor">
    {blueprint.shockPool.map((shock, index) => {
      const effects = extractCodes(shock.effects, 'variables').filter(code => catalog.indicators.includes(code));
      return <article className="review-item shock-card" key={`${shock.code}-${index}`}>
        <p className="eyebrow">Round {shock.suggestedRound ?? 'Not scheduled'} · {humanize(shock.type)}</p>
        {text('Shock title', shock.title, title => onChange({ ...blueprint, shockPool: blueprint.shockPool.map((item, i) => i === index ? { ...item, title } : item) }))}
        {text('Student description', shock.studentFacingDescription, studentFacingDescription => onChange({ ...blueprint, shockPool: blueprint.shockPool.map((item, i) => i === index ? { ...item, studentFacingDescription } : item) }), true)}
        {text('Instructor explanation', shock.instructorExplanation, instructorExplanation => onChange({ ...blueprint, shockPool: blueprint.shockPool.map((item, i) => i === index ? { ...item, instructorExplanation } : item) }), true)}
        <label>Suggested round<input type="number" min="1" value={shock.suggestedRound ?? ''} onChange={event => onChange({ ...blueprint, shockPool: blueprint.shockPool.map((item, i) => i === index ? { ...item, suggestedRound: event.target.value ? Number(event.target.value) : null } : item) })}/></label>
        <label>Intensity<select value={shock.severity} onChange={event => onChange({ ...blueprint, shockPool: blueprint.shockPool.map((item, i) => i === index ? { ...item, severity: event.target.value } : item) })}>{Array.from(new Set([shock.severity, ...(catalog.intensities ?? [])])).map(value => <option key={value}>{value}</option>)}</select></label>
        <p><strong>Model-supported effects:</strong> {effects.map(humanize).join(', ') || 'No catalog-listed indicator effects identified'}</p>
      </article>;
    })}
  </div>;
  if (section === 'assessment') return <div className="section-editor">
    <p>Assessment dimensions come from the selected model's authoring catalog. This does not grade students.</p>
    {blueprint.assessmentRubric?.dimensions.map((dimension, index) => <article className="review-item" key={`${dimension.code}-${index}`}>
      <p className="eyebrow">{humanize(dimension.code)}</p>
      {text('Assessment description', dimension.description, description => onChange({
        ...blueprint,
        assessmentRubric: { ...blueprint.assessmentRubric!, dimensions: blueprint.assessmentRubric!.dimensions.map((item, i) => i === index ? { ...item, description } : item) },
      }), true)}
      <label>Maximum score<input type="number" min="0" value={dimension.maximumScore} onChange={event => onChange({ ...blueprint, assessmentRubric: { ...blueprint.assessmentRubric!, dimensions: blueprint.assessmentRubric!.dimensions.map((item, i) => i === index ? { ...item, maximumScore: Number(event.target.value) } : item) } })}/></label>
    </article>)}
    {!blueprint.assessmentRubric && <p>No assessment rubric was generated.</p>}
  </div>;
  return <div className="section-editor">
    <p>Review all sections, save changes, approve each section, then validate the saved proposal with the backend.</p>
    {report && <ValidationReport report={report} onNavigate={onNavigate}/>}
  </div>;
}

function WorldValues({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return <p>The model starting conditions are not a simple editable object. Review backend validation before continuing.</p>;
  const entries = Object.entries(value as Record<string, unknown>);
  return <div className="world-values">{entries.map(([key, item]) => {
    if (item === null || ['string', 'number', 'boolean'].includes(typeof item)) return <label key={key}>{humanize(key)}<input value={String(item ?? '')} onChange={event => {
      const raw = event.target.value;
      const nextValue = typeof item === 'number' ? (raw === '' ? 0 : Number(raw)) : typeof item === 'boolean' ? raw === 'true' : raw;
      onChange({ ...value, [key]: nextValue });
    }}/></label>;
    return <div className="world-value" key={key}><strong>{humanize(key)}</strong><p>{Array.isArray(item) ? item.map(String).join(', ') : 'Structured model values are preserved and checked by backend validation.'}</p></div>;
  })}</div>;
}

function RevisionReview({ revision, onReject, onAccept, onRetry, pending }: { revision: PendingRevision; onReject: () => void; onAccept: () => void; onRetry: () => void; pending: boolean }) {
  const notMaterial = revision.status === 'RevisionNotMaterial' || revision.revisionIssues?.some(issue => issue.code === 'RevisionNotMaterial');
  if (notMaterial) return <section className="revision-review" aria-label="AI revision was not material">
    <p className="eyebrow">No meaningful change produced</p>
    <p role="status">The AI could not produce a meaningful change to this section. Try a more specific instruction.</p>
    <div className="authoring-actions"><button type="button" disabled={pending} onClick={onRetry}>Try again</button><button type="button" disabled>Accept changes for review</button><button className="secondary" type="button" onClick={onReject}>Edit instruction</button><button className="secondary" type="button" onClick={onReject}>Cancel</button></div>
  </section>;
  return <section className="revision-review" aria-label="Review proposed AI change">
    <p className="eyebrow">Proposed change · not applied</p>
    <p>This suggestion only changes the selected section. It may affect economic rules and assessment criteria; review dependent sections after accepting.</p>
    <div className="revision-columns"><div><h3>Original</h3><SummaryList blueprint={revision.originalBlueprint} section={revision.section}/></div><div><h3>Proposed</h3><SummaryList blueprint={revision.proposedBlueprint} section={revision.section}/></div></div>
    {revision.validation.blockers.length > 0 && <><h4>Blocking Issues</h4><ul>{revision.validation.blockers.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul></>}
    {revision.validation.warnings.length > 0 && <><h4>Structural Warnings</h4><ul>{revision.validation.warnings.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul></>}
    {(revision.semanticWarnings ?? revision.semanticValidation?.warnings ?? []).length > 0 && <><h4>Pedagogical / Semantic Warnings</h4><ul>{(revision.semanticWarnings ?? revision.semanticValidation?.warnings ?? []).map((issue, index) => <li key={index}>{issue.message}</li>)}</ul></>}
    <div className="authoring-actions"><button className="secondary" type="button" onClick={onReject}>Reject changes</button><button type="button" onClick={onAccept}>Accept changes for review</button></div>
  </section>;
}

function SummaryList({ blueprint, section }: { blueprint: ScenarioBlueprint; section: SectionId }) {
  const list = blueprintSummary(blueprint, section);
  return <ul>{list.map((item, i) => <li key={`${i}-${item}`}>{item}</li>)}</ul>;
}

function blueprintSummary(blueprint: ScenarioBlueprint, section: SectionId): string[] {
  if (section === 'overview') return [`Title: ${blueprint.title}`, `Summary: ${blueprint.summary}`, `Briefing: ${blueprint.studentBriefing}`];
  if (section === 'learning-objectives') return blueprint.learningObjectives.map(x => x.description);
  if (section === 'roles') return blueprint.roles.map(x => `${x.displayName}: ${x.description}`);
  if (section === 'decisions') return blueprint.decisions.map(x => `${x.displayName}: ${x.description}`);
  if (section === 'rules') return blueprint.rules.map(x => `${x.name}: ${x.explanation}`);
  if (section === 'shocks') return blueprint.shockPool.map(x => `${x.title}: ${x.studentFacingDescription}`);
  if (section === 'assessment') return blueprint.assessmentRubric?.dimensions.map(x => `${humanize(x.code)}: ${x.description}`) ?? [];
  if (section === 'starting-world') return ['Model-supported starting conditions updated. Review the section and backend validation.'];
  return [];
}

function ValidationReport({ report, onNavigate }: { report: BlueprintValidationReport; onNavigate: (section: SectionId) => void }) {
  return <div className="validation-report" aria-live="polite">
    <h3>{report.isValid ? 'Backend validation passed' : 'Blocking issues need attention'}</h3>
    {report.blockers.length > 0 && <><h4>Blocking issues</h4><ul>{report.blockers.map((issue, index) => <li key={`${issue.code}-${index}`}><button type="button" className="issue-link" onClick={() => onNavigate(sectionForPath(issue.path))}>{issue.message}</button></li>)}</ul></>}
    {report.warnings.length > 0 && <><h4>Structural Warnings</h4><ul>{report.warnings.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul></>}
  </div>;
}

function sectionForPath(path: string): SectionId {
  const key = path.toLowerCase().split(/[./]/, 1)[0].replace(/\[\d+\]$/, '');
  if (key === 'learningobjectives') return 'learning-objectives';
  if (key === 'roles' || key === 'decisions' || key === 'rules' || key === 'shockpool' || key === 'assessmentrubric' || key === 'startingworld') {
    return ({ roles: 'roles', decisions: 'decisions', rules: 'rules', shockpool: 'shocks', assessmentrubric: 'assessment', startingworld: 'starting-world' } as Record<string, SectionId>)[key];
  }
  return 'overview';
}

function extractCodes(value: unknown, field: string): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const codes = (value as Record<string, unknown>)[field];
  return Array.isArray(codes) ? codes.filter((code): code is string => typeof code === 'string') : [];
}
