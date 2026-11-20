import { ProductCard } from '../components/ProductCard';
import { SearchForm } from '../components/SearchForm';
import { useProductSearchContext } from '../search/useProductSearch';

export function SearchPage() {
  const s = useProductSearchContext();
  return <>
    <section className="hero"><p className="eyebrow">PRODUCT DISCOVERY</p><h1>Encontre oportunidades para seus próximos conteúdos.</h1><p>Comece pelo nicho de casa e cozinha, compare taxas e selecione ofertas para publicação manual.</p></section>
    <SearchForm keyword={s.keyword} onKeywordChange={s.setKeyword} commission={s.commission} onCommissionChange={s.setCommission} loading={s.loading} onSubmit={()=>void s.search()} />
    {s.source==='mock'&&<p className="notice">Dados demonstrativos. Nenhuma oferta ou comissão exibida foi verificada na Shopee.</p>}
    {s.error&&<p className="error" role="alert">{s.error}</p>}
    <section className="results"><h2>Resultados <small>{s.results.length} produto(s)</small></h2><div className="cards">{s.results.map(p=><ProductCard key={`${p.shopId}-${p.itemId}`} offer={p} source={s.source} onSaved={s.markSaved(p)} />)}</div></section>
  </>;
}
