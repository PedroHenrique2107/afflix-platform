import type {
  ChangePublicationStatusRequest, CreatePublicationRequest, ListPublicationsResponse, PublicationResponse,
  PublicationStatus, UpdatePublicationRequest,
} from '@afflix/shared';
import { getJson, patchJson, postJson } from './client';

export function listPublications(page: number, limit: number, status?: PublicationStatus) {
  const qs = new URLSearchParams({ page:String(page), limit:String(limit), ...(status && { status }) });
  return getJson<ListPublicationsResponse>(`/api/v1/publications?${qs.toString()}`);
}

export const createPublication = (body: CreatePublicationRequest) =>
  postJson<PublicationResponse>('/api/v1/publications', body);

// Só rascunho: a api responde 409 nos demais status.
export const updatePublication = (id: string, body: UpdatePublicationRequest) =>
  patchJson<PublicationResponse>(`/api/v1/publications/${id}`, body);

export const changePublicationStatus = (id: string, body: ChangePublicationStatusRequest) =>
  postJson<PublicationResponse>(`/api/v1/publications/${id}/status`, body);

// GET /api/v1/publications/:id/briefing. Baixa o .txt; erro (ex. 409 briefing incompleto) vira Error com a mensagem da api.
export async function downloadBriefing(id: string): Promise<void> {
  const response = await fetch(`/api/v1/publications/${id}/briefing`);
  if (!response.ok) {
    const json = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(json?.message || `Falha HTTP ${response.status}`);
  }
  const filename = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ?? `briefing-${id}.txt`;
  const url = URL.createObjectURL(await response.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
