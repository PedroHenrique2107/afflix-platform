import { useState } from 'react';
import { AFFILIATE_CHANNELS, CAMPAIGN_MAX_LENGTH } from '@afflix/shared';
import type { AffiliateChannel, AffiliateLinkView, CreateAffiliateLinkRequest, CreateAffiliateLinkResponse } from '@afflix/shared';
import { errorMessage } from '../api/client';
import { createAffiliateLink } from '../api/affiliateLinks';

// Rótulo de exibição; a lista de valores válidos vem do @afflix/shared.
const CHANNEL_LABEL: Record<AffiliateChannel,string> = {
  INSTAGRAM:'Instagram', TIKTOK:'TikTok', SHOPEE_VIDEO:'Shopee Vídeo', TELEGRAM:'Telegram',
};

async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

// resolveProductId: na busca importa a oferta se preciso; no catálogo devolve o id já salvo.
type Props = { resolveProductId: () => Promise<string> };

export function AffiliateLinkForm({ resolveProductId }: Props) {
  const [channel,setChannel] = useState<AffiliateChannel>('INSTAGRAM');
  const [campaign,setCampaign] = useState('');
  const [link,setLink] = useState<AffiliateLinkView|null>(null);
  const [linkMeta,setLinkMeta] = useState<CreateAffiliateLinkResponse['meta']|null>(null);
  const [status,setStatus] = useState<'idle'|'loading'|'copied'|'copy-failed'>('idle');
  const [error,setError] = useState('');

  async function generate() {
    setStatus('loading'); setError(''); setLink(null);
    try {
      const productId = await resolveProductId();
      const body: CreateAffiliateLinkRequest = { productId, channel, ...(campaign.trim() ? { campaign:campaign.trim() } : {}) };
      const result = await createAffiliateLink(body);
      setLink(result.data); setLinkMeta(result.meta);
      setStatus(await copy(result.data.shortUrl) ? 'copied' : 'copy-failed');
    } catch (err) {
      setError(errorMessage(err)); setStatus('idle');
    }
  }

  async function copyAgain() {
    if (link) setStatus(await copy(link.shortUrl) ? 'copied' : 'copy-failed');
  }

  return <>
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
  </>;
}
