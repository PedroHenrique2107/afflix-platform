import { Module, Controller, Get } from '@nestjs/common';
import { DiscoveryModule } from './discovery/discovery.module';
import { PrismaModule } from './prisma/prisma.module';
import { AffiliateLinksModule } from './affiliate-links/affiliate-links.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { MediaModule } from './media/media.module';

@Controller('health')
class HealthController {
  @Get()
  status() { return { status: 'ok' }; }
}

@Module({ imports: [PrismaModule, DiscoveryModule, AffiliateLinksModule, IntegrationsModule, MediaModule], controllers: [HealthController] })
export class AppModule {}
