import { useState } from 'react';

type Offer = {
  itemId:string; shopId:string; name:string; price?:string;
  commissionPercent:string; productUrl:string; rating?:string;
};
type ApiResult = { data:Offer[];meta:{source:string;page:number;limit:number;hasNextPage:boolean} };

export default function App() {
  const [keyword,setKeyword] = useState('organizador de cozinha');
  const [commission,setCommission] = useState('8');
  const [results,setResults] = useState<Offer[]>([]);
  const [source,setSource] = useState('');
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  async function search() {
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams({keyword,minCommissionPercent:commission,page:'1',limit:'20'});
      const response = await fetch(`/api/v1/products/search?${qs.toString()}`);
      if (!response.ok) throw new Error(`Busca falhou (HTTP ${response.status})`);
      const data = await response.json() as ApiResult;
      setResults(data.data); setSource(data.meta.source);
    } catch (err) {setError(err instanceof Error?err.message:'Falha desconhecida');setResults([]);setSource('');}
    finally {setLoading(false);}
  }
  return <main className="container">
    <header><span className="brand">AFFLIX</span><span className="version">MVP V1 · protótipo de descoberta</span></header>
    <section className="hero"><p className="eyebrow">PRODUCT DISCOVERY</p><h1>Encontre oportunidades para seus próximos conteúdos.</h1><p>Comece pelo nicho de casa e cozinha, compare taxas e selecione ofertas para publicação manual.</p></section>
    <form className="filters" onSubmit={e=>{e.preventDefault();void search();}}><label>Produto<input value={keyword} onChange={e=>setKeyword(e.target.value)} /></label><label>Comissão mínima (%)<input type="number" min="0" max="100" value={commission} onChange={e=>setCommission(e.target.value)} /></label><button type="submit" disabled={loading || keyword.trim().length < 3}>{loading?'Consultando...':'Buscar ofertas'}</button></form>
    {source==='mock'&&<p className="notice">Dados demonstrativos. Nenhuma oferta ou comissão exibida foi verificada na Shopee.</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    <section className="results"><h2>Resultados <small>{results.length} produto(s)</small></h2><div className="cards">{results.map(p=><article className="card" key={`${p.shopId}-${p.itemId}`}><div className="thumb">▦</div><div className="info"><h3>{p.name}</h3><p>Preço: {p.price?`R$ ${p.price}`:'não informado'}</p><p>Comissão: <strong>{p.commissionPercent}%</strong></p><p>Avaliação: {p.rating??'não informada'}</p>{source !== 'mock' && <a href={p.productUrl} target="_blank" rel="noopener noreferrer">Ver produto</a>}</div></article>)}</div></section>
    <footer>A busca e a interface são apenas a primeira entrega técnica; importação, links e publicações constam no roadmap V1.</footer>
  </main>;
}
