import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ListProductsResponse } from '@afflix/shared';
import { errorMessage } from '../api/client';
import { listProducts } from '../api/products';
import { CatalogCard } from '../components/CatalogCard';

const PAGE_SIZE = 12;

// Catálogo persistido: mais recente primeiro, sem arquivados — ordem e filtro são da api (listProducts).
export function CatalogPage() {
  const navigate = useNavigate();
  const [page,setPage] = useState(1);
  const [result,setResult] = useState<ListProductsResponse|null>(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);

  const load = useCallback(async (target: number) => {
    setLoading(true); setError('');
    try {
      setResult(await listProducts(target, PAGE_SIZE));
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
      <button type="button" onClick={()=>navigate('/busca')}>Ir para a busca</button>
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
