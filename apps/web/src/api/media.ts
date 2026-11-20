import type { ListMediaAssetsResponse, MediaAssetResponse } from '@afflix/shared';
import { getJson, postForm } from './client';

// GET /api/v1/media. Mais recente primeiro; cada item já vem com licenseStatus calculado pela api.
export function listMedia(page: number, limit: number) {
  const qs = new URLSearchParams({ page:String(page), limit:String(limit) });
  return getJson<ListMediaAssetsResponse>(`/api/v1/media?${qs.toString()}`);
}

// POST /api/v1/media (multipart). O sha256 é calculado pela api a partir do arquivo; o cliente nunca envia.
export const uploadMedia = (form: FormData) => postForm<MediaAssetResponse>('/api/v1/media', form);
