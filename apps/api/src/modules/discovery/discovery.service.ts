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
    const saved = await this.findSavedIdsSafely(filtered);
    const data = filtered.map(p => {
      const productId = saved.get(productKey(p)) ?? null;
      return {
        ...p,
        commissionPercent: new Decimal(p.commissionRate!).mul(100).toFixed(2),
        saved: productId !== null,
        productId, // id no catálogo quando salvo: o web usa para gerar link sem reimportar
      };
    });
    return {data, meta:{...found.pageInfo, source:found.source}};
  }

  // Importa ofertas no catálogo: upsert idempotente + um PriceSnapshot por importação, atômicos por oferta.
  async importOffers(dto: ImportProductsDto) {
    const existing = await this.findSavedIds(dto.offers);
    const ids = new Map<string, ProductKey & { id: string }>();
    let created = 0;
    let updated = 0;
    for (const offer of dto.offers) {
      const { key: productKeyFields, where, create, update, snapshot } = offerToProductData(offer);
      const product = await this.prisma.$transaction(async tx => {
        const row = await tx.product.upsert({ where, create, update });
        await tx.priceSnapshot.create({
          data: { productId: row.id, price: snapshot.price, commissionRate: snapshot.commissionRate },
        });
        return row;
      });
      const key = productKey(offer);
      if (existing.has(key)) updated++;
      else { created++; existing.set(key, product.id); } // mesma oferta repetida no lote conta como atualização
      ids.set(key, { id: product.id, ...productKeyFields });
    }
    // items: um por produto distinto do lote, para o cliente usar o id (ex.: gerar link de afiliado).
    return { data: { created, updated, total: dto.offers.length, items: [...ids.values()] } };
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

  // Consulta em lote quais [marketplace, shopId, itemId] já existem no catálogo. Chave -> id do produto.
  private async findSavedIds(items: ProductKey[]): Promise<Map<string, string>> {
    if (items.length === 0) return new Map();
    const rows = await this.prisma.product.findMany({
      where: { OR: items.map(({ marketplace, shopId, itemId }) => ({ marketplace, shopId, itemId })) },
      select: { id: true, marketplace: true, shopId: true, itemId: true },
    });
    return new Map(rows.map(r => [productKey(r), r.id]));
  }

  // A busca não pode cair só porque o banco está indisponível: sem catálogo, saved fica false.
  private async findSavedIdsSafely(items: Offer[]): Promise<Map<string, string>> {
    try {
      return await this.findSavedIds(items);
    } catch (error) {
      this.logger.warn(`Catálogo indisponível, saved=false nesta busca: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
      return new Map();
    }
  }
}
