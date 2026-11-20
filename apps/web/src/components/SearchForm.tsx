type Props = {
  keyword:string; onKeywordChange:(value:string)=>void;
  commission:string; onCommissionChange:(value:string)=>void;
  loading:boolean; onSubmit:()=>void;
};

export function SearchForm({ keyword, onKeywordChange, commission, onCommissionChange, loading, onSubmit }: Props) {
  return <form className="filters" onSubmit={e=>{e.preventDefault();onSubmit();}}>
    <label>Produto<input value={keyword} onChange={e=>onKeywordChange(e.target.value)} /></label>
    <label>Comissão mínima (%)<input type="number" min="0" max="100" value={commission} onChange={e=>onCommissionChange(e.target.value)} /></label>
    <button type="submit" disabled={loading || keyword.trim().length < 3}>{loading?'Consultando...':'Buscar ofertas'}</button>
  </form>;
}
