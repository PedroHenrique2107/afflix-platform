import { NavLink, Outlet } from 'react-router-dom';
import { useProductSearch } from '../search/useProductSearch';

// Telas do menu. Nova tela (Publicação, Métricas): uma entrada aqui + uma <Route> no App.
const NAV: { to:string; label:string }[] = [{ to:'/busca', label:'Buscar' }, { to:'/catalogo', label:'Catálogo' }, { to:'/midia', label:'Mídia' }];

export function AppLayout() {
  const search = useProductSearch();
  return <main className="container">
    <header>
      <span className="brand">AFFLIX</span>
      {/* NavLink já marca aria-current="page" na rota ativa. */}
      <nav className="tabs" aria-label="Seções">
        {NAV.map(n=><NavLink key={n.to} to={n.to} className={({isActive})=>isActive?'tab active':'tab'}>{n.label}</NavLink>)}
      </nav>
      <span className="version">MVP V1 · protótipo de descoberta</span>
    </header>
    <Outlet context={search} />
    <footer>Gerar link salva o produto no catálogo e reaproveita o link existente para o mesmo canal e campanha. Publicações constam no roadmap V1.</footer>
  </main>;
}
