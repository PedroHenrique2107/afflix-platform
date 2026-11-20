import { useCallback, useEffect, useState } from 'react';
import type { ListMediaAssetsResponse } from '@afflix/shared';
import { errorMessage } from '../api/client';
import { listMedia } from '../api/media';
import { MediaCard } from '../components/MediaCard';
import { MediaUploadForm } from '../components/MediaUploadForm';

const PAGE_SIZE = 12;

// Biblioteca de vídeos (RF09): cadastro com licença e listagem com origem, validade e status da licença.
export function MediaPage() {
  const [page,setPage] = useState(1);
  const [result,setResult] = useState<ListMediaAssetsResponse|null>(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);

  const load = useCallback(async (target: number) => {
    setLoading(true); setError('');
    try {
      setResult(await listMedia(target, PAGE_SIZE));
    } catch (err) {
      setError(errorMessage(err)); setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(page); }, [load, page]);

  // Vídeo novo aparece no topo: volta para a primeira página (ou recarrega se já está nela).
  const onCreated = () => { if (page === 1) void load(1); else setPage(1); };

  const meta = result?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;

  return <section className="results catalog media">
    <h2>Biblioteca de vídeos {meta && <small>{meta.total} vídeo(s)</small>}</h2>
    <p className="hint">Só vídeos próprios ou com licença comercial. Vídeo sem prova de licença válida não pode ser associado a uma publicação.</p>

    <MediaUploadForm onCreated={onCreated} />

    {loading && !result && <p className="catalog-loading" role="status">Carregando biblioteca...</p>}

    {error && <div className="catalog-state" role="alert">
      <p className="error">Não foi possível carregar a biblioteca: {error}</p>
      <button type="button" onClick={()=>void load(page)} disabled={loading}>{loading?'Tentando...':'Tentar novamente'}</button>
    </div>}

    {!error && meta?.total === 0 && <div className="catalog-state">
      <p>Nenhum vídeo na biblioteca ainda.</p>
      <p className="hint">Cadastre o primeiro vídeo no formulário acima, informando o tipo de licença e a prova de direito de uso.</p>
    </div>}

    {!error && result && result.data.length > 0 && <>
      <div className="cards" aria-busy={loading}>
        {result.data.map(a=><MediaCard key={a.id} asset={a} />)}
      </div>
      <nav className="pagination" aria-label="Paginação da biblioteca">
        <button type="button" onClick={()=>setPage(p=>p-1)} disabled={loading || page <= 1}>← Anterior</button>
        <span>Página {meta!.page} de {totalPages}</span>
        <button type="button" onClick={()=>setPage(p=>p+1)} disabled={loading || !meta!.hasNextPage}>Próxima →</button>
      </nav>
    </>}
  </section>;
}
