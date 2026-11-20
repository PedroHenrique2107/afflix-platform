import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AffiliateLink, MediaAsset, Product, Publication } from '@prisma/client';
import { DEFAULT_CTA_BY_CHANNEL, PUBLICATION_TRANSITIONS } from '@afflix/shared';
import type { AffiliateChannel, ListPublicationsResponse, PublicationResponse, PublicationStatus, PublicationView } from '@afflix/shared';
import { PrismaService } from '../prisma/prisma.service';
import { assertMediaPublishable, mediaLicenseStatus } from '../media/media-license';
import { assertTransition } from './publication-status';
import { BriefingInput, briefingFilename, buildBriefing } from './briefing';
import { ChangePublicationStatusDto, CreatePublicationDto, ListPublicationsDto, parsePublishedAt, UpdatePublicationDto } from './publication.dto';

// Tolerância para relógio do navegador um pouco à frente do servidor.
const CLOCK_SKEW_MS = 5 * 60 * 1000;

export const PUBLICATION_INCLUDE = {
  product: { select: { id: true, name: true } },
  affiliateLink: { select: { id: true, shortUrl: true } },
  mediaAsset: true,
} as const;

export type PublicationWithRelations = Publication & {
  product: Pick<Product, 'id' | 'name'>;
  affiliateLink: Pick<AffiliateLink, 'id' | 'shortUrl'> | null;
  mediaAsset: MediaAsset | null;
};

