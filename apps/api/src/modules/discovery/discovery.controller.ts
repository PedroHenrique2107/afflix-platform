import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Post, Query } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DiscoveryService } from './discovery.service';
import { ImportProductsDto, ListProductsDto, SearchProductsDto } from './discovery.dto';

// tsx não emite decorator metadata: o ValidationPipe global não enxerga o tipo do DTO,
// então cada rota instancia e valida o DTO manualmente.
async function parseDto<T extends object>(cls: new () => T, raw: unknown, implicitConversion: boolean): Promise<T> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BadRequestException('Corpo da requisição inválido');
  }
  const dto = plainToInstance(cls, raw, { enableImplicitConversion: implicitConversion });
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length) throw new BadRequestException(errors.flatMap(flattenErrors));
  return dto;
}

function flattenErrors(e: { property: string; constraints?: Record<string, string>; children?: unknown[] }): string[] {
  const own = Object.values(e.constraints ?? {});
  const nested = (e.children ?? []).flatMap(c => flattenErrors(c as Parameters<typeof flattenErrors>[0]));
  return [...own, ...nested.map(m => (own.length || !e.property ? m : `${e.property}.${m}`))];
}

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
