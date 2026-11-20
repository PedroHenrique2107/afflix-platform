import type { AffiliateChannel, CreateAffiliateLinkRequest, CreateAffiliateLinkResponse, ListAffiliateLinksResponse } from '@afflix/shared';
import { getJson, postJson } from './client';

// POST /api/v1/affiliate-links. A api reaproveita o link existente para o mesmo produto+canal+campanha+subIds.
export const createAffiliateLink = (body: CreateAffiliateLinkRequest) =>
  postJson<CreateAffiliateLinkResponse>('/api/v1/affiliate-links', body);

// GET /api/v1/affiliate-links. Só lê o banco: não gera link nem chama a Shopee.
export function listAffiliateLinks(productId: string, channel?: AffiliateChannel) {
  const qs = new URLSearchParams({ productId, ...(channel && { channel }) });
  return getJson<ListAffiliateLinksResponse>(`/api/v1/affiliate-links?${qs.toString()}`);
}
