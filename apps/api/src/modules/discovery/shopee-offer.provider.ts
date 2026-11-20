import { Inject, Injectable, BadGatewayException, Logger } from '@nestjs/common';
import { ShopeeGraphqlClient } from '../shopee/shopee-graphql.client';
import { PRODUCT_OFFERS_QUERY } from '../shopee/shopee.queries';
import { OfferProvider, OfferSearch, OfferSearchResponse, Offer } from './offer-provider';

// Tipos confirmados por introspecção na conta real (20/11/2026): IDs e sales são Int64 (chegam como number JSON),
// valores monetários, taxas e ratingStar chegam como string.
export type ShopeeNode = {
  itemId: string | number; shopId: string | number; productName: string;
  productLink: string; offerLink?: string | null; imageUrl?: string | null;
  priceMin?: string | number | null; priceMax?: string | number | null;
  commissionRate?: string | number | null; commission?: string | number | null;
  ratingStar?: string | number | null; sales?: number | null;
};
type Result = { productOfferV2: { nodes: ShopeeNode[]; pageInfo: { page: number; limit: number; hasNextPage: boolean } } };
const textOrUndefined = (x: string | number | null | undefined): string | undefined => x == null ? undefined : String(x);

// Int64 acima de 2^53 já chega corrompido do JSON.parse. Melhor descartar o item que gravar/gerar link com ID errado.
// Valores reais observados têm ~11 dígitos (bem abaixo de 2^53 ≈ 9e15).
export function safeShopeeId(value: string | number): string | undefined {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? String(value) : undefined;
  return /^[1-9][0-9]{0,18}$/.test(value) ? value : undefined;
}

// ratingStar "0" na conta real = produto sem avaliação (visto em item com 1 venda), não nota zero.
function ratingOrUndefined(x: string | number | null | undefined): string | undefined {
  const text = textOrUndefined(x);
  return text === undefined || Number(text) === 0 ? undefined : text;
}

export function shopeeNodeToOffer(n: ShopeeNode): Offer | undefined {
  const itemId = safeShopeeId(n.itemId);
  const shopId = safeShopeeId(n.shopId);
  if (!itemId || !shopId) return undefined;
  return {
    marketplace: 'SHOPEE', itemId, shopId,
    name: n.productName, productUrl: n.productLink,
    offerUrl: n.offerLink ?? undefined, imageUrl: n.imageUrl ?? undefined,
    price: textOrUndefined(n.priceMin), priceMax: textOrUndefined(n.priceMax),
    commissionRate: textOrUndefined(n.commissionRate), // fração: "0.53" = 53% (confirmado: commission = priceMin × rate)
    estimatedCommission: textOrUndefined(n.commission),
    rating: ratingOrUndefined(n.ratingStar), sales: n.sales ?? undefined,
  };
}

@Injectable()
export class ShopeeOfferProvider implements OfferProvider {
  private readonly logger = new Logger(ShopeeOfferProvider.name);

  constructor(@Inject(ShopeeGraphqlClient) private readonly client: ShopeeGraphqlClient) {}

  async search(params: OfferSearch): Promise<OfferSearchResponse> {
    // Busca é query (idempotente): pode repetir em falha transitória (RNF03).
    const data = await this.client.execute<Result>(PRODUCT_OFFERS_QUERY, params, { retry: true });
    if (!data.productOfferV2 || !Array.isArray(data.productOfferV2.nodes)) {
      throw new BadGatewayException('Schema de busca Shopee incompatível');
    }
    const items: Offer[] = [];
    for (const node of data.productOfferV2.nodes) {
      const offer = shopeeNodeToOffer(node);
      if (offer) items.push(offer);
      else this.logger.warn('Oferta da Shopee descartada: itemId/shopId fora do intervalo seguro');
    }
    return { items, pageInfo: data.productOfferV2.pageInfo, source: 'shopee' };
  }
}
