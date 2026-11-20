import { FormEvent, useEffect, useState } from 'react';
import {
  AFFILIATE_CHANNELS, DEFAULT_CTA_BY_CHANNEL, PUBLICATION_CAPTION_MAX_LENGTH, PUBLICATION_CTA_MAX_LENGTH,
} from '@afflix/shared';
import type { AffiliateChannel, AffiliateLinkView, CatalogProduct, MediaAssetView, PublicationView } from '@afflix/shared';
import { errorMessage } from '../api/client';
import { createAffiliateLink, listAffiliateLinks } from '../api/affiliateLinks';
import { listMedia } from '../api/media';
import { listProducts } from '../api/products';
import { createPublication, updatePublication } from '../api/publications';

type Props =
  | { mode:'create'; onSaved:(p: PublicationView) => void; onCancel?:never; publication?:never }
  | { mode:'edit'; publication: PublicationView; onSaved:(p: PublicationView) => void; onCancel:() => void };

// Rascunho de publicação: produto, canal, link de afiliado do mesmo produto+canal, mídia licenciada (opcional), legenda e CTA.
export function PublicationForm(props: Props) {
  const editing = props.mode === 'edit' ? props.publication : null;
  const [products,setProducts] = useState<CatalogProduct[]>([]);
  const [media,setMedia] = useState<MediaAssetView[]>([]);
  const [links,setLinks] = useState<AffiliateLinkView[]>([]);
  const [productId,setProductId] = useState(editing?.product.id ?? '');
  const [channel,setChannel] = useState<AffiliateChannel>(editing?.channel ?? 'INSTAGRAM');
  const [linkId,setLinkId] = useState(editing?.affiliateLink?.id ?? '');
  const [mediaId,setMediaId] = useState(editing?.media?.id ?? '');
  const [caption,setCaption] = useState(editing?.caption ?? '');
  const [cta,setCta] = useState(editing?.cta ?? DEFAULT_CTA_BY_CHANNEL.INSTAGRAM);
  const [ctaTouched,setCtaTouched] = useState(Boolean(editing));
  const [busy,setBusy] = useState(false);
  const [generating,setGenerating] = useState(false);
  const [error,setError] = useState('');

  // Catálogo e biblioteca para os seletores. Só mídia com licença válida pode ser escolhida.
  useEffect(() => {
    let alive = true;
    Promise.all([listProducts(1, 50), listMedia(1, 50)])
      .then(([p, m]) => { if (alive) { setProducts(p.data); setMedia(m.data.filter(a => a.publishable)); } })
      .catch(err => { if (alive) setError(`Não foi possível carregar catálogo e mídia: ${errorMessage(err)}`); });
    return () => { alive = false; };
  }, []);

  // Links do produto no canal escolhido. Mantém o selecionado se ele continuar válido.
  useEffect(() => {
    if (!productId) { setLinks([]); setLinkId(''); return; }
    let alive = true;
    listAffiliateLinks(productId, channel)
      .then(r => {
        if (!alive) return;
        setLinks(r.data);
        setLinkId(current => r.data.some(l => l.id === current) ? current : r.data[0]?.id ?? '');
      })
      .catch(err => { if (alive) setError(errorMessage(err)); });
    return () => { alive = false; };
  }, [productId, channel]);

  function changeChannel(next: AffiliateChannel) {
    setChannel(next);
    if (!ctaTouched) setCta(DEFAULT_CTA_BY_CHANNEL[next]);
  }

  async function generateLink() {
    setError(''); setGenerating(true);
    try {
      const { data } = await createAffiliateLink({ productId, channel });
      setLinks(current => current.some(l => l.id === data.id) ? current : [data, ...current]);
      setLinkId(data.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (!productId) { setError('Escolha o produto.'); return; }
    setBusy(true);
    try {
      const { data } = editing
        ? await updatePublication(editing.id, {
          channel, caption, cta, affiliateLinkId: linkId || null, mediaAssetId: mediaId || null,
        })
        : await createPublication({
          productId, channel,
          ...(caption.trim() && { caption }), ...(cta.trim() && { cta }),
          ...(linkId && { affiliateLinkId: linkId }), ...(mediaId && { mediaAssetId: mediaId }),
        });
      if (!editing) { setCaption(''); setMediaId(''); setCtaTouched(false); setCta(DEFAULT_CTA_BY_CHANNEL[channel]); }
      props.onSaved(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || generating;
  return <form className="media-form publication-form" onSubmit={submit}>
    <h3>{editing ? 'Editar rascunho' : 'Novo rascunho de publicação'}</h3>
    <label className="wide">Produto do catálogo
      <select value={productId} onChange={e=>setProductId(e.target.value)} required disabled={disabled || Boolean(editing)}>
        <option value="" disabled>Selecione</option>
        {editing && !products.some(p => p.id === editing.product.id) && <option value={editing.product.id}>{editing.product.name}</option>}
        {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
    <label>Canal
      <select value={channel} onChange={e=>changeChannel(e.target.value as AffiliateChannel)} disabled={disabled}>
        {AFFILIATE_CHANNELS.map(c=><option key={c} value={c}>{c}</option>)}
      </select>
    </label>
    <label>Link de afiliado <small>(do produto, neste canal)</small>
      <select value={linkId} onChange={e=>setLinkId(e.target.value)} disabled={disabled || !productId}>
        <option value="">{links.length ? 'Sem link por enquanto' : 'Nenhum link gerado'}</option>
        {links.map(l=><option key={l.id} value={l.id}>{l.shortUrl}{l.campaign ? ` · ${l.campaign}` : ''}</option>)}
      </select>
    </label>
    {productId && links.length === 0 && <div className="wide">
      <button type="button" className="secondary-inline" onClick={()=>void generateLink()} disabled={disabled}>
        {generating ? 'Gerando...' : `Gerar link para ${channel}`}
      </button>
    </div>}
    <label className="wide">Vídeo da biblioteca <small>(opcional; só aparecem vídeos com licença válida)</small>
      <select value={mediaId} onChange={e=>setMediaId(e.target.value)} disabled={disabled}>
        <option value="">Sem vídeo</option>
        {editing?.media && !media.some(m => m.id === editing.media!.id) && <option value={editing.media.id}>{editing.media.title} ({editing.media.licenseStatus})</option>}
        {media.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}
      </select>
    </label>
    <label className="wide">Legenda
      <textarea rows={4} maxLength={PUBLICATION_CAPTION_MAX_LENGTH} value={caption} onChange={e=>setCaption(e.target.value)} disabled={disabled} />
    </label>
    <label className="wide">CTA
      <input maxLength={PUBLICATION_CTA_MAX_LENGTH} value={cta} onChange={e=>{ setCta(e.target.value); setCtaTouched(true); }} disabled={disabled} />
    </label>
    <div className="wide form-actions">
      <button type="submit" disabled={disabled}>{busy ? 'Salvando...' : editing ? 'Salvar rascunho' : 'Criar rascunho'}</button>
      {editing && <button type="button" className="secondary-inline" onClick={props.onCancel} disabled={disabled}>Cancelar</button>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  </form>;
}
