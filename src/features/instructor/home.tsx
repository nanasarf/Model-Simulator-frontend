import { useQuery } from '@tanstack/react-query';
import { useAuth, useRuntime } from '../../app/runtime';
import { keys } from '../../lib/api/query';
import { macroAuthoring, marketAuthoring } from '../scenarios/service';
import { OpenSession } from '../sessions/open-session';
import { BackgroundStatus, EmptyState, ErrorState, LoadingState } from '../../components/states';
import type { SimulationModelDescriptor } from '../../types/platform';
export function ModelCatalog() {
  const { api } = useRuntime(); const models = useQuery({ queryKey: keys.models, queryFn: ({ signal }) => api.json<SimulationModelDescriptor[]>('/api/v1/models', { anonymous: true, signal }) });
  if (models.isPending) return <LoadingState label="Loading simulation models"/>;
  if (models.isError) return <ErrorState error={models.error} retry={() => void models.refetch()}/>;
  return <section><div className="section-heading"><h2>Simulation models</h2><BackgroundStatus active={models.isFetching}/></div>{models.data.length ? <div className="card-grid">{models.data.map(model => <article className="card model-card" key={`${model.identifier}:${model.version}`}><span className="model-icon" aria-hidden="true">↗</span><p className="eyebrow">Model · {model.version}</p><h3>{model.name}</h3><p className="muted">{model.identifier}</p></article>)}</div> : <EmptyState title="No models available"><p>The server returned no registered simulation models.</p></EmptyState>}</section>;
}
export function InstructorHome() { return <><header className="page-heading"><p className="eyebrow">Instructor workspace</p><h1>Bring ideas into practice.</h1><p>Open your classroom session or explore the available simulation models.</p></header><OpenSession/><ModelCatalog/><section className="notice"><h2>Your classroom resources</h2><p>Session and owned-scenario browsing is not available yet. Open existing sessions by ID; scenario templates are available under Scenarios.</p></section></>; }
export function ScenariosPage() {
  const { api } = useRuntime(); const { user } = useAuth();
  const macro = useQuery({ queryKey: ['user', user!.id, 'templates', 'macro'], queryFn: ({ signal }) => macroAuthoring(api).templates(signal) });
  const market = useQuery({ queryKey: ['user', user!.id, 'templates', 'market'], queryFn: ({ signal }) => marketAuthoring(api).templates(signal) });
  return <><header className="page-heading"><p className="eyebrow">Instructor workspace</p><h1>Scenario templates</h1><p>Available starting points from the server. Authoring will arrive in a later milestone.</p></header>
    {[{ name: 'Short-Run Macroeconomics', query: macro }, { name: 'Competitive Market', query: market }].map(({ name, query }) => <section key={name}><div className="section-heading"><h2>{name}</h2><BackgroundStatus active={query.isFetching}/></div>{query.isPending ? <LoadingState label="Loading templates"/> : query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()}/> : query.data.length ? <div className="card-grid">{query.data.map(template => <article className="card" key={template.code}><p className="eyebrow">{template.code}</p><h3>{template.name}</h3><p>{template.content.briefing}</p></article>)}</div> : <EmptyState title="No templates"><p>No templates were returned for this model.</p></EmptyState>}</section>)}
    <p className="notice">Owned-scenario lists are not available from the current server.</p></>;
}
