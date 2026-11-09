import { Controller, Get, Query } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { SearchProductsDto } from './discovery.dto';
@Controller('products')
export class DiscoveryController {
  constructor(private readonly service: DiscoveryService) {}
  @Get('search')
  search(@Query() query: SearchProductsDto) { return this.service.search(query); }
}
