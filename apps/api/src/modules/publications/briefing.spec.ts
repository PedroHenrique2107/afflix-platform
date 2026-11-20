import { describe, expect, it } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createFakePrisma } from '../discovery/fake-prisma';
import { briefingFilename, buildBriefing } from './briefing';
import { PublicationsService } from './publications.service';

const PRODUCT_ID = 'b6f1c1a0-0000-4000-8000-000000000001';
const LINK_ID = 'c6f1c1a0-0000-4000-8000-000000000001';
const MEDIA_OK = 'd6f1c1a0-0000-4000-8000-000000000001';
const MEDIA_EXPIRING = 'd6f1c1a0-0000-4000-8000-000000000002';
const NOW = new Date('2026-11-20T15:00:00.000Z');
const SHORT_URL = 'https://link-ficticio.invalid/abc123';

const setup = () => {
  const fake = createFakePrisma();
  fake.products.push({
    id: PRODUCT_ID, name: 'Organizador de Gaveta Ajustável', isArchived: false,
    price: new Prisma.Decimal('49.9'), productUrl: 'https://shopee.com.br/product/456/123',
  });
  fake.links.push({ id: LINK_ID, productId: PRODUCT_ID, channel: 'INSTAGRAM', shortUrl: SHORT_URL, createdAt: new Date() });
  fake.media.push(
    { id: MEDIA_OK, title: 'Unboxing', storagePath: 'ab12.mp4', sha256: 'ab12', licenseType: 'ORIGINAL', rightsEvidence: 'Gravado pela equipe', licenseExpiresAt: null, createdAt: new Date() },
    { id: MEDIA_EXPIRING, title: 'Review', storagePath: 'cd34.mp4', sha256: 'cd34', licenseType: 'CREATOR_CONSENT', rightsEvidence: 'Termo assinado', licenseExpiresAt: new Date('2026-12-01T00:00:00Z'), createdAt: new Date() },
  );
  const service = new PublicationsService(fake.prisma);
  const draft = (fields: Record<string, unknown> = {}) => fake.prisma.publication.create({
    data: { productId: PRODUCT_ID, channel: 'INSTAGRAM', caption: 'Acabou a bagunça na gaveta', cta: 'Link na bio', affiliateLinkId: LINK_ID, ...fields },
  });
  return { ...fake, service, draft };
};

describe('exportação de briefing', () => {
  it('contém produto, link de afiliado, legenda e CTA', async () => {
    const { service, draft } = setup();
    const pub = await draft();
    const { content, filename } = await service.exportBriefing(pub.id, NOW);
    expect(content).toContain('Nome: Organizador de Gaveta Ajustável');
    expect(content).toContain('Preço: R$ 49,90');
    expect(content).toContain('Página do produto: https://shopee.com.br/product/456/123');
    expect(content).toContain(`== LINK DE AFILIADO ==\n${SHORT_URL}`);
    expect(content).toContain('== LEGENDA ==\nAcabou a bagunça na gaveta');
    expect(content).toContain('== CTA ==\nLink na bio');
    expect(content).toContain(`Link na bio: ${SHORT_URL}`);
    expect(content).toContain('Canal: Instagram');
    expect(filename).toBe(`briefing-instagram-organizador-de-gaveta-ajustavel-${pub.id.slice(0, 8)}.txt`);
  });

  it('funciona para publicação sem mídia associada', async () => {
    const { service, draft } = setup();
    const pub = await draft();
    const { content } = await service.exportBriefing(pub.id, NOW);
    expect(content).toContain('Sem mídia associada');
  });

  it('com mídia, traz arquivo, hash e prova de licença', async () => {
    const { service, draft } = setup();
    const pub = await draft({ mediaAssetId: MEDIA_OK });
    const { content } = await service.exportBriefing(pub.id, NOW);
    expect(content).toContain('Arquivo: ab12.mp4');
    expect(content).toContain('SHA-256: ab12');
    expect(content).toContain('Licença: Produção própria');
    expect(content).toContain('Prova de licença: Gravado pela equipe');
    expect(content).toContain('Situação na exportação: VALID');
  });

  it('não exporta briefing incompleto (409 dizendo o que falta)', async () => {
    const { service, draft } = setup();
    const pub = await draft({ caption: null, affiliateLinkId: null });
    await expect(service.exportBriefing(pub.id, NOW)).rejects.toThrow(/falta legenda \(caption\), link de afiliado/);
    await expect(service.exportBriefing(pub.id, NOW)).rejects.toBeInstanceOf(ConflictException);
  });

  it('não entrega briefing de publicação pendente com licença vencida', async () => {
    const { service, draft } = setup();
    const pub = await draft({ mediaAssetId: MEDIA_EXPIRING });
    await expect(service.exportBriefing(pub.id, new Date('2026-12-02T00:00:00Z'))).rejects.toThrow(/licença vencida/);
  });

  it('publicação já publicada continua exportável como registro histórico', async () => {
    const { service, draft } = setup();
    const pub = await draft({ mediaAssetId: MEDIA_EXPIRING, status: 'PUBLISHED_MANUALLY' });
    const { content } = await service.exportBriefing(pub.id, new Date('2026-12-02T00:00:00Z'));
    expect(content).toContain('Situação na exportação: EXPIRED');
  });

  it('publicação inexistente responde 404', async () => {
    const { service } = setup();
    await expect(service.exportBriefing('e6f1c1a0-0000-4000-8000-000000000001', NOW)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('preço ausente aparece como "não informado" e nome sem letras vira "produto" no arquivo', () => {
    const input = {
      id: '12345678-0000', status: 'READY', channel: 'SHOPEE_VIDEO', caption: 'c', cta: 'x', shortUrl: SHORT_URL,
      product: { name: '★★★', price: null, productUrl: 'https://shopee.com.br/p' }, media: null,
    };
    expect(buildBriefing(input, NOW)).toContain('Preço: não informado');
    expect(briefingFilename(input)).toBe('briefing-shopee-video-produto-12345678.txt');
  });
});
