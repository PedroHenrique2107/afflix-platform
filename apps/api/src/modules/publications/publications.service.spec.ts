import { describe, expect, it } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { parseDto } from '../../common/parse-dto';
import { createFakePrisma } from '../discovery/fake-prisma';
import { ChangePublicationStatusDto, CreatePublicationDto, UpdatePublicationDto } from './publication.dto';
import { PublicationsService } from './publications.service';

const PRODUCT_ID = 'b6f1c1a0-0000-4000-8000-000000000001';
const OTHER_PRODUCT_ID = 'b6f1c1a0-0000-4000-8000-000000000002';
const LINK_ID = 'c6f1c1a0-0000-4000-8000-000000000001';
const TIKTOK_LINK_ID = 'c6f1c1a0-0000-4000-8000-000000000002';
const OTHER_PRODUCT_LINK_ID = 'c6f1c1a0-0000-4000-8000-000000000003';
const MEDIA_OK = 'd6f1c1a0-0000-4000-8000-000000000001';
const MEDIA_NO_EVIDENCE = 'd6f1c1a0-0000-4000-8000-000000000002';
const MEDIA_EXPIRING = 'd6f1c1a0-0000-4000-8000-000000000003';
const NOW = new Date('2026-11-20T15:00:00.000Z');

const setup = () => {
  const fake = createFakePrisma();
  fake.products.push(
    { id: PRODUCT_ID, name: 'Organizador de gaveta', isArchived: false },
    { id: OTHER_PRODUCT_ID, name: 'Outro produto', isArchived: false },
  );
  const link = (id: string, productId: string, channel: string) =>
    ({ id, productId, channel, shortUrl: `https://link-ficticio.invalid/${id.slice(-4)}`, createdAt: new Date() });
  fake.links.push(link(LINK_ID, PRODUCT_ID, 'INSTAGRAM'), link(TIKTOK_LINK_ID, PRODUCT_ID, 'TIKTOK'), link(OTHER_PRODUCT_LINK_ID, OTHER_PRODUCT_ID, 'INSTAGRAM'));
  const asset = (id: string, rightsEvidence: string | null, licenseExpiresAt: Date | null = null) =>
    ({ id, title: `Vídeo ${id.slice(-1)}`, rightsEvidence, licenseExpiresAt, createdAt: new Date() });
  fake.media.push(asset(MEDIA_OK, 'Gravado pela equipe'), asset(MEDIA_NO_EVIDENCE, null), asset(MEDIA_EXPIRING, 'Contrato 12/2026', new Date('2026-12-01T00:00:00Z')));
  return { ...fake, service: new PublicationsService(fake.prisma) };
};

const create = (fields: Record<string, unknown> = {}) => parseDto(CreatePublicationDto, { productId: PRODUCT_ID, channel: 'INSTAGRAM', ...fields }, false);
const status = (fields: Record<string, unknown>) => parseDto(ChangePublicationStatusDto, fields, false);
const complete = { caption: 'Acabou a bagunça na gaveta', affiliateLinkId: LINK_ID };

