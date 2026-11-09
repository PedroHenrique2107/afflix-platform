import { Inject, Injectable, BadGatewayException } from '@nestjs/common';
import { ShopeeGraphqlClient } from '../shopee/shopee-graphql.client';
import { PRODUCT_OFFERS_QUERY } from '../shopee/shopee.queries';
import { OfferProvider, OfferSearch, OfferSearchResponse, Offer } from './offer-provider';

type ShopeeNode = {
  itemId: string | number; shopId: string | number; productName: string;
  productLink: string; offerLink?: string | null; imageUrl?: string | null;
  priceMin?: string | number | null; priceMax?: string | number | null;
  commissionRate?: string | number | null; commission?: string | number | null;
  ratingStar?: string | number | null; sales?: number | null;
};
type Result = { productOfferV2: { nodes: ShopeeNode[]; pageInfo: { page: number; limit: number; hasNextPage: boolean } } };
const textOrUndefined = (x: string | number | null | undefined): string | undefined => x == null ? undefined : String(x);
@Injectable()
export class ShopeeOfferProvider implements OfferProvider {
  constructor(@Inject(ShopeeGraphqlClient) private readonly client: ShopeeGraphqlClient) {}
  async search(params: OfferSearch): Promise<OfferSearchResponse> {
    const data = await this.client.execute<Result>(PRODUCT_OFFERS_QUERY, params);
    if (!data.productOfferV2 || !Array.isArray(data.productOfferV2.nodes)) {
      throw new BadGatewayException('Schema de busca Shopee incompatível');
    }
    const items: Offer[] = data.productOfferV2.nodes.map(n => ({
      marketplace:'SHOPEE', itemId:String(n.itemId),shopId:String(n.shopId),
      name:n.productName, productUrl:n.productLink,
      offerUrl:n.offerLink ?? undefined, imageUrl:n.imageUrl ?? undefined,
      price:textOrUndefined(n.priceMin),priceMax:textOrUndefined(n.priceMax),
      commissionRate:textOrUndefined(n.commissionRate),
      estimatedCommission:textOrUndefined(n.commission),
      rating:textOrUndefined(n.ratingStar),sales:n.sales ?? undefined,
    }));
    return { items, pageInfo:data.productOfferV2.pageInfo, source:'shopee' };
  }
}
