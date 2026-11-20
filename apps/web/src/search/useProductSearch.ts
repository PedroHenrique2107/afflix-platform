import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { searchProducts } from '../api/products';
import type { Offer } from '../api/products';

// Estado da busca. Vive no AppLayout (acima das rotas) para sobreviver à troca entre /busca e /catalogo.
export function useProductSearch() {
  const [keyword,setKeyword] = useState('organizador de cozinha');
  const [commission,setCommission] = useState('8');
  const [results,setResults] = useState<Offer[]>([]);
  const [source,setSource] = useState('');
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);

  async function search() {
    setLoading(true); setError('');
    try {
      const data = await searchProducts({ keyword, minCommissionPercent:commission });
      setResults(data.data); setSource(data.meta.source);
    } catch (err) {setError(err instanceof Error?err.message:'Falha desconhecida');setResults([]);setSource('');}
    finally {setLoading(false);}
  }

  // Depois do import feito pelo card, guarda o id para não reimportar (nem gerar snapshot) no próximo link.
  const markSaved = (target:Offer) => (productId:string) =>
    setResults(list=>list.map(p=>p.shopId===target.shopId&&p.itemId===target.itemId?{...p,saved:true,productId}:p));

  return { keyword, setKeyword, commission, setCommission, results, source, error, loading, search, markSaved };
}

export type ProductSearch = ReturnType<typeof useProductSearch>;

// Lido pelas páginas filhas do AppLayout via <Outlet context>.
export const useProductSearchContext = () => useOutletContext<ProductSearch>();
