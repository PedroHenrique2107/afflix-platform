import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { OFFER_PROVIDER } from './offer-provider';
import { MockOfferProvider } from './mock-offer.provider';
import { ShopeeOfferProvider } from './shopee-offer.provider';
import { ShopeeGraphqlClient } from '../shopee/shopee-graphql.client';
@Module({
  controllers:[DiscoveryController],
  providers:[DiscoveryService,MockOfferProvider,ShopeeOfferProvider,ShopeeGraphqlClient,
    {provide:OFFER_PROVIDER,inject:[MockOfferProvider,ShopeeOfferProvider],
      useFactory:(mock:MockOfferProvider,shopee:ShopeeOfferProvider) => process.env.SHOPEE_MOCK_MODE === 'false' ? shopee : mock}
  ],
})
export class DiscoveryModule {}
