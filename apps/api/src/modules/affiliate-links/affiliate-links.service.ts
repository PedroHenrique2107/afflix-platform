import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AffiliateLink } from '@prisma/client';
import { createHash } from 'node:crypto';
import type { AffiliateChannel, AffiliateLinkView, CreateAffiliateLinkResponse, ListAffiliateLinksResponse } from '@afflix/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAffiliateLinkDto, ListAffiliateLinksDto } from './affiliate-link.dto';
import { LINK_PROVIDER, LinkProvider } from './link-provider';

// Só gera link para produto cuja origem é a própria Shopee (evita usar a mutation como encurtador genérico).
export function isAllowedOrigin(value: string): boolean {
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  return url.protocol === 'https:' && !url.username && !url.password &&
    (url.hostname === 'shopee.com.br' || url.hostname.endsWith('.shopee.com.br'));
}

// subId aceita só alfanumérico: "Natal 2026" vira "natal2026", "SHOPEE_VIDEO" vira "shopeevideo".
const toSubId = (text: string) =>
  text.normalize('NFD').replace(/[^A-Za-z0-9]/g, '').toLowerCase().slice(0, 50);

// Sem subIds explícitos, canal e campanha viram subIds para a atribuição aparecer separada no painel da Shopee.
export function effectiveSubIds(dto: Pick<CreateAffiliateLinkDto, 'channel' | 'campaign' | 'subIds'>): string[] {
  if (dto.subIds?.length) return dto.subIds;
  return [dto.channel, dto.campaign].map(v => (v ? toSubId(v) : '')).filter(Boolean);
}

// Fonte entra na chave: link fictício do mock nunca é devolvido como se fosse link real depois do live.
export function dedupeKeyFor(source: string, productId: string, channel: string, campaign: string | null, subIds: string[]) {
  return createHash('sha256').update(JSON.stringify([source, productId, channel, campaign, subIds])).digest('hex');
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

function serialize(link: AffiliateLink): AffiliateLinkView {
  return {
    id: link.id,
    productId: link.productId,
    channel: link.channel as AffiliateChannel,
    campaign: link.campaign,
    subIds: link.subIds as string[],
    shortUrl: link.shortUrl,
    createdAt: link.createdAt.toISOString(),
  };
}

@Injectable()
export class AffiliateLinksService {
  constructor(
    @Inject(LINK_PROVIDER) private readonly provider: LinkProvider,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listByProduct(dto: ListAffiliateLinksDto): Promise<ListAffiliateLinksResponse> {
    const rows = await this.prisma.affiliateLink.findMany({
      where: { productId: dto.productId, ...(dto.channel && { channel: dto.channel }) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { data: rows.map(serialize) };
  }

  async create(dto: CreateAffiliateLinkDto): Promise<CreateAffiliateLinkResponse> {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product || product.isArchived) throw new NotFoundException('Produto não encontrado no catálogo');
    if (!isAllowedOrigin(product.productUrl)) throw new ConflictException('URL de origem do produto não é da Shopee');

    const source = this.provider.source;
    const campaign = dto.campaign ?? null;
    const subIds = effectiveSubIds(dto);
    const dedupeKey = dedupeKeyFor(source, product.id, dto.channel, campaign, subIds);

    const existing = await this.prisma.affiliateLink.findUnique({ where: { dedupeKey } });
    if (existing) return { data: serialize(existing), meta: { reused: true, source } };

    // Uma chamada só: a mutation não é repetida em caso de falha (doc 03, idempotência).
    const shortUrl = await this.provider.generate({ originUrl: product.productUrl, subIds });
    try {
      const row = await this.prisma.affiliateLink.create({
        data: { productId: product.id, channel: dto.channel, campaign, subIds, shortUrl, dedupeKey },
      });
      return { data: serialize(row), meta: { reused: false, source } };
    } catch (error) {
      // Corrida: outra requisição igual gravou primeiro. Devolve o registro vencedor em vez de duplicar.
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.prisma.affiliateLink.findUnique({ where: { dedupeKey } });
      if (!winner) throw error;
      return { data: serialize(winner), meta: { reused: true, source } };
    }
  }
}
