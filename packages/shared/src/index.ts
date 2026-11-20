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
