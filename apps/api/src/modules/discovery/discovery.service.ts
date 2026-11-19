import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { Offer, OfferProvider, OFFER_PROVIDER } from './offer-provider';
import { ImportProductsDto, ListProductsDto, SearchProductsDto } from './discovery.dto';
import { meetsMinimumCommission } from './commission';
import { offerToProductData, productKey, ProductKey, serializeProduct } from './product.mapper';
import { PrismaService } from '../prisma/prisma.service';

function within(value: string | undefined, min?: number, max?: number): boolean {
  if (min === undefined && max === undefined) return true;
  if (value === undefined) return false;
  let d: Decimal;
  try { d = new Decimal(value); } catch { return false; }
  return d.isFinite() && (min === undefined || d.gte(min)) && (max === undefined || d.lte(max));
}
@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    @Inject(OFFER_PROVIDER) private readonly provider: OfferProvider,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async search(dto: SearchProductsDto) {
    if (dto.minPrice !== undefined && dto.maxPrice !== undefined && dto.minPrice > dto.maxPrice) {
      throw new BadRequestException('minPrice não pode superar maxPrice');
    }
    if (!Number.isInteger(dto.page) || !Number.isInteger(dto.limit) || dto.page < 1 || dto.limit < 1 || dto.limit > 50) {
      throw new BadRequestException('Paginação inválida');
    }
    const found = await this.provider.search({ keyword:dto.keyword, page:dto.page, limit:dto.limit });
    const filtered = found.items.filter(p =>
      meetsMinimumCommission(p.commissionRate, dto.minCommissionPercent) &&
      within(p.price, dto.minPrice, dto.maxPrice) &&
      within(p.rating, dto.minRating)
    );
    const saved = await this.findSavedKeysSafely(filtered);
    const data = filtered.map(p => ({
      ...p,
      commissionPercent: new Decimal(p.commissionRate!).mul(100).toFixed(2),
      saved: saved.has(productKey(p)),
    }));
    return {data, meta:{...found.pageInfo, source:found.source}};
  }

  // Importa ofertas no catálogo: upsert idempotente + um PriceSnapshot por importação, atômicos por oferta.
  async importOffers(dto: ImportProductsDto) {
    const existing = await this.findSavedKeys(dto.offers);
    let created = 0;
    let updated = 0;
    for (const offer of dto.offers) {
      const { where, create, update, snapshot } = offerToProductData(offer);
      await this.prisma.$transaction(async tx => {
        const product = await tx.product.upsert({ where, create, update });
        await tx.priceSnapshot.create({
          data: { productId: product.id, price: snapshot.price, commissionRate: snapshot.commissionRate },
        });
      });
      const key = productKey(offer);
      if (existing.has(key)) updated++;
      else { created++; existing.add(key); } // mesma oferta repetida no lote conta como atualização
    }
    return { data: { created, updated, total: dto.offers.length } };
  }

  async listProducts(dto: ListProductsDto) {
    const where = { isArchived: false };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { lastSyncedAt: 'desc' },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return {
      data: rows.map(serializeProduct),
      meta: { page: dto.page, limit: dto.limit, total, hasNextPage: dto.page * dto.limit < total },
    };
  }

  // Consulta em lote quais [marketplace, shopId, itemId] já existem no catálogo.
  private async findSavedKeys(items: ProductKey[]): Promise<Set<string>> {
    if (items.length === 0) return new Set();
    const rows = await this.prisma.product.findMany({
      where: { OR: items.map(({ marketplace, shopId, itemId }) => ({ marketplace, shopId, itemId })) },
      select: { marketplace: true, shopId: true, itemId: true },
    });
    return new Set(rows.map(productKey));
  }

  // A busca não pode cair só porque o banco está indisponível: sem catálogo, saved fica false.
  private async findSavedKeysSafely(items: Offer[]): Promise<Set<string>> {
    try {
      return await this.findSavedKeys(items);
    } catch (error) {
      this.logger.warn(`Catálogo indisponível, saved=false nesta busca: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
      return new Set();
    }
  }
}
