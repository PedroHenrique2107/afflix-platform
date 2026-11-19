export type Marketplace = 'SHOPEE';
export type PublicationStatus = 'DRAFT' | 'READY' | 'PUBLISHED_MANUALLY' | 'ARCHIVED';

// Fonte única dos canais: a api valida com esta lista e o web monta o seletor a partir dela.
export const AFFILIATE_CHANNELS = ['INSTAGRAM', 'TIKTOK', 'SHOPEE_VIDEO', 'TELEGRAM'] as const;
export type AffiliateChannel = (typeof AFFILIATE_CHANNELS)[number];

// Limites conservadores para subIds. Confirmar com a conta homologada (doc 05) antes do live.
export const SUB_ID_MAX_COUNT = 5;
export const SUB_ID_PATTERN = /^[A-Za-z0-9]{1,50}$/;
export const CAMPAIGN_MAX_LENGTH = 60;

// POST /api/v1/affiliate-links
export type CreateAffiliateLinkRequest = {
  productId: string;
  channel: AffiliateChannel;
  campaign?: string;
  subIds?: string[];
};

export type AffiliateLinkView = {
  id: string;
  productId: string;
  channel: AffiliateChannel;
  campaign: string | null;
  subIds: string[];
  shortUrl: string;
  createdAt: string;
};

export type CreateAffiliateLinkResponse = {
  data: AffiliateLinkView;
  // reused=true: já existia link para o mesmo produto+canal+campanha+subIds e nada foi gerado na Shopee.
  meta: { reused: boolean; source: 'mock' | 'shopee' };
};
