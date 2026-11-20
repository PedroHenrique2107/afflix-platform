import { MEDIA_LICENSE_LABELS } from '@afflix/shared';
import type { MediaAssetView, MediaLicenseStatus } from '@afflix/shared';

const STATUS_LABEL: Record<MediaLicenseStatus, string> = {
  VALID: 'Publicável',
  MISSING_EVIDENCE: 'Sem prova de licença',
  EXPIRED: 'Licença vencida',
};

// A validade é guardada como fim do dia em UTC: exibe a data em UTC para não "voltar" um dia no fuso do Brasil.
const formatExpiry = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone:'UTC' }) : 'Sem vencimento';

// Mostrado à parte do status: um vídeo sem prova também pode estar com a licença vencida.
const expired = (iso: string | null) => iso !== null && new Date(iso).getTime() < Date.now();

export function MediaCard({ asset }: { asset: MediaAssetView }) {
  return <article className={`card media-card ${asset.publishable ? '' : 'blocked'}`}>
    <div className="thumb">▶<span className={`license-badge ${asset.licenseStatus.toLowerCase()}`}>{STATUS_LABEL[asset.licenseStatus]}</span></div>
    <div className="info">
      <h3>{asset.title}</h3>
      <p>Licença: {MEDIA_LICENSE_LABELS[asset.licenseType] ?? asset.licenseType}</p>
      <p>Validade: {expired(asset.licenseExpiresAt)
        ? <strong className="error">{formatExpiry(asset.licenseExpiresAt)} (vencida)</strong>
        : <strong>{formatExpiry(asset.licenseExpiresAt)}</strong>}</p>
      <p>Origem: {asset.sourceUrl
        ? <a href={asset.sourceUrl} target="_blank" rel="noopener noreferrer">{new URL(asset.sourceUrl).hostname}</a>
        : 'não informada'}</p>
      {asset.rightsEvidence && <p className="evidence">Prova: {asset.rightsEvidence}</p>}
      <p className="hash" title={asset.sha256}>SHA-256 {asset.sha256.slice(0, 12)}…</p>
    </div>
  </article>;
}
