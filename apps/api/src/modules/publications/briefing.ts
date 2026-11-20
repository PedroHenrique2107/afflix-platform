import { AFFILIATE_CHANNELS, MEDIA_LICENSE_LABELS, PUBLICATION_STATUS_LABELS } from '@afflix/shared';
import type { MediaLicenseType, PublicationStatus } from '@afflix/shared';
import { mediaLicenseStatus } from '../media/media-license';

type Price = { toFixed(digits: number): string } | null;

// Só o que o briefing lê: o service monta a partir da Publication com product, affiliateLink e mediaAsset.
export type BriefingInput = {
  id: string;
  status: string;
  channel: string;
  caption: string;
  cta: string;
  shortUrl: string;
  product: { name: string; price: Price; productUrl: string };
  media: {
    title: string; storagePath: string; sha256: string | null; licenseType: string;
    rightsEvidence: string | null; licenseExpiresAt: Date | null;
  } | null;
};

const CHANNEL_LABELS: Record<(typeof AFFILIATE_CHANNELS)[number], string> = {
  INSTAGRAM: 'Instagram', TIKTOK: 'TikTok', SHOPEE_VIDEO: 'Shopee Vídeo', TELEGRAM: 'Telegram',
};
const channelLabel = (c: string) => CHANNEL_LABELS[c as keyof typeof CHANNEL_LABELS] ?? c;
const money = (p: Price) => (p === null ? 'não informado' : `R$ ${p.toFixed(2).replace('.', ',')}`);

// Texto puro: o operador abre, copia a legenda pronta e publica à mão no canal (ADR-007, sem automação).
export function buildBriefing(b: BriefingInput, now = new Date()): string {
  const mediaSection = b.media
    ? [
      `Título: ${b.media.title}`,
      `Arquivo: ${b.media.storagePath}`,
      `SHA-256: ${b.media.sha256 ?? 'não calculado'}`,
      `Licença: ${MEDIA_LICENSE_LABELS[b.media.licenseType as MediaLicenseType] ?? b.media.licenseType}`,
      `Prova de licença: ${b.media.rightsEvidence ?? 'não registrada'}`,
      `Válida até: ${b.media.licenseExpiresAt ? b.media.licenseExpiresAt.toISOString().slice(0, 10) : 'sem vencimento'}`,
      `Situação na exportação: ${mediaLicenseStatus(b.media, now)}`,
    ]
    : ['Sem mídia associada: publicar com imagem do produto ou só texto.'];

  return [
    'BRIEFING DE PUBLICAÇÃO — AFFLIX',
    `Publicação: ${b.id}`,
    `Status: ${PUBLICATION_STATUS_LABELS[b.status as PublicationStatus] ?? b.status} (${b.status})`,
    `Canal: ${channelLabel(b.channel)}`,
    `Gerado em: ${now.toISOString()}`,
    '',
    '== PRODUTO ==',
    `Nome: ${b.product.name}`,
    `Preço: ${money(b.product.price)}`,
    `Página do produto: ${b.product.productUrl}`,
    '',
    '== LINK DE AFILIADO ==',
    b.shortUrl,
    '',
    '== LEGENDA ==',
    b.caption,
    '',
    '== CTA ==',
    b.cta,
    '',
    '== TEXTO PRONTO PARA COLAR ==',
    b.caption,
    '',
    `${b.cta}: ${b.shortUrl}`,
    '',
    '== MÍDIA ==',
    ...mediaSection,
    '',
    '== CHECKLIST ==',
    `[ ] Publicar manualmente no ${channelLabel(b.channel)} com a legenda e o CTA acima`,
    '[ ] Conferir que o link publicado é o link de afiliado deste briefing',
    '[ ] Registrar no Afflix a URL do post e a data da publicação',
    '',
  ].join('\n');
}

// Nome de arquivo só com ASCII: "briefing-instagram-organizador-de-gaveta-33dd6c9e.txt".
export function briefingFilename(b: Pick<BriefingInput, 'id' | 'channel' | 'product'>): string {
  const slug = b.product.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  return ['briefing', b.channel.toLowerCase().replace(/_/g, '-'), slug || 'produto', b.id.slice(0, 8)].join('-') + '.txt';
}
