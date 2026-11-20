import { Module } from '@nestjs/common';
import { ShopeeGraphqlClient } from '../shopee/shopee-graphql.client';
import { AffiliateLinksController } from './affiliate-links.controller';
import { AffiliateLinksService } from './affiliate-links.service';
import { LINK_PROVIDER, MockLinkProvider, ShopeeLinkProvider } from './link-provider';

@Module({
  controllers: [AffiliateLinksController],
  providers: [AffiliateLinksService, MockLinkProvider, ShopeeLinkProvider, ShopeeGraphqlClient,
    { provide: LINK_PROVIDER, inject: [MockLinkProvider, ShopeeLinkProvider],
      // Mesma regra da busca: só sai do mock com SHOPEE_MOCK_MODE=false explícito.
      useFactory: (mock: MockLinkProvider, shopee: ShopeeLinkProvider) => process.env.SHOPEE_MOCK_MODE === 'false' ? shopee : mock },
  ],
})
export class AffiliateLinksModule {}
