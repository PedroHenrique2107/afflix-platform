import type { CatalogProduct } from '@afflix/shared';
import { AffiliateLinkForm } from './AffiliateLinkForm';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' });

export function CatalogCard({ product }: { product: CatalogProduct }) {
  return <article className="card">
    <div className="thumb">▦</div>
    <div className="info">
      <h3>{product.name}</h3>
      <p>Preço: {product.price?`R$ ${product.price}`:'não informado'}</p>
      <p>Comissão: {product.commissionPercent?<strong>{product.commissionPercent}%</strong>:'não informada'}</p>
      <p>Avaliação: {product.rating??'não informada'}</p>
      <p className="synced-at">Sincronizado em {formatDate(product.lastSyncedAt)}</p>
      <a href={product.productUrl} target="_blank" rel="noopener noreferrer">Ver produto</a>
      <AffiliateLinkForm resolveProductId={async () => product.id} />
    </div>
  </article>;
}
