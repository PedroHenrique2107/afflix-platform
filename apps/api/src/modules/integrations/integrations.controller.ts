import { Controller, Get, Inject } from '@nestjs/common';
import type { IntegrationStatusResponse } from '@afflix/shared';
import { ShopeeGraphqlClient } from '../shopee/shopee-graphql.client';
import { isShopeeLiveMode } from '../shopee/shopee-mode';

// RF08: só modo e última chamada OK. Nada de App ID, secret, fragmento deles ou URL com credencial.
export function shopeeStatus(client: Pick<ShopeeGraphqlClient, 'getLastSuccessAt'>): IntegrationStatusResponse {
  const last = client.getLastSuccessAt();
  return {
    data: {
      shopee: {
        mode: isShopeeLiveMode() ? 'live' : 'mock',
        lastSuccessfulSyncAt: last ? last.toISOString() : null,
      },
    },
  };
}

@Controller('integrations')
export class IntegrationsController {
  constructor(@Inject(ShopeeGraphqlClient) private readonly shopee: ShopeeGraphqlClient) {}

  @Get('status')
  status(): IntegrationStatusResponse {
    return shopeeStatus(this.shopee);
  }
}
