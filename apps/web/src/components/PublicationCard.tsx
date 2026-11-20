import { FormEvent, useState } from 'react';
import { AFFILIATE_CHANNELS, PUBLICATION_STATUS_LABELS } from '@afflix/shared';
import type { PublicationStatus, PublicationView } from '@afflix/shared';
import { errorMessage } from '../api/client';
import { changePublicationStatus, downloadBriefing } from '../api/publications';
import { PublicationForm } from './PublicationForm';

const ACTION_LABEL: Partial<Record<PublicationStatus, Partial<Record<PublicationStatus, string>>>> = {
  DRAFT: { READY: 'Marcar como pronta', ARCHIVED: 'Descartar rascunho' },
  READY: { DRAFT: 'Voltar para rascunho' },
  PUBLISHED_MANUALLY: { ARCHIVED: 'Arquivar' },
};

// datetime-local no fuso do navegador (AAAA-MM-DDTHH:mm), para valor padrão e limite máximo.
const localNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const formatDate = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' });

type Step = { label: string; done: boolean; note?: string };

// Checklist do RF10: o que já foi feito e o que falta, do rascunho ao registro da publicação.
function checklist(p: PublicationView, exported: boolean): Step[] {
  const after = (s: PublicationStatus[]) => s.includes(p.status);
  const mediaOk = !p.media || p.media.licenseStatus === 'VALID';
  return [
    { label: 'Legenda', done: Boolean(p.caption?.trim()) },
    { label: 'CTA', done: Boolean(p.cta?.trim()) },
    { label: 'Link de afiliado', done: Boolean(p.affiliateLink) },
    { label: 'Vídeo com licença válida', done: mediaOk, note: p.media ? p.media.title : 'opcional, sem vídeo' },
    { label: 'Briefing exportado', done: exported || after(['PUBLISHED_MANUALLY']), note: exported ? 'nesta sessão' : undefined },
    { label: 'Pronta para publicar', done: after(['READY', 'PUBLISHED_MANUALLY']) },
    { label: 'Publicada no canal e registrada (URL, canal e data)', done: Boolean(p.externalUrl && p.publishedAt) },
  ];
}

export function PublicationCard({ publication: p, onChanged }: { publication: PublicationView; onChanged: (p: PublicationView) => void }) {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [exported,setExported] = useState(false);
  const [editing,setEditing] = useState(false);
  const [publishing,setPublishing] = useState(false);
  const [url,setUrl] = useState('');
  const [channel,setChannel] = useState('');
  const [when,setWhen] = useState(localNow);

  async function run(action: () => Promise<{ data: PublicationView }>) {
    setError(''); setBusy(true);
    try {
      onChanged((await action()).data);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function exportBriefing() {
    setError(''); setBusy(true);
    try {
      await downloadBriefing(p.id);
      setExported(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function publish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!url.trim() || !channel || !when) { setError('Informe URL, canal e data da publicação.'); return; }
    if (channel !== p.channel) { setError(`Esta publicação é do canal ${p.channel}. Para outro canal, volte para rascunho e troque o canal e o link.`); return; }
    const ok = await run(() => changePublicationStatus(p.id, {
      status:'PUBLISHED_MANUALLY', externalUrl:url.trim(), publishedAt:new Date(when).toISOString(),
    }));
    if (ok) setPublishing(false);
  }

  if (editing) {
    return <article className="card publication-card editing">
      <PublicationForm mode="edit" publication={p} onCancel={()=>setEditing(false)} onSaved={u=>{ setEditing(false); onChanged(u); }} />
    </article>;
  }

  const actions = p.allowedTransitions.filter(t => t !== 'PUBLISHED_MANUALLY');
  return <article className={`card publication-card status-${p.status.toLowerCase()}`}>
    <div className="info">
      <div className="publication-head">
        <span className={`status-badge ${p.status.toLowerCase()}`}>{PUBLICATION_STATUS_LABELS[p.status]}</span>
        <span className="channel">{p.channel}</span>
      </div>
      <h3>{p.product.name}</h3>
      {p.caption && <p className="caption">{p.caption}</p>}
      {p.affiliateLink && <p className="link">Link: <a href={p.affiliateLink.shortUrl} target="_blank" rel="noopener noreferrer">{p.affiliateLink.shortUrl}</a></p>}
      {p.externalUrl && <p>Publicada em {p.publishedAt ? formatDate(p.publishedAt) : '—'}: <a href={p.externalUrl} target="_blank" rel="noopener noreferrer">ver post</a></p>}

      <ul className="checklist" aria-label="Checklist da publicação">
        {checklist(p, exported).map(s=><li key={s.label} className={s.done ? 'done' : 'todo'}>
          <span aria-hidden="true">{s.done ? '✓' : '○'}</span> {s.label}{s.note && <small> · {s.note}</small>}
        </li>)}
      </ul>

      <div className="publication-actions">
        {p.status !== 'ARCHIVED' && <button type="button" onClick={()=>void exportBriefing()} disabled={busy}>Exportar briefing</button>}
        {p.status === 'DRAFT' && <button type="button" className="secondary-inline" onClick={()=>setEditing(true)} disabled={busy}>Editar</button>}
        {p.allowedTransitions.includes('PUBLISHED_MANUALLY') && !publishing &&
          <button type="button" onClick={()=>{ setError(''); setPublishing(true); }} disabled={busy}>Marcar como publicada</button>}
        {actions.map(t=><button key={t} type="button" className="secondary-inline" onClick={()=>void run(()=>changePublicationStatus(p.id, { status:t }))} disabled={busy}>
          {ACTION_LABEL[p.status]?.[t] ?? t}
        </button>)}
      </div>

      {publishing && <form className="publish-form" onSubmit={publish}>
        <label>URL do post
          <input type="url" required placeholder="https://..." value={url} onChange={e=>setUrl(e.target.value)} disabled={busy} />
        </label>
        <label>Canal em que publicou
          <select required value={channel} onChange={e=>setChannel(e.target.value)} disabled={busy}>
            <option value="" disabled>Confirme o canal</option>
            {AFFILIATE_CHANNELS.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>Data e hora da publicação
          <input type="datetime-local" required max={localNow()} value={when} onChange={e=>setWhen(e.target.value)} disabled={busy} />
        </label>
        <div className="form-actions">
          <button type="submit" disabled={busy}>{busy ? 'Registrando...' : 'Registrar publicação'}</button>
          <button type="button" className="secondary-inline" onClick={()=>setPublishing(false)} disabled={busy}>Cancelar</button>
        </div>
      </form>}

      {error && <p className="error" role="alert">{error}</p>}
    </div>
  </article>;
}
