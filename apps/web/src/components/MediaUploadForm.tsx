import { FormEvent, useRef, useState } from 'react';
import { MEDIA_LICENSE_LABELS, MEDIA_LICENSE_TYPES, MEDIA_MAX_BYTES } from '@afflix/shared';
import type { MediaAssetView, MediaLicenseType } from '@afflix/shared';
import { errorMessage } from '../api/client';
import { uploadMedia } from '../api/media';

const MAX_MB = Math.round(MEDIA_MAX_BYTES / (1024 * 1024));

// Cadastro de vídeo. Tipo de licença é obrigatório; sem prova de licença o vídeo entra, mas fica não publicável.
export function MediaUploadForm({ onCreated }: { onCreated: (asset: MediaAssetView) => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [licenseType,setLicenseType] = useState<MediaLicenseType|''>('');
  const [sending,setSending] = useState(false);
  const [error,setError] = useState('');
  const [status,setStatus] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(''); setStatus('');
    const form = new FormData(e.currentTarget);
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) { setError('Escolha um arquivo de vídeo.'); return; }
    if (file.size > MEDIA_MAX_BYTES) { setError(`O arquivo passa do limite de ${MAX_MB} MB.`); return; }
    if (!licenseType) { setError('Informe o tipo de licença.'); return; }
    setSending(true);
    try {
      const { data } = await uploadMedia(form);
      setStatus(data.publishable
        ? 'Vídeo cadastrado e liberado para publicação.'
        : 'Vídeo cadastrado, mas sem prova de licença válida: ainda não pode ser publicado.');
      formRef.current?.reset(); setLicenseType('');
      onCreated(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return <form ref={formRef} className="media-form" onSubmit={submit}>
    <h3>Cadastrar vídeo</h3>
    <label className="wide">Arquivo de vídeo (até {MAX_MB} MB)
      <input name="file" type="file" accept="video/*" required disabled={sending} />
    </label>
    <label className="wide">Título
      <input name="title" required maxLength={200} disabled={sending} />
    </label>
    <label>Tipo de licença
      <select name="licenseType" required value={licenseType} onChange={e=>setLicenseType(e.target.value as MediaLicenseType)} disabled={sending}>
        <option value="" disabled>Selecione</option>
        {MEDIA_LICENSE_TYPES.map(t=><option key={t} value={t}>{MEDIA_LICENSE_LABELS[t]}</option>)}
      </select>
    </label>
    <label>Licença válida até <small>(vazio = sem vencimento)</small>
      <input name="licenseExpiresAt" type="date" disabled={sending} />
    </label>
    <label className="wide">Origem (URL)
      <input name="sourceUrl" type="url" placeholder="https://..." disabled={sending} />
    </label>
    <label className="wide">Prova de licença <small>(contrato, termo de consentimento, nota da compra...)</small>
      <textarea name="rightsEvidence" rows={2} maxLength={2000} disabled={sending} />
    </label>
    <div className="wide">
      <button type="submit" disabled={sending}>{sending?'Enviando...':'Cadastrar vídeo'}</button>
      {error && <p className="error" role="alert">{error}</p>}
      {status && <p className="save-status" role="status">{status}</p>}
    </div>
  </form>;
}
