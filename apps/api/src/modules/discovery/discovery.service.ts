import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { OfferProvider, OFFER_PROVIDER } from './offer-provider';
import { SearchProductsDto } from './discovery.dto';
import { meetsMinimumCommission } from './commission';

function within(value: string | undefined, min?: number, max?: number): boolean {
  if (min === undefined && max === undefined) return true;
  if (value === undefined) return false;
  let d: Decimal;
  try { d = new Decimal(value); } catch { return false; }
  return d.isFinite() && (min === undefined || d.gte(min)) && (max === undefined || d.lte(max));
}
@Injectable()
export class DiscoveryService {
  constructor(@Inject(OFFER_PROVIDER) private readonly provider: OfferProvider) {}
  async search(dto: SearchProductsDto) {
    if (dto.minPrice !== undefined && dto.maxPrice !== undefined && dto.minPrice > dto.maxPrice) {
      throw new BadRequestException('minPrice não pode superar maxPrice');
    }
    if (!Number.isInteger(dto.page) || !Number.isInteger(dto.limit) || dto.page < 1 || dto.limit < 1 || dto.limit > 50) {
      throw new BadRequestException('Paginação inválida');
    }
    const found = await this.provider.search({ keyword:dto.keyword, page:dto.page, limit:dto.limit });
    const data = found.items.filter(p =>
      meetsMinimumCommission(p.commissionRate, dto.minCommissionPercent) &&
      within(p.price, dto.minPrice, dto.maxPrice) &&
      within(p.rating, dto.minRating)
    ).map(p => ({...p, commissionPercent: new Decimal(p.commissionRate!).mul(100).toFixed(2), saved:false }));
    return {data, meta:{...found.pageInfo, source:found.source}};
  }
}
