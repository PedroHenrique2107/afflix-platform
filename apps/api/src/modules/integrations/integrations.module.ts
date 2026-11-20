import { Module } from '@nestjs/common';
import { ShopeeModule } from '../shopee/shopee.module';
import { IntegrationsController } from './integrations.controller';

@Module({
  imports: [ShopeeModule],
  controllers: [IntegrationsController],
})
export class IntegrationsModule {}
