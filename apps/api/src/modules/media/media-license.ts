import { ConflictException } from '@nestjs/common';
import type { MediaLicenseStatus } from '@afflix/shared';

type LicenseFields = { rightsEvidence: string | null; licenseExpiresAt: Date | null };

// Prova de licença = evidência registrada e licença não vencida. Regra do doc 01: sem isso, a mídia não é publicada.
export function mediaLicenseStatus(asset: LicenseFields, now = new Date()): MediaLicenseStatus {
  if (!asset.rightsEvidence?.trim()) return 'MISSING_EVIDENCE';
  if (asset.licenseExpiresAt && asset.licenseExpiresAt.getTime() < now.getTime()) return 'EXPIRED';
  return 'VALID';
}

// Barreira para o módulo de publicações: chame antes de associar um MediaAsset a uma Publication.
export function assertMediaPublishable(asset: LicenseFields & { id: string }, now = new Date()): void {
  const status = mediaLicenseStatus(asset, now);
  if (status === 'MISSING_EVIDENCE') {
    throw new ConflictException(`Mídia ${asset.id} sem prova de licença não pode ser associada a uma publicação`);
  }
  if (status === 'EXPIRED') {
    throw new ConflictException(`Mídia ${asset.id} com licença vencida não pode ser associada a uma publicação`);
  }
}
