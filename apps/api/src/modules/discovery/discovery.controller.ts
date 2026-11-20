import { Body, Controller, Get, HttpCode, Inject, Post, Query } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { ImportProductsDto, ListProductsDto, SearchProductsDto } from './discovery.dto';
import { parseDto } from '../../common/parse-dto';

@Controller('products')
export class DiscoveryController {
  constructor(@Inject(DiscoveryService) private readonly service: DiscoveryService) {}

  @Get('search')
  async search(@Query() rawQuery: Record<string, string>) {
    return this.service.search(await parseDto(SearchProductsDto, rawQuery, true));
  }

  @Get()
  async list(@Query() rawQuery: Record<string, string>) {
    return this.service.listProducts(await parseDto(ListProductsDto, rawQuery, true));
  }

  @Post('import')
  @HttpCode(200)
  async importOffers(@Body() rawBody: unknown) {
    return this.service.importOffers(await parseDto(ImportProductsDto, rawBody, false));
  }
}
