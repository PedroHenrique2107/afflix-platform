import { Module, Controller, Get } from '@nestjs/common';
import { DiscoveryModule } from './discovery/discovery.module';

@Controller('health')
class HealthController {
  @Get()
  status() { return { status: 'ok' }; }
}

@Module({ imports: [DiscoveryModule], controllers: [HealthController] })
export class AppModule {}
