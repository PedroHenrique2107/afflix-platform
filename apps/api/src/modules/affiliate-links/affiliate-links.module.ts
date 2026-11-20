import { Module } from '@nestjs/common';
import { ShopeeModule } from '../shopee/shopee.module';
import { isShopeeLiveMode } from '../shopee/shopee-mode';
import { AffiliateLinksController } from './affiliate-links.controller';
import { AffiliateLinksService } from './affiliate-links.service';
import { LINK_PROVIDER, MockLinkProvider, ShopeeLinkProvider } from './link-provider';

@Module({
  imports: [ShopeeModule],
  controllers: [AffiliateLinksController],
  providers: [AffiliateLinksService, MockLinkProvider, ShopeeLinkProvider,
    { provide: LINK_PROVIDER, inject: [MockLinkProvider, ShopeeLinkProvider],
      // Mesma regra da busca: só sai do mock com SHOPEE_MOCK_MODE=false explícito.
      useFactory: (mock: MockLinkProvider, shopee: ShopeeLinkProvider) => isShopeeLiveMode() ? shopee : mock },
  ],
})
export class AffiliateLinksModule {}
