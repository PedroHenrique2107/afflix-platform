import type { CreateAffiliateLinkRequest, CreateAffiliateLinkResponse } from '@afflix/shared';
import { postJson } from './client';

// POST /api/v1/affiliate-links. A api reaproveita o link existente para o mesmo produto+canal+campanha+subIds.
export const createAffiliateLink = (body: CreateAffiliateLinkRequest) =>
  postJson<CreateAffiliateLinkResponse>('/api/v1/affiliate-links', body);
