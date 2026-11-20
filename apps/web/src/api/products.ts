import type { ImportProductsResponse, ListProductsResponse } from '@afflix/shared';
import { getJson, postJson } from './client';

// Oferta como a busca devolve: campos da Shopee + os calculados pela api (commissionPercent, saved, productId).
export type Offer = {
  marketplace:'SHOPEE'; itemId:string; shopId:string; name:string; productUrl:string;
  offerUrl?:string; imageUrl?:string; price?:string; priceMax?:string; commissionRate?:string;
  estimatedCommission?:string; rating?:string; sales?:number;
  commissionPercent:string; saved:boolean; productId:string|null;
};

export type SearchProductsResult = { data:Offer[]; meta:{source:string;page:number;limit:number;hasNextPage:boolean} };
export type SearchParams = { keyword:string; minCommissionPercent:string };

// GET /api/v1/products/search. Mantém a mensagem própria da busca (só o status HTTP), como antes da SW-15.
export async function searchProducts({ keyword, minCommissionPercent }: SearchParams): Promise<SearchProductsResult> {
  const qs = new URLSearchParams({ keyword, minCommissionPercent, page:'1', limit:'20' });
  const response = await fetch(`/api/v1/products/search?${qs.toString()}`);
  if (!response.ok) throw new Error(`Busca falhou (HTTP ${response.status})`);
  return await response.json() as SearchProductsResult;
}

// O import recusa campos desconhecidos: envia só os campos da oferta, sem os calculados pela busca.
function toImportOffer(o: Offer) {
  const { commissionPercent: _c, saved: _s, productId: _p, ...offer } = o;
  return offer;
}

// POST /api/v1/products/import. Upsert no catálogo: reimportar a mesma oferta atualiza o produto, nunca duplica.
export async function importOffer(offer: Offer): Promise<string> {
  const imported = await postJson<ImportProductsResponse>('/api/v1/products/import', { offers:[toImportOffer(offer)] });
  return imported.data.items[0].id;
}

// GET /api/v1/products. Catálogo persistido: mais recente primeiro, sem arquivados — ordem e filtro são da api.
export function listProducts(page: number, limit: number) {
  const qs = new URLSearchParams({ page:String(page), limit:String(limit) });
  return getJson<ListProductsResponse>(`/api/v1/products?${qs.toString()}`);
}
