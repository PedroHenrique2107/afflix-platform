import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { MediaAsset } from '@prisma/client';
import type { ListMediaAssetsResponse, MediaAssetResponse, MediaAssetView, MediaLicenseType } from '@afflix/shared';
import { parseDto } from '../../common/parse-dto';
import { PrismaService } from '../prisma/prisma.service';
import { mediaLicenseStatus } from './media-license';
import { MEDIA_STORAGE, MediaStorage, sha256File } from './media-storage';
import { CreateMediaAssetDto, ListMediaAssetsDto, parseExpiry, UpdateMediaAssetDto } from './media.dto';

// Arquivo já gravado pelo multer na pasta temporária (subconjunto de Express.Multer.File).
export type UploadedMedia = { path: string; originalname: string; mimetype: string; size: number };

export function serializeMediaAsset(a: MediaAsset, now = new Date()): MediaAssetView {
  const licenseStatus = mediaLicenseStatus(a, now);
  return {
    id: a.id,
    title: a.title,
    storagePath: a.storagePath,
    sha256: a.sha256 ?? '',
    sourceUrl: a.sourceUrl,
    licenseType: a.licenseType as MediaLicenseType,
    rightsEvidence: a.rightsEvidence,
    licenseExpiresAt: a.licenseExpiresAt?.toISOString() ?? null,
    licenseStatus,
    publishable: licenseStatus === 'VALID',
    createdAt: a.createdAt.toISOString(),
  };
}

@Injectable()
export class MediaService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  // Valida antes de mover o arquivo; qualquer falha apaga o temporário, então nada fica órfão no disco.
  async create(rawFields: unknown, file: UploadedMedia | undefined): Promise<MediaAssetResponse> {
    if (!file) throw new BadRequestException('Envie o arquivo de vídeo no campo "file"');
    let storagePath: string | undefined;
    try {
      const dto = await parseDto(CreateMediaAssetDto, rawFields ?? {}, false);
      const sha256 = await sha256File(file.path);
      const duplicate = await this.prisma.mediaAsset.findFirst({ where: { sha256 }, select: { id: true } });
      if (duplicate) throw new ConflictException(`Este arquivo já está na biblioteca (asset ${duplicate.id})`);
      storagePath = await this.storage.store(file.path, sha256, file.originalname);
      const row = await this.prisma.mediaAsset.create({
        data: {
          title: dto.title,
          licenseType: dto.licenseType,
          sourceUrl: dto.sourceUrl ?? null,
          rightsEvidence: dto.rightsEvidence ?? null,
          licenseExpiresAt: dto.licenseExpiresAt ? parseExpiry(dto.licenseExpiresAt) : null,
          storagePath,
          sha256,
        },
      });
      return { data: serializeMediaAsset(row) };
    } catch (error) {
      if (storagePath) await this.storage.remove(storagePath);
      else await this.storage.discard(file.path);
      throw error;
    }
  }

  async list(dto: ListMediaAssetsDto): Promise<ListMediaAssetsResponse> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.mediaAsset.findMany({ orderBy: { createdAt: 'desc' }, skip: (dto.page - 1) * dto.limit, take: dto.limit }),
      this.prisma.mediaAsset.count(),
    ]);
    const now = new Date();
    return {
      data: rows.map(r => serializeMediaAsset(r, now)),
      meta: { page: dto.page, limit: dto.limit, total, hasNextPage: dto.page * dto.limit < total },
    };
  }

  async update(id: string, dto: UpdateMediaAssetDto): Promise<MediaAssetResponse> {
    const found = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Mídia não encontrada');
    const { licenseExpiresAt, ...rest } = dto;
    const row = await this.prisma.mediaAsset.update({
      where: { id },
      data: {
        ...rest,
        ...(licenseExpiresAt !== undefined && { licenseExpiresAt: licenseExpiresAt === null ? null : parseExpiry(licenseExpiresAt) }),
      },
    });
    return { data: serializeMediaAsset(row) };
  }
}