describe('PublicationsService.create', () => {
  it('nasce como DRAFT com CTA padrão do canal e as transições disponíveis', async () => {
    const { service } = setup();
    const { data } = await service.create(await create(complete));
    expect(data).toMatchObject({
      status: 'DRAFT', channel: 'INSTAGRAM', cta: 'Link na bio para comprar com desconto',
      product: { id: PRODUCT_ID, name: 'Organizador de gaveta' },
      affiliateLink: { id: LINK_ID }, media: null, externalUrl: null, publishedAt: null,
      allowedTransitions: ['READY', 'ARCHIVED'],
    });
  });

  it('produto inexistente responde 404', async () => {
    const { service } = setup();
    await expect(service.create(await create({ productId: 'b6f1c1a0-0000-4000-8000-0000000000ff' }))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('link de outro produto ou de outro canal é recusado', async () => {
    const { service, publications } = setup();
    await expect(service.create(await create({ affiliateLinkId: OTHER_PRODUCT_LINK_ID }))).rejects.toThrow(/outro produto/);
    await expect(service.create(await create({ affiliateLinkId: TIKTOK_LINK_ID }))).rejects.toThrow(/canal TIKTOK/);
    expect(publications).toHaveLength(0);
  });

  it('não referencia mídia sem prova de licença (409)', async () => {
    const { service, publications } = setup();
    await expect(service.create(await create({ mediaAssetId: MEDIA_NO_EVIDENCE }))).rejects.toBeInstanceOf(ConflictException);
    expect(publications).toHaveLength(0);
  });

  it('aceita mídia com licença válida', async () => {
    const { service } = setup();
    const { data } = await service.create(await create({ mediaAssetId: MEDIA_OK }));
    expect(data.media).toEqual({ id: MEDIA_OK, title: 'Vídeo 1', licenseStatus: 'VALID' });
  });
});

describe('PublicationsService.update', () => {
  it('edita rascunho e null desassocia link', async () => {
    const { service } = setup();
    const { data: draft } = await service.create(await create(complete));
    const { data } = await service.update(draft.id, await parseDto(UpdatePublicationDto, { caption: 'Nova legenda', affiliateLinkId: null }, false));
    expect(data).toMatchObject({ caption: 'Nova legenda', affiliateLink: null });
  });

  it('trocar o canal sem trocar o link de outro canal é recusado', async () => {
    const { service } = setup();
    const { data: draft } = await service.create(await create(complete));
    await expect(service.update(draft.id, await parseDto(UpdatePublicationDto, { channel: 'TIKTOK' }, false))).rejects.toThrow(/canal INSTAGRAM/);
    const { data } = await service.update(draft.id, await parseDto(UpdatePublicationDto, { channel: 'TIKTOK', affiliateLinkId: TIKTOK_LINK_ID }, false));
    expect(data).toMatchObject({ channel: 'TIKTOK', affiliateLink: { id: TIKTOK_LINK_ID } });
  });

  it('não associa mídia sem licença na edição', async () => {
    const { service } = setup();
    const { data: draft } = await service.create(await create());
    await expect(service.update(draft.id, await parseDto(UpdatePublicationDto, { mediaAssetId: MEDIA_NO_EVIDENCE }, false))).rejects.toBeInstanceOf(ConflictException);
  });

  it('fora de DRAFT não edita (409)', async () => {
    const { service } = setup();
    const { data: draft } = await service.create(await create(complete));
    await service.changeStatus(draft.id, await status({ status: 'READY' }), NOW);
    await expect(service.update(draft.id, await parseDto(UpdatePublicationDto, { caption: 'x' }, false))).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('PublicationsService.changeStatus', () => {
  it('percorre o ciclo inteiro: DRAFT → READY → PUBLISHED_MANUALLY → ARCHIVED', async () => {
    const { service } = setup();
    const { data: draft } = await service.create(await create(complete));
    expect((await service.changeStatus(draft.id, await status({ status: 'READY' }), NOW)).data.status).toBe('READY');
    const published = await service.changeStatus(draft.id, await status({
      status: 'PUBLISHED_MANUALLY', externalUrl: 'https://www.instagram.com/p/abc123/', publishedAt: '2026-11-20T14:30:00.000Z',
    }), NOW);
    expect(published.data).toMatchObject({
      status: 'PUBLISHED_MANUALLY', externalUrl: 'https://www.instagram.com/p/abc123/', publishedAt: '2026-11-20T14:30:00.000Z',
      allowedTransitions: ['ARCHIVED'],
    });
    expect((await service.changeStatus(draft.id, await status({ status: 'ARCHIVED' }), NOW)).data.status).toBe('ARCHIVED');
  });

  it('READY volta para DRAFT e rascunho pode ser descartado', async () => {
    const { service } = setup();
    const { data: a } = await service.create(await create(complete));
    await service.changeStatus(a.id, await status({ status: 'READY' }), NOW);
    expect((await service.changeStatus(a.id, await status({ status: 'DRAFT' }), NOW)).data.status).toBe('DRAFT');
    const { data: b } = await service.create(await create());
    expect((await service.changeStatus(b.id, await status({ status: 'ARCHIVED' }), NOW)).data.status).toBe('ARCHIVED');
  });

  it('transição inválida (pular de DRAFT para publicada) responde 400 e não muda nada', async () => {
    const { service, publications } = setup();
    const { data: draft } = await service.create(await create(complete));
    await expect(service.changeStatus(draft.id, await status({
      status: 'PUBLISHED_MANUALLY', externalUrl: 'https://www.instagram.com/p/abc/', publishedAt: '2026-11-20',
    }), NOW)).rejects.toBeInstanceOf(BadRequestException);
    expect(publications[0].status).toBe('DRAFT');
  });

  it('arquivada não sai mais de ARCHIVED', async () => {
    const { service } = setup();
    const { data: draft } = await service.create(await create());
    await service.changeStatus(draft.id, await status({ status: 'ARCHIVED' }), NOW);
    await expect(service.changeStatus(draft.id, await status({ status: 'DRAFT' }), NOW)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('READY exige legenda, CTA e link de afiliado', async () => {
    const { service } = setup();
    const { data: draft } = await service.create(await create({ cta: '   ' }));
    await expect(service.changeStatus(draft.id, await status({ status: 'READY' }), NOW))
      .rejects.toThrow(/falta legenda \(caption\), link de afiliado/);
  });

  it('marcar como publicada exige URL e data', async () => {
    const { service } = setup();
    const { data: draft } = await service.create(await create(complete));
    await service.changeStatus(draft.id, await status({ status: 'READY' }), NOW);
    await expect(service.changeStatus(draft.id, await status({ status: 'PUBLISHED_MANUALLY' }), NOW)).rejects.toThrow(/externalUrl, publishedAt/);
    await expect(service.changeStatus(draft.id, await status({ status: 'PUBLISHED_MANUALLY', externalUrl: 'https://x.com/p/1' }), NOW)).rejects.toThrow(/publishedAt/);
    await expect(service.changeStatus(draft.id, await status({ status: 'PUBLISHED_MANUALLY', publishedAt: '2026-11-20' }), NOW)).rejects.toThrow(/externalUrl/);
  });

  it('URL sem protocolo e data no futuro são recusadas', async () => {
    const { service } = setup();
    const { data: draft } = await service.create(await create(complete));
    await service.changeStatus(draft.id, await status({ status: 'READY' }), NOW);
    await expect(status({ status: 'PUBLISHED_MANUALLY', externalUrl: 'instagram.com/p/1', publishedAt: '2026-11-20' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.changeStatus(draft.id, await status({
      status: 'PUBLISHED_MANUALLY', externalUrl: 'https://www.instagram.com/p/1/', publishedAt: '2026-11-21T15:00:00Z',
    }), NOW)).rejects.toThrow(/futuro/);
  });

  it('URL e data fora de PUBLISHED_MANUALLY são recusadas', async () => {
    const { service } = setup();
    const { data: draft } = await service.create(await create(complete));
    await expect(service.changeStatus(draft.id, await status({ status: 'READY', externalUrl: 'https://x.com/p/1' }), NOW)).rejects.toThrow(/só são aceitos/);
  });

  it('licença que venceu depois da associação bloqueia a publicação (409)', async () => {
    const { service } = setup();
    const { data: draft } = await service.create(await create({ ...complete, mediaAssetId: MEDIA_EXPIRING }));
    await service.changeStatus(draft.id, await status({ status: 'READY' }), NOW);
    const afterExpiry = new Date('2026-12-02T12:00:00Z');
    await expect(service.changeStatus(draft.id, await status({
      status: 'PUBLISHED_MANUALLY', externalUrl: 'https://www.instagram.com/p/1/', publishedAt: '2026-12-02',
    }), afterExpiry)).rejects.toThrow(/licença vencida/);
  });

  it('publicação inexistente responde 404', async () => {
    const { service } = setup();
    await expect(service.changeStatus('e6f1c1a0-0000-4000-8000-000000000001', await status({ status: 'READY' }), NOW)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PublicationsService.list', () => {
  it('filtra por status e mostra o estado de cada publicação', async () => {
    const { service } = setup();
    const { data: a } = await service.create(await create(complete));
    await service.create(await create());
    await service.changeStatus(a.id, await status({ status: 'READY' }), NOW);
    const all = await service.list({ page: 1, limit: 20 });
    expect(all.meta.total).toBe(2);
    expect(all.data.map(p => p.status).sort()).toEqual(['DRAFT', 'READY']);
    const ready = await service.list({ page: 1, limit: 20, status: 'READY' });
    expect(ready.data.map(p => p.id)).toEqual([a.id]);
  });
});
