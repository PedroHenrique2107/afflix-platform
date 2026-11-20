import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { SearchPage } from './pages/SearchPage';
import { CatalogPage } from './pages/CatalogPage';
import { MediaPage } from './pages/MediaPage';
import { PublicationsPage } from './pages/PublicationsPage';

// Rotas da aplicação. O AppLayout guarda o estado da busca, então ele sobrevive à navegação; o catálogo recarrega ao abrir.
export default function App() {
  return <Routes>
    <Route element={<AppLayout />}>
      <Route index element={<Navigate to="/busca" replace />} />
      <Route path="busca" element={<SearchPage />} />
      <Route path="catalogo" element={<CatalogPage />} />
      <Route path="midia" element={<MediaPage />} />
      <Route path="publicacoes" element={<PublicationsPage />} />
      <Route path="*" element={<Navigate to="/busca" replace />} />
    </Route>
  </Routes>;
}
