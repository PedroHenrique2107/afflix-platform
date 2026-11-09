export type Offer = {
  marketplace: 'SHOPEE';
  itemId: string;
  shopId: string;
  name: string;
  productUrl: string;
  offerUrl?: string;
  imageUrl?: string;
  price?: string;
  priceMax?: string;
  commissionRate?: string; // escala fracionária: 0.08 = 8%
  estimatedCommission?: string;
  rating?: string;
  sales?: number;
};
export type OfferSearch = {
  keyword: string;
  page: number;
  limit: number;
};
export type OfferSearchResponse = {
  items: Offer[];
  pageInfo: { page: number; limit: number; hasNextPage: boolean };
  source: 'mock' | 'shopee';
};
export interface OfferProvider {
  search(params: OfferSearch): Promise<OfferSearchResponse>;
}
export const OFFER_PROVIDER = Symbol('OFFER_PROVIDER');
