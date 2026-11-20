import { FormEvent, useEffect, useState } from 'react';
import {
  METRIC_KIND_LABELS, METRIC_KINDS, METRIC_MONEY_KINDS, METRIC_SOURCE_LABELS,
  METRIC_SOURCE_REFERENCE_MAX_LENGTH, METRIC_SOURCE_REFERENCE_MIN_LENGTH, METRIC_SOURCES,
} from '@afflix/shared';
import type { MetricKind, MetricSource, PublicationView } from '@afflix/shared';
import { errorMessage } from '../api/client';
import { recordPublicationMetric } from '../api/metrics';
import { listPublications } from '../api/publications';

// datetime-local no fuso do navegador (AAAA-MM-DDTHH:mm), para valor padrão e limite máximo.
const localNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const formatDate = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' });

const REFERENCE_HINT: Record<MetricSource, string> = {
  MANUAL: 'Ex.: Insights do Instagram, contagem do operador',
  OFFICIAL_REPORT: 'Ex.: Painel Shopee Afiliados — relatório de conversões 11/2026',
};

// Registro de métrica (RF11): valor acumulado visto na fonte, com a fonte, a referência e quando foi visto.
export function MetricForm({ onSaved }: { onSaved: () => void }) {
  const [publications,setPublications] = useState<PublicationView[]|null>(null);
  const [loadError,setLoadError] = useState('');
  const [publicationId,setPublicationId] = useState('');
  const [kind,setKind] = useState<MetricKind>('CLICKS');
  const [value,setValue] = useState('');
  const [source,setSource] = useState<MetricSource>('MANUAL');
  const [reference,setReference] = useState('');
  const [observedAt,setObservedAt] = useState(localNow);
  const [sending,setSending] = useState(false);
  const [error,setError] = useState('');
  const [status,setStatus] = useState('');

  useEffect(() => {
    // Só publicadas recebem métrica; 50 é o limite da api e cobre o volume do MVP.
    listPublications(1, 50, 'PUBLISHED_MANUALLY')
      .then(r => setPublications(r.data))
      .catch(err => setLoadError(errorMessage(err)));
  }, []);

  const money = METRIC_MONEY_KINDS.includes(kind);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setStatus('');
    if (!publicationId) { setError('Escolha a publicação.'); return; }
    if (reference.trim().length < METRIC_SOURCE_REFERENCE_MIN_LENGTH) { setError('Informe de onde o número saiu (referência da fonte).'); return; }
    setSending(true);
    try {
      const { data } = await recordPublicationMetric(publicationId, {
        kind, value: value.trim().replace(',', '.'), source, sourceReference: reference.trim(),
        observedAt: new Date(observedAt).toISOString(),
      });
      setStatus(`${METRIC_KIND_LABELS[data.kind]} registrado: ${data.value} (${METRIC_SOURCE_LABELS[data.source]}, observado em ${formatDate(data.observedAt)}).`);
      setValue('');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  if (loadError) return <p className="error" role="alert">Não foi possível carregar as publicações: {loadError}</p>;
  if (publications && publications.length === 0) {
    return <div className="catalog-state"><p>Nenhuma publicação publicada ainda.</p>
      <p className="hint">Métrica só é registrada depois que a publicação é marcada como publicada, na tela Publicações.</p></div>;
  }

  return <form className="media-form metric-form" onSubmit={submit}>
    <h3>Registrar métrica</h3>
    <label className="wide">Publicação
      <select required value={publicationId} onChange={e=>setPublicationId(e.target.value)} disabled={sending || !publications}>
        <option value="" disabled>{publications ? 'Selecione' : 'Carregando...'}</option>
        {publications?.map(p=><option key={p.id} value={p.id}>
          {p.product.name} · {p.channel}{p.publishedAt ? ` · publicada em ${formatDate(p.publishedAt)}` : ''}
        </option>)}
      </select>
    </label>
    <label>Métrica
      <select value={kind} onChange={e=>setKind(e.target.value as MetricKind)} disabled={sending}>
        {METRIC_KINDS.map(k=><option key={k} value={k}>{METRIC_KIND_LABELS[k]}</option>)}
      </select>
    </label>
    <label>Valor acumulado <small>({money ? 'R$, até 2 casas' : 'número inteiro'})</small>
      <input required inputMode={money ? 'decimal' : 'numeric'} pattern={money ? '\\d+([.,]\\d{1,2})?' : '\\d+'}
        value={value} onChange={e=>setValue(e.target.value)} placeholder={money ? '12,50' : '120'} disabled={sending} />
    </label>
    <fieldset className="wide source-choice" disabled={sending}>
      <legend>Fonte do número</legend>
      {METRIC_SOURCES.map(s=><label key={s}>
        <input type="radio" name="source" value={s} checked={source === s} onChange={()=>setSource(s)} /> {METRIC_SOURCE_LABELS[s]}
      </label>)}
    </fieldset>
    <label className="wide">Referência da fonte <small>(de onde o número saiu)</small>
      <input required minLength={METRIC_SOURCE_REFERENCE_MIN_LENGTH} maxLength={METRIC_SOURCE_REFERENCE_MAX_LENGTH}
        value={reference} onChange={e=>setReference(e.target.value)} placeholder={REFERENCE_HINT[source]} disabled={sending} />
    </label>
    <label>Observado em <small>(quando o número foi visto na fonte)</small>
      <input type="datetime-local" required max={localNow()} value={observedAt} onChange={e=>setObservedAt(e.target.value)} disabled={sending} />
    </label>
    <div className="form-actions wide">
      <button type="submit" disabled={sending}>{sending ? 'Registrando...' : 'Registrar métrica'}</button>
      {status && <span className="link-status" role="status">{status}</span>}
    </div>
    {error && <p className="error wide" role="alert">{error}</p>}
    <p className="hint wide">Registre o total acumulado que a fonte mostra agora. O relatório usa o registro mais recente de cada publicação e nunca soma registro manual com relatório oficial.</p>
  </form>;
}
