import { Module } from '@nestjs/common';
import { ShopeeGraphqlClient } from './shopee-graphql.client';

// Instância única do client: o status da integração (última chamada OK) precisa ser o mesmo para busca e links.
@Module({
  providers: [ShopeeGraphqlClient],
  exports: [ShopeeGraphqlClient],
})
export class ShopeeModule {}
