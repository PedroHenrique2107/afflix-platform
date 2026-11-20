import { useCallback, useEffect, useState } from 'react';
import type { MetricsReportGroupBy, MetricsReportResponse } from '@afflix/shared';
import { errorMessage } from '../api/client';
import { getMetricsReport } from '../api/metrics';
import { MetricForm } from '../components/MetricForm';
import { MetricsGroupCard } from '../components/MetricsReport';

const VIEWS: { value: MetricsReportGroupBy; label: string }[] = [
  { value:'publication', label:'Por publicação' },
  { value:'product', label:'Por produto' },
];

// Métricas (RF11): registro com fonte e data de observação, e relatório que separa registro manual de relatório oficial.
export function MetricsPage() {
  const [groupBy,setGroupBy] = useState<MetricsReportGroupBy>('publication');
  const [result,setResult] = useState<MetricsReportResponse|null>(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);

  const load = useCallback(async (target: MetricsReportGroupBy) => {
    setLoading(true); setError('');
    try {
      setResult(await getMetricsReport(target));
    } catch (err) {
      setError(errorMessage(err)); setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(groupBy); }, [load, groupBy]);

  const byProduct = result?.meta.groupBy === 'product';

  return <section className="results catalog metrics">
    <h2>Métricas {result && <small>{result.data.length} {byProduct ? 'produto(s)' : 'publicação(ões)'} com registro</small>}</h2>
    <p className="hint">Todo número mostra a fonte e quando foi observado. Registro manual e relatório oficial ficam em linhas separadas e nunca são somados.</p>

    <MetricForm onSaved={()=>void load(groupBy)} />

    <nav className="tabs status-filter" aria-label="Agrupar relatório">
      {VIEWS.map(v=><button key={v.value} type="button" className={groupBy === v.value ? 'tab active' : 'tab'} onClick={()=>setGroupBy(v.value)}>
        {v.label}
      </button>)}
    </nav>

    {loading && !result && <p className="catalog-loading" role="status">Carregando relatório...</p>}

    {error && <div className="catalog-state" role="alert">
      <p className="error">Não foi possível carregar o relatório: {error}</p>
      <button type="button" onClick={()=>void load(groupBy)} disabled={loading}>{loading?'Tentando...':'Tentar novamente'}</button>
    </div>}

    {!error && result?.data.length === 0 && <div className="catalog-state">
      <p>Nenhuma métrica registrada ainda.</p>
      <p className="hint">Registre o primeiro número no formulário acima, a partir de uma publicação já publicada.</p>
    </div>}

    {!error && result && result.data.length > 0 && <div className="cards metrics-cards" aria-busy={loading}>
      {result.data.map(g=><MetricsGroupCard key={g.publication?.id ?? g.product.id} group={g} byProduct={byProduct} />)}
    </div>}
  </section>;
}
