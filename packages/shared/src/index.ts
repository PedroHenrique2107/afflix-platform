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

// GET /api/v1/integrations/status (RF08). Nunca carrega credencial nem fragmento dela.
export type IntegrationMode = 'mock' | 'live';
export type IntegrationStatusResponse = {
  data: {
    shopee: {
      mode: IntegrationMode;
      // Última chamada bem-sucedida à Shopee desde que a api subiu (ISO 8601). null: nenhuma ainda.
      lastSuccessfulSyncAt: string | null;
    };
  };
};

export type CreateAffiliateLinkResponse = {
  data: AffiliateLinkView;
  // reused=true: já existia link para o mesmo produto+canal+campanha+subIds e nada foi gerado na Shopee.
  meta: { reused: boolean; source: 'mock' | 'shopee' };
};

// POST /api/v1/products/import. Upsert idempotente: reimportar conta em updated, nunca duplica.
export type ImportedProductRef = { id: string; marketplace: Marketplace; shopId: string; itemId: string };
export type ImportProductsResponse = {
  data: { created: number; updated: number; total: number; items: ImportedProductRef[] };
};

// GET /api/v1/products. Decimais como string com escala fixa; datas em ISO 8601. Campo ausente na origem vem null.
export type CatalogProduct = {
  id: string;
  marketplace: Marketplace;
  shopId: string;
  itemId: string;
  name: string;
  productUrl: string;
  offerUrl: string | null;
  imageUrl: string | null;
  price: string | null;
  priceMax: string | null;
  commissionRate: string | null; // 0.080000 = 8%
  commissionPercent: string | null; // "8.00"
  estimatedCommission: string | null;
  rating: string | null;
  sales: number | null;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
};
export type ListProductsResponse = {
  data: CatalogProduct[];
  meta: { page: number; limit: number; total: number; hasNextPage: boolean };
};

// --- Biblioteca de mídia (RF09) ---
// Tipos de licença aceitos. Acesso a produtos da Shopee não concede direito sobre vídeos de terceiros.
export const MEDIA_LICENSE_TYPES = ['ORIGINAL', 'COMMERCIAL_LICENSE', 'CREATOR_CONSENT', 'CC_COMMERCIAL'] as const;
export type MediaLicenseType = (typeof MEDIA_LICENSE_TYPES)[number];
export const MEDIA_LICENSE_LABELS: Record<MediaLicenseType, string> = {
  ORIGINAL: 'Produção própria',
  COMMERCIAL_LICENSE: 'Licença comercial',
  CREATOR_CONSENT: 'Consentimento do criador',
  CC_COMMERCIAL: 'Creative Commons com uso comercial',
};

// VALID: tem prova de licença (rightsEvidence) e não venceu. Só VALID pode entrar numa publicação.
export type MediaLicenseStatus = 'VALID' | 'MISSING_EVIDENCE' | 'EXPIRED';

export const MEDIA_MAX_BYTES = 500 * 1024 * 1024;
export const MEDIA_TITLE_MAX_LENGTH = 200;
export const MEDIA_EVIDENCE_MAX_LENGTH = 2000;

export type MediaAssetView = {
  id: string;
  title: string;
  storagePath: string; // relativo à pasta de mídia da api
  sha256: string; // calculado pela api a partir do arquivo
  sourceUrl: string | null;
  licenseType: MediaLicenseType;
  rightsEvidence: string | null;
  licenseExpiresAt: string | null; // ISO 8601; null = sem vencimento
  licenseStatus: MediaLicenseStatus;
  publishable: boolean;
  createdAt: string;
};

// POST /api/v1/media (multipart: file + campos abaixo como texto). O hash nunca vem do cliente.
export type CreateMediaAssetFields = {
  title: string;
  licenseType: MediaLicenseType;
  sourceUrl?: string;
  rightsEvidence?: string;
  licenseExpiresAt?: string; // YYYY-MM-DD (vale até o fim do dia, UTC) ou ISO 8601
};

