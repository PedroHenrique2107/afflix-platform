import { useState } from 'react';
import { AFFILIATE_CHANNELS, CAMPAIGN_MAX_LENGTH } from '@afflix/shared';
import type { AffiliateChannel, AffiliateLinkView, CreateAffiliateLinkRequest, CreateAffiliateLinkResponse, ImportProductsResponse } from '@afflix/shared';

export type Offer = {
  marketplace:'SHOPEE'; itemId:string; shopId:string; name:string; productUrl:string;
  offerUrl?:string; imageUrl?:string; price?:string; priceMax?:string; commissionRate?:string;
  estimatedCommission?:string; rating?:string; sales?:number;
  commissionPercent:string; saved:boolean; productId:string|null;
};

// Rótulo de exibição; a lista de valores válidos vem do @afflix/shared.
const CHANNEL_LABEL: Record<AffiliateChannel,string> = {
  INSTAGRAM:'Instagram', TIKTOK:'TikTok', SHOPEE_VIDEO:'Shopee Vídeo', TELEGRAM:'Telegram',
};

// O import recusa campos desconhecidos: envia só os campos da oferta, sem os calculados pela busca.
function toImportOffer(o: Offer) {
  const { commissionPercent: _c, saved: _s, productId: _p, ...offer } = o;
  return offer;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  const json = await response.json().catch(() => null) as { message?: string|string[] } | null;
  if (!response.ok) {
    const message = Array.isArray(json?.message) ? json.message.join('; ') : json?.message;
    throw new Error(message || `Falha HTTP ${response.status}`);
  }
  return json as T;
}

// Upsert no catálogo: reimportar a mesma oferta atualiza o produto existente, nunca duplica.
async function importOffer(offer: Offer): Promise<string> {
  const imported = await postJson<ImportProductsResponse>('/api/v1/products/import', { offers:[toImportOffer(offer)] });
  return imported.data.items[0].id;
}

async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

type Props = { offer:Offer; source:string; onSaved:(productId:string)=>void };

export function ProductCard({ offer, source, onSaved }: Props) {
  const [channel,setChannel] = useState<AffiliateChannel>('INSTAGRAM');
  const [campaign,setCampaign] = useState('');
  const [link,setLink] = useState<AffiliateLinkView|null>(null);
  const [linkMeta,setLinkMeta] = useState<CreateAffiliateLinkResponse['meta']|null>(null);
  const [status,setStatus] = useState<'idle'|'loading'|'copied'|'copy-failed'>('idle');
  const [error,setError] = useState('');
  const [saveStatus,setSaveStatus] = useState<'idle'|'saving'|'saved'>('idle');
  const [saveError,setSaveError] = useState('');

  async function save() {
    setSaveStatus('saving'); setSaveError('');
    try {
      onSaved(await importOffer(offer));
      setSaveStatus('saved');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Falha desconhecida'); setSaveStatus('idle');
    }
  }

  async function generate() {
    setStatus('loading'); setError(''); setLink(null);
    try {
      let productId = offer.productId;
      if (!productId) {
        productId = await importOffer(offer);
        onSaved(productId);
      }
      const body: CreateAffiliateLinkRequest = { productId, channel, ...(campaign.trim() ? { campaign:campaign.trim() } : {}) };
      const result = await postJson<CreateAffiliateLinkResponse>('/api/v1/affiliate-links', body);
      setLink(result.data); setLinkMeta(result.meta);
      setStatus(await copy(result.data.shortUrl) ? 'copied' : 'copy-failed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha desconhecida'); setStatus('idle');
    }
  }

  async function copyAgain() {
    if (link) setStatus(await copy(link.shortUrl) ? 'copied' : 'copy-failed');
  }

  return <article className={offer.saved ? 'card saved' : 'card'}>
    <div className="thumb">▦{offer.saved && <span className="saved-badge">✓ No catálogo</span>}</div>
    <div className="info">
      <h3>{offer.name}</h3>
      <p>Preço: {offer.price?`R$ ${offer.price}`:'não informado'}</p>
      <p>Comissão: <strong>{offer.commissionPercent}%</strong></p>
      <p>Avaliação: {offer.rating??'não informada'}</p>
      {source !== 'mock' && <a href={offer.productUrl} target="_blank" rel="noopener noreferrer">Ver produto</a>}

      <div className="save-action">
        {/* Já no catálogo: a ação some para não reimportar (cada import grava um PriceSnapshot). */}
        {offer.saved
          ? <button type="button" className="secondary" disabled>✓ Salvo no catálogo</button>
          : <button type="button" className="secondary" onClick={()=>void save()} disabled={saveStatus==='saving'}>
              {saveStatus==='saving'?'Salvando...':'Salvar no catálogo'}
            </button>}
        {saveStatus==='saved' && <p className="save-status" role="status">Produto salvo no catálogo.</p>}
        {saveError && <p className="error" role="alert">Não foi possível salvar: {saveError}</p>}
      </div>

      <div className="link-form">
        <label>Canal
          <select value={channel} onChange={e=>setChannel(e.target.value as AffiliateChannel)}>
            {AFFILIATE_CHANNELS.map(c=><option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
          </select>
        </label>
        <label>Campanha (opcional)
          <input value={campaign} maxLength={CAMPAIGN_MAX_LENGTH} placeholder="ex.: Natal 2026" onChange={e=>setCampaign(e.target.value)} />
        </label>
        <button type="button" onClick={()=>void generate()} disabled={status==='loading'}>
          {status==='loading'?'Gerando...':'Gerar link'}
        </button>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {link && <div className="link-result">
        {linkMeta?.source==='mock' && <p className="link-warning">Link fictício (modo mock): não gera comissão.</p>}
        <div className="link-row">
          <input readOnly value={link.shortUrl} aria-label="Link de afiliado" onFocus={e=>e.target.select()} />
          <button type="button" onClick={()=>void copyAgain()}>Copiar</button>
        </div>
        <p className="link-status" role="status">
          {status==='copied'?'Copiado!':status==='copy-failed'?'Não foi possível copiar automaticamente; selecione o link e copie.':''}
          {linkMeta?.reused?' Link já existente reaproveitado.':''}
        </p>
        <p className="link-subids">subIds: {link.subIds.join(', ')||'nenhum'}</p>
      </div>}
    </div>
  </article>;
}
