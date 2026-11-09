import { BadRequestException, Controller, Get, Inject, Query } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DiscoveryService } from './discovery.service';
import { SearchProductsDto } from './discovery.dto';
@Controller('products')
export class DiscoveryController {
  constructor(@Inject(DiscoveryService) private readonly service: DiscoveryService) {}
  @Get('search')
  async search(@Query() rawQuery: Record<string, string>) {
    const dto = plainToInstance(SearchProductsDto, rawQuery, { enableImplicitConversion: true });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length) throw new BadRequestException(errors.flatMap(e => Object.values(e.constraints ?? {})));
    return this.service.search(dto);
  }
}
