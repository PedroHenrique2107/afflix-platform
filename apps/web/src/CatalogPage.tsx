import { useCallback, useEffect, useState } from 'react';
import type { CatalogProduct, ListProductsResponse } from '@afflix/shared';
import { errorMessage, getJson } from './api';
import { AffiliateLinkForm } from './AffiliateLinkForm';

const PAGE_SIZE = 12;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' });

function CatalogCard({ product }: { product: CatalogProduct }) {
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

type Props = { onGoToSearch: () => void };

// Catálogo persistido (GET /api/v1/products): mais recente primeiro, sem arquivados — ordem e filtro são da api.
export function CatalogPage({ onGoToSearch }: Props) {
  const [page,setPage] = useState(1);
  const [result,setResult] = useState<ListProductsResponse|null>(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);

  const load = useCallback(async (target: number) => {
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams({ page:String(target), limit:String(PAGE_SIZE) });
      setResult(await getJson<ListProductsResponse>(`/api/v1/products?${qs.toString()}`));
    } catch (err) {
      setError(errorMessage(err)); setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(page); }, [load, page]);

  const meta = result?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;

  // Página que ficou além do fim (ex.: catálogo encolheu entre cargas): volta para a última existente.
  useEffect(() => {
    if (meta && meta.total > 0 && result?.data.length === 0 && page > 1) setPage(totalPages);
  }, [meta, result, page, totalPages]);

  return <section className="results catalog">
    <h2>Catálogo {meta && <small>{meta.total} produto(s) salvo(s)</small>}</h2>

    {loading && !result && <p className="catalog-loading" role="status">Carregando catálogo...</p>}

    {error && <div className="catalog-state" role="alert">
      <p className="error">Não foi possível carregar o catálogo: {error}</p>
      <button type="button" onClick={()=>void load(page)} disabled={loading}>{loading?'Tentando...':'Tentar novamente'}</button>
    </div>}

    {!error && meta?.total === 0 && <div className="catalog-state">
      <p>Nenhum produto salvo ainda.</p>
      <p className="hint">Busque ofertas e use “Salvar no catálogo” para montar sua lista.</p>
      <button type="button" onClick={onGoToSearch}>Ir para a busca</button>
    </div>}

    {!error && result && result.data.length > 0 && <>
      <div className="cards" aria-busy={loading}>
        {result.data.map(p=><CatalogCard key={p.id} product={p} />)}
      </div>
      <nav className="pagination" aria-label="Paginação do catálogo">
        <button type="button" onClick={()=>setPage(p=>p-1)} disabled={loading || page <= 1}>← Anterior</button>
        <span>Página {meta!.page} de {totalPages}</span>
        <button type="button" onClick={()=>setPage(p=>p+1)} disabled={loading || !meta!.hasNextPage}>Próxima →</button>
      </nav>
    </>}
  </section>;
}
