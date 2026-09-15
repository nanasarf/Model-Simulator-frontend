import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useRuntime } from '../../app/runtime';
import { keys } from '../../lib/api/query';
import { BackgroundStatus, EmptyState, ErrorState, LoadingState } from '../../components/states';
import type { SimulationModelDescriptor } from '../../types/platform';
export function ModelCatalog() {
  const { api } = useRuntime(); const models = useQuery({ queryKey: keys.models, queryFn: ({ signal }) => api.json<SimulationModelDescriptor[]>('/api/v1/models', { anonymous: true, signal }) });
  if (models.isPending) return <LoadingState label="Loading simulation models"/>;
  if (models.isError) return <ErrorState error={models.error} retry={() => void models.refetch()}/>;
  return <section><div className="section-heading"><h2>Simulation models</h2><BackgroundStatus active={models.isFetching}/></div>{models.data.length ? <div className="card-grid">{models.data.map(model => <article className="card model-card" key={`${model.identifier}:${model.version}`}><span className="model-icon" aria-hidden="true">↗</span><p className="eyebrow">Model · {model.version}</p><h3>{model.name}</h3><p className="muted">{model.identifier}</p></article>)}</div> : <EmptyState title="No models available"><p>The server returned no registered simulation models.</p></EmptyState>}</section>;
}
export function InstructorHome() { return <><header className="page-heading"><p className="eyebrow">Instructor workspace</p><h1>Bring ideas into practice.</h1><p>Manage classrooms, scenarios, and live simulation sessions from one teaching workspace.</p></header><div className="button-row"><Link className="button-link" to="/instructor/classrooms">Open classrooms</Link><Link className="button-link" to="/instructor/scenarios">Open scenario library</Link><Link className="button-link" to="/instructor/sessions">Open sessions</Link></div><ModelCatalog/></>; }
