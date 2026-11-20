import { useState } from 'react';
import { METRIC_KIND_LABELS, METRIC_MONEY_KINDS, METRIC_SOURCE_LABELS } from '@afflix/shared';
import type { MetricKind, MetricsReportCell, MetricsReportGroup, PublicationMetricView } from '@afflix/shared';
import { errorMessage } from '../api/client';
import { listPublicationMetrics } from '../api/metrics';

const formatDate = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' });
const brl = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' });
const count = new Intl.NumberFormat('pt-BR');

// Decimal chega como string; Number aqui é só para exibição, nenhum cálculo é feito no front.
export const formatMetric = (kind: MetricKind, value: string) =>
  METRIC_MONEY_KINDS.includes(kind) ? brl.format(Number(value)) : count.format(Number(value));

const observed = (c: MetricsReportCell) => c.oldestObservedAt === c.observedAt
  ? formatDate(c.observedAt)
  : `${formatDate(c.oldestObservedAt)} a ${formatDate(c.observedAt)}`;

// Cada linha é um número com a fonte, a data de observação e a origem ao lado: nunca um número solto.
function CellsTable({ cells, byProduct }: { cells: MetricsReportCell[]; byProduct: boolean }) {
  return <table className="metrics-table">
    <thead><tr>
      <th>Métrica</th><th>Valor</th><th>Fonte</th><th>Observado em</th><th>Origem</th>{byProduct && <th>Publicações</th>}
    </tr></thead>
    <tbody>{cells.map(c=><tr key={`${c.kind}-${c.source}`}>
      <td>{METRIC_KIND_LABELS[c.kind]}</td>
      <td className="metric-value">{formatMetric(c.kind, c.value)}</td>
      <td><span className={`source-badge ${c.source.toLowerCase()}`}>{METRIC_SOURCE_LABELS[c.source]}</span></td>
      <td>{observed(c)}</td>
      <td className="metric-origin">{c.sourceReferences.join('; ')}</td>
      {byProduct && <td>{c.publicationCount}</td>}
    </tr>)}</tbody>
  </table>;
}

function History({ publicationId }: { publicationId: string }) {
  const [rows,setRows] = useState<PublicationMetricView[]|null>(null);
  const [open,setOpen] = useState(false);
  const [error,setError] = useState('');

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setError('');
    try { setRows((await listPublicationMetrics(publicationId)).data); } catch (err) { setError(errorMessage(err)); }
  }

  return <div className="metric-history">
    <button type="button" className="secondary-inline" onClick={()=>void toggle()} aria-expanded={open}>
      {open ? 'Ocultar histórico' : 'Ver histórico de registros'}
    </button>
    {open && error && <p className="error" role="alert">{error}</p>}
    {open && rows && <ul>
      {rows.map(r=><li key={r.id}>
        <strong>{METRIC_KIND_LABELS[r.kind]}: {formatMetric(r.kind, r.value)}</strong>{' '}
        <span className={`source-badge ${r.source.toLowerCase()}`}>{METRIC_SOURCE_LABELS[r.source]}</span>{' '}
        observado em {formatDate(r.observedAt)} · {r.sourceReference} <small>(registrado em {formatDate(r.createdAt)})</small>
      </li>)}
    </ul>}
  </div>;
}

export function MetricsGroupCard({ group, byProduct }: { group: MetricsReportGroup; byProduct: boolean }) {
  const p = group.publication;
  return <article className="card metrics-card">
    <div className="info">
      <div className="publication-head">
        <h3>{group.product.name}</h3>
        {p && <span className="channel">{p.channel}</span>}
      </div>
      {p && <p className="publication-meta">
        {p.publishedAt && <>Publicada em {formatDate(p.publishedAt)}</>}
        {p.externalUrl && <> · <a href={p.externalUrl} target="_blank" rel="noreferrer">ver post</a></>}
      </p>}
      {byProduct && <p className="publication-meta">Soma do registro mais recente de cada publicação do produto, separada por fonte.</p>}
      <CellsTable cells={group.metrics} byProduct={byProduct} />
      {p && <History publicationId={p.id} />}
    </div>
  </article>;
}
