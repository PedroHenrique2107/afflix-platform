import { useCallback, useEffect, useState } from 'react';
import { PUBLICATION_STATUSES, PUBLICATION_STATUS_LABELS } from '@afflix/shared';
import type { ListPublicationsResponse, PublicationStatus, PublicationView } from '@afflix/shared';
import { errorMessage } from '../api/client';
import { listPublications } from '../api/publications';
import { PublicationCard } from '../components/PublicationCard';
import { PublicationForm } from '../components/PublicationForm';

const PAGE_SIZE = 12;

// Publicação manual (RF10): rascunho → briefing → pronta → publicada à mão no canal → registro de URL, canal e data.
export function PublicationsPage() {
  const [page,setPage] = useState(1);
  const [status,setStatus] = useState<PublicationStatus|undefined>();
  const [result,setResult] = useState<ListPublicationsResponse|null>(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);

  const load = useCallback(async (target: number, filter?: PublicationStatus) => {
    setLoading(true); setError('');
    try {
      setResult(await listPublications(target, PAGE_SIZE, filter));
    } catch (err) {
      setError(errorMessage(err)); setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(page, status); }, [load, page, status]);

  const reloadFirst = () => { if (page === 1) void load(1, status); else setPage(1); };
  const filter = (next?: PublicationStatus) => { setStatus(next); setPage(1); };
  // Atualiza o card na hora; se saiu do filtro atual, recarrega a lista.
  const onChanged = (updated: PublicationView) => {
    if (status && updated.status !== status) { void load(page, status); return; }
    setResult(r => r && { ...r, data: r.data.map(p => p.id === updated.id ? updated : p) });
  };

  const meta = result?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;

  return <section className="results catalog media publications">
    <h2>Publicações {meta && <small>{meta.total} publicação(ões)</small>}</h2>
    <p className="hint">A publicação é sempre manual: exporte o briefing, publique no canal e registre aqui a URL, o canal e a data.</p>

    <PublicationForm mode="create" onSaved={reloadFirst} />

    <nav className="tabs status-filter" aria-label="Filtrar por status">
      <button type="button" className={status ? 'tab' : 'tab active'} onClick={()=>filter(undefined)}>Todas</button>
      {PUBLICATION_STATUSES.map(s=><button key={s} type="button" className={status === s ? 'tab active' : 'tab'} onClick={()=>filter(s)}>
        {PUBLICATION_STATUS_LABELS[s]}
      </button>)}
    </nav>

    {loading && !result && <p className="catalog-loading" role="status">Carregando publicações...</p>}

    {error && <div className="catalog-state" role="alert">
      <p className="error">Não foi possível carregar as publicações: {error}</p>
      <button type="button" onClick={()=>void load(page, status)} disabled={loading}>{loading?'Tentando...':'Tentar novamente'}</button>
    </div>}

    {!error && meta?.total === 0 && <div className="catalog-state">
      <p>{status ? `Nenhuma publicação com status "${PUBLICATION_STATUS_LABELS[status]}".` : 'Nenhuma publicação ainda.'}</p>
      {!status && <p className="hint">Crie o primeiro rascunho no formulário acima, a partir de um produto do catálogo.</p>}
    </div>}

    {!error && result && result.data.length > 0 && <>
      <div className="cards publication-cards" aria-busy={loading}>
        {result.data.map(p=><PublicationCard key={p.id} publication={p} onChanged={onChanged} />)}
      </div>
      <nav className="pagination" aria-label="Paginação das publicações">
        <button type="button" onClick={()=>setPage(p=>p-1)} disabled={loading || page <= 1}>← Anterior</button>
        <span>Página {meta!.page} de {totalPages}</span>
        <button type="button" onClick={()=>setPage(p=>p+1)} disabled={loading || !meta!.hasNextPage}>Próxima →</button>
      </nav>
    </>}
  </section>;
}