// PATCH /api/v1/media/:id. Só metadados; arquivo, caminho e hash são imutáveis. null limpa o campo.
export type UpdateMediaAssetRequest = {
  title?: string;
  licenseType?: MediaLicenseType;
  sourceUrl?: string | null;
  rightsEvidence?: string | null;
  licenseExpiresAt?: string | null;
};

export type MediaAssetResponse = { data: MediaAssetView };
export type ListMediaAssetsResponse = {
  data: MediaAssetView[];
  meta: { page: number; limit: number; total: number; hasNextPage: boolean };
};

// GET /api/v1/affiliate-links?productId=... Links já gerados de um produto, para escolher qual vai na publicação.
export type ListAffiliateLinksResponse = { data: AffiliateLinkView[] };

// --- Publicação manual (RF10) ---
export const PUBLICATION_STATUSES = ['DRAFT', 'READY', 'PUBLISHED_MANUALLY', 'ARCHIVED'] as const;
export const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  DRAFT: 'Rascunho',
  READY: 'Pronta para publicar',
  PUBLISHED_MANUALLY: 'Publicada',
  ARCHIVED: 'Arquivada',
};

// Segue a ordem do enum. Exceções: READY volta a DRAFT para edição e um rascunho pode ser descartado (ARCHIVED).
// Fora desta tabela a api responde 400.
export const PUBLICATION_TRANSITIONS: Record<PublicationStatus, readonly PublicationStatus[]> = {
  DRAFT: ['READY', 'ARCHIVED'],
  READY: ['DRAFT', 'PUBLISHED_MANUALLY'],
  PUBLISHED_MANUALLY: ['ARCHIVED'],
  ARCHIVED: [],
};

// CTA sugerido quando o operador não informa um. Ele pode editar enquanto a publicação é rascunho.
export const DEFAULT_CTA_BY_CHANNEL: Record<AffiliateChannel, string> = {
  INSTAGRAM: 'Link na bio para comprar com desconto',
  TIKTOK: 'Link na bio para comprar com desconto',
  SHOPEE_VIDEO: 'Toque no produto do vídeo para comprar',
  TELEGRAM: 'Compre pelo link abaixo',
};

export const PUBLICATION_CAPTION_MAX_LENGTH = 2200;
export const PUBLICATION_CTA_MAX_LENGTH = 200;

export type PublicationView = {
  id: string;
  status: PublicationStatus;
  allowedTransitions: PublicationStatus[];
  channel: AffiliateChannel;
  product: { id: string; name: string };
  caption: string | null;
  cta: string | null;
  affiliateLink: { id: string; shortUrl: string } | null;
  media: { id: string; title: string; licenseStatus: MediaLicenseStatus } | null;
  externalUrl: string | null; // URL do post no canal, informada ao marcar como publicada
  publishedAt: string | null; // ISO 8601
  createdAt: string;
  updatedAt: string;
};

// POST /api/v1/publications. Nasce como DRAFT. Mídia só entra se a licença estiver VALID (409 caso contrário).
export type CreatePublicationRequest = {
  productId: string;
  channel: AffiliateChannel;
  caption?: string;
  cta?: string; // ausente: DEFAULT_CTA_BY_CHANNEL[channel]
  affiliateLinkId?: string; // mesmo produto e mesmo canal da publicação
  mediaAssetId?: string;
};

// PATCH /api/v1/publications/:id. Só em DRAFT (409 nos demais). null desassocia/limpa o campo.
export type UpdatePublicationRequest = {
  channel?: AffiliateChannel;
  caption?: string | null;
  cta?: string | null;
  affiliateLinkId?: string | null;
  mediaAssetId?: string | null;
};

// POST /api/v1/publications/:id/status. PUBLISHED_MANUALLY exige externalUrl e publishedAt; os outros destinos recusam esses campos.
export type ChangePublicationStatusRequest = {
  status: PublicationStatus;
  externalUrl?: string;
  publishedAt?: string; // YYYY-MM-DD ou ISO 8601; não pode estar no futuro
};

export type PublicationResponse = { data: PublicationView };
export type ListPublicationsResponse = {
  data: PublicationView[];
  meta: { page: number; limit: number; total: number; hasNextPage: boolean };
};
