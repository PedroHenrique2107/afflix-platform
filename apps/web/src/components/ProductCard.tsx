import { useState } from 'react';
import { errorMessage } from '../api/client';
import { importOffer } from '../api/products';
import type { Offer } from '../api/products';
import { AffiliateLinkForm } from './AffiliateLinkForm';

type Props = { offer:Offer; source:string; onSaved:(productId:string)=>void };

export function ProductCard({ offer, source, onSaved }: Props) {
  const [saveStatus,setSaveStatus] = useState<'idle'|'saving'|'saved'>('idle');
  const [saveError,setSaveError] = useState('');

  async function save() {
    setSaveStatus('saving'); setSaveError('');
    try {
      onSaved(await importOffer(offer));
      setSaveStatus('saved');
    } catch (err) {
      setSaveError(errorMessage(err)); setSaveStatus('idle');
    }
  }

  // Gerar link de oferta ainda não salva importa antes; já salva reaproveita o id (sem novo snapshot).
  async function resolveProductId() {
    if (offer.productId) return offer.productId;
    const productId = await importOffer(offer);
    onSaved(productId);
    return productId;
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

      <AffiliateLinkForm resolveProductId={resolveProductId} />
    </div>
  </article>;
}
