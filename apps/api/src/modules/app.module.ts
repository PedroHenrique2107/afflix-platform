import { Module, Controller, Get } from '@nestjs/common';
import { DiscoveryModule } from './discovery/discovery.module';
import { PrismaModule } from './prisma/prisma.module';

@Controller('health')
class HealthController {
  @Get()
  status() { return { status: 'ok' }; }
}

@Module({ imports: [PrismaModule, DiscoveryModule], controllers: [HealthController] })
export class AppModule {}
