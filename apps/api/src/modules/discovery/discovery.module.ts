import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { OFFER_PROVIDER } from './offer-provider';
import { MockOfferProvider } from './mock-offer.provider';
import { ShopeeOfferProvider } from './shopee-offer.provider';
import { ShopeeModule } from '../shopee/shopee.module';
import { isShopeeLiveMode } from '../shopee/shopee-mode';
@Module({
  imports:[ShopeeModule],
  controllers:[DiscoveryController],
  providers:[DiscoveryService,MockOfferProvider,ShopeeOfferProvider,
    {provide:OFFER_PROVIDER,inject:[MockOfferProvider,ShopeeOfferProvider],
      useFactory:(mock:MockOfferProvider,shopee:ShopeeOfferProvider) => isShopeeLiveMode() ? shopee : mock}
  ],
})
export class DiscoveryModule {}