export function serializePublication(p: PublicationWithRelations, now = new Date()): PublicationView {
  const status = p.status as PublicationStatus;
  return {
    id: p.id,
    status,
    allowedTransitions: [...PUBLICATION_TRANSITIONS[status]],
    channel: p.channel as AffiliateChannel,
    product: { id: p.product.id, name: p.product.name },
    caption: p.caption,
    cta: p.cta,
    affiliateLink: p.affiliateLink ? { id: p.affiliateLink.id, shortUrl: p.affiliateLink.shortUrl } : null,
    media: p.mediaAsset
      ? { id: p.mediaAsset.id, title: p.mediaAsset.title, licenseStatus: mediaLicenseStatus(p.mediaAsset, now) }
      : null,
    externalUrl: p.externalUrl,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// O que falta para a publicação sair de rascunho (e para o briefing ser exportado).
export function missingForReady(p: Pick<Publication, 'caption' | 'cta' | 'affiliateLinkId'>): string[] {
  const missing: string[] = [];
  if (!p.caption?.trim()) missing.push('legenda (caption)');
  if (!p.cta?.trim()) missing.push('CTA');
  if (!p.affiliateLinkId) missing.push('link de afiliado');
  return missing;
}

@Injectable()
export class PublicationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(dto: CreatePublicationDto): Promise<PublicationResponse> {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product || product.isArchived) throw new NotFoundException('Produto não encontrado no catálogo');
    if (dto.affiliateLinkId) await this.assertLinkMatches(dto.affiliateLinkId, product.id, dto.channel);
    if (dto.mediaAssetId) await this.assertMediaUsable(dto.mediaAssetId);

    const row = await this.prisma.publication.create({
      data: {
        productId: product.id,
        channel: dto.channel,
        caption: dto.caption ?? null,
        cta: dto.cta ?? DEFAULT_CTA_BY_CHANNEL[dto.channel],
        affiliateLinkId: dto.affiliateLinkId ?? null,
        mediaAssetId: dto.mediaAssetId ?? null,
      },
      include: PUBLICATION_INCLUDE,
    });
    return { data: serializePublication(row) };
  }

  async list(dto: ListPublicationsDto): Promise<ListPublicationsResponse> {
    const where = dto.status ? { status: dto.status } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.publication.findMany({
        where, include: PUBLICATION_INCLUDE, orderBy: { updatedAt: 'desc' }, skip: (dto.page - 1) * dto.limit, take: dto.limit,
      }),
      this.prisma.publication.count({ where }),
    ]);
    const now = new Date();
    return {
      data: rows.map(r => serializePublication(r, now)),
      meta: { page: dto.page, limit: dto.limit, total, hasNextPage: dto.page * dto.limit < total },
    };
  }

  async get(id: string): Promise<PublicationResponse> {
    return { data: serializePublication(await this.findOrThrow(id)) };
  }

  // Conteúdo só muda em rascunho: o que foi para READY é o que o operador exportou e vai publicar.
  async update(id: string, dto: UpdatePublicationDto): Promise<PublicationResponse> {
    const current = await this.findOrThrow(id);
    if (current.status !== 'DRAFT') {
      throw new ConflictException('Só publicação em rascunho pode ser editada; volte-a para DRAFT antes');
    }
    const channel = (dto.channel ?? current.channel) as AffiliateChannel;
    const linkId = dto.affiliateLinkId !== undefined ? dto.affiliateLinkId : current.affiliateLinkId;
    if (linkId) await this.assertLinkMatches(linkId, current.productId, channel);
    if (dto.mediaAssetId) await this.assertMediaUsable(dto.mediaAssetId);

    const row = await this.prisma.publication.update({
      where: { id },
      data: Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)),
      include: PUBLICATION_INCLUDE,
    });
    return { data: serializePublication(row) };
  }

  async changeStatus(id: string, dto: ChangePublicationStatusDto, now = new Date()): Promise<PublicationResponse> {
    const current = await this.findOrThrow(id);
    const from = current.status as PublicationStatus;
    assertTransition(from, dto.status);

    const data: { status: PublicationStatus; externalUrl?: string; publishedAt?: Date } = { status: dto.status };
    if (dto.status === 'PUBLISHED_MANUALLY') {
      const missing = [!dto.externalUrl && 'externalUrl', !dto.publishedAt && 'publishedAt'].filter(Boolean);
      if (missing.length) throw new BadRequestException(`Para marcar como publicada informe: ${missing.join(', ')}`);
      const publishedAt = parsePublishedAt(dto.publishedAt!);
      if (publishedAt.getTime() > now.getTime() + CLOCK_SKEW_MS) {
        throw new BadRequestException('publishedAt não pode estar no futuro');
      }
      data.externalUrl = dto.externalUrl!;
      data.publishedAt = publishedAt;
    } else if (dto.externalUrl !== undefined || dto.publishedAt !== undefined) {
      throw new BadRequestException('externalUrl e publishedAt só são aceitos ao marcar como PUBLISHED_MANUALLY');
    }

    if (dto.status === 'READY') {
      const missing = missingForReady(current);
      if (missing.length) throw new BadRequestException(`Complete o rascunho antes de marcar como pronta: falta ${missing.join(', ')}`);
    }
    // A licença pode ter vencido desde que a mídia foi associada: confere de novo antes de seguir para publicar.
    if ((dto.status === 'READY' || dto.status === 'PUBLISHED_MANUALLY') && current.mediaAsset) {
      assertMediaPublishable(current.mediaAsset, now);
    }

    // Grava só se o status ainda for o lido: duas abas transicionando ao mesmo tempo não pulam a tabela.
    const { count } = await this.prisma.publication.updateMany({ where: { id, status: from }, data });
    if (count === 0) throw new ConflictException('A publicação mudou de status em outra operação; recarregue e tente de novo');
    return this.get(id);
  }

  // Material que o operador leva para o canal. Exige legenda, CTA e link; mídia é opcional.
  async exportBriefing(id: string, now = new Date()): Promise<{ filename: string; content: string }> {
    const p = await this.prisma.publication.findUnique({
      where: { id },
      include: { product: true, affiliateLink: { select: { id: true, shortUrl: true } }, mediaAsset: true },
    });
    if (!p) throw new NotFoundException('Publicação não encontrada');
    const missing = missingForReady(p);
    if (missing.length || !p.affiliateLink) {
      throw new ConflictException(`Briefing incompleto: falta ${(missing.length ? missing : ['link de afiliado']).join(', ')}`);
    }
    // Ainda vai ser publicada: não entrega briefing com mídia cuja licença deixou de valer.
    if (p.mediaAsset && (p.status === 'DRAFT' || p.status === 'READY')) assertMediaPublishable(p.mediaAsset, now);

    const input: BriefingInput = {
      id: p.id,
      status: p.status,
      channel: p.channel,
      caption: p.caption!,
      cta: p.cta!,
      shortUrl: p.affiliateLink.shortUrl,
      product: { name: p.product.name, price: p.product.price, productUrl: p.product.productUrl },
      media: p.mediaAsset,
    };
    return { filename: briefingFilename(input), content: buildBriefing(input, now) };
  }

  async findOrThrow(id: string): Promise<PublicationWithRelations> {
    const row = await this.prisma.publication.findUnique({ where: { id }, include: PUBLICATION_INCLUDE });
    if (!row) throw new NotFoundException('Publicação não encontrada');
    return row;
  }

  // O link vai no briefing: precisa ser do mesmo produto e do mesmo canal, senão a atribuição sai errada.
  private async assertLinkMatches(linkId: string, productId: string, channel: AffiliateChannel) {
    const link = await this.prisma.affiliateLink.findUnique({ where: { id: linkId } });
    if (!link) throw new NotFoundException('Link de afiliado não encontrado');
    if (link.productId !== productId) throw new BadRequestException('O link de afiliado é de outro produto');
    if (link.channel !== channel) {
      throw new BadRequestException(`O link de afiliado é do canal ${link.channel}, não de ${channel}`);
    }
  }

  private async assertMediaUsable(mediaAssetId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: mediaAssetId } });
    if (!asset) throw new NotFoundException('Mídia não encontrada');
    assertMediaPublishable(asset);
  }
}
