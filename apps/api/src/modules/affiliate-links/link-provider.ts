import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ShopeeGraphqlClient } from '../shopee/shopee-graphql.client';

export type LinkRequest = { originUrl: string; subIds: string[] };

// Interface independente de fornecedor, no mesmo papel do OfferProvider da busca.
export interface LinkProvider {
  readonly source: 'mock' | 'shopee';
  generate(request: LinkRequest): Promise<string>;
}
export const LINK_PROVIDER = Symbol('LINK_PROVIDER');

// Link fictício e determinístico. O TLD .invalid é reservado (RFC 2606): nunca resolve, nunca vira clique real.
@Injectable()
export class MockLinkProvider implements LinkProvider {
  readonly source = 'mock' as const;
  async generate({ originUrl, subIds }: LinkRequest): Promise<string> {
    const hash = createHash('sha256').update(JSON.stringify([originUrl, subIds])).digest('hex').slice(0, 12);
    return `https://link-ficticio.invalid/${hash}`;
  }
}

@Injectable()
export class ShopeeLinkProvider implements LinkProvider {
  readonly source = 'shopee' as const;
  constructor(@Inject(ShopeeGraphqlClient) private readonly client: ShopeeGraphqlClient) {}
  generate(request: LinkRequest): Promise<string> {
    return this.client.generateShortLink(request);
  }
}
