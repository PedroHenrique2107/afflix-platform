import { describe, expect, it, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { createFakePrisma } from '../discovery/fake-prisma';
import { AffiliateLinksService, effectiveSubIds, isAllowedOrigin } from './affiliate-links.service';
import { CreateAffiliateLinkDto } from './affiliate-link.dto';
import { LinkProvider, MockLinkProvider } from './link-provider';

const setup = (provider: LinkProvider = new MockLinkProvider()) => {
  const fake = createFakePrisma();
  const product = { id: 'b6f1c1a0-0000-4000-8000-000000000001', productUrl: 'https://shopee.com.br/product/456/123', isArchived: false };
  fake.products.push(product);
  return { ...fake, product, provider, service: new AffiliateLinksService(provider, fake.prisma) };
};
const dto = (overrides: Partial<CreateAffiliateLinkDto> = {}) =>
  Object.assign(new CreateAffiliateLinkDto(), { productId: 'b6f1c1a0-0000-4000-8000-000000000001', channel: 'INSTAGRAM', ...overrides });

describe('AffiliateLinksService', () => {
  it('gera e persiste o link com produto, canal, campanha e subIds', async () => {
    const { service, links } = setup();
    const result = await service.create(dto({ campaign: 'Natal 2026' }));
    expect(result.meta).toEqual({ reused: false, source: 'mock' });
    expect(result.data).toMatchObject({
      productId: 'b6f1c1a0-0000-4000-8000-000000000001', channel: 'INSTAGRAM', campaign: 'Natal 2026',
      subIds: ['instagram', 'natal2026'],
    });
    expect(result.data.shortUrl).toMatch(/^https:\/\/link-ficticio\.invalid\//);
    expect(links).toHaveLength(1);
  });

  it('não duplica: mesmo produto+canal+campanha devolve o link existente sem chamar o fornecedor de novo', async () => {
    const provider = new MockLinkProvider();
    const spy = vi.spyOn(provider, 'generate');
    const { service, links } = setup(provider);
    const first = await service.create(dto({ campaign: 'natal' }));
    const second = await service.create(dto({ campaign: 'natal' }));
    expect(second.meta.reused).toBe(true);
    expect(second.data.id).toBe(first.data.id);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(links).toHaveLength(1);
  });

  it('canal ou campanha diferentes geram links distintos', async () => {
    const { service, links } = setup();
    await service.create(dto());
    await service.create(dto({ channel: 'TIKTOK' }));
    await service.create(dto({ campaign: 'blackfriday' }));
    expect(links).toHaveLength(3);
  });

  it('em corrida, a segunda requisição devolve o registro vencedor em vez de falhar', async () => {
    const { service, links } = setup();
    const [a, b] = await Promise.all([service.create(dto()), service.create(dto())]);
    expect(links).toHaveLength(1);
    expect(a.data.id).toBe(b.data.id);
    expect([a.meta.reused, b.meta.reused].sort()).toEqual([false, true]);
  });

  it('link do mock não é reaproveitado quando a fonte vira shopee', async () => {
    const { prisma, links } = setup();
    await new AffiliateLinksService(new MockLinkProvider(), prisma).create(dto());
    const live: LinkProvider = { source: 'shopee', generate: async () => 'https://s.shopee.com.br/real1' };
    const result = await new AffiliateLinksService(live, prisma).create(dto());
    expect(result.meta).toEqual({ reused: false, source: 'shopee' });
    expect(links).toHaveLength(2);
  });

  it('subIds explícitos substituem os derivados de canal e campanha', async () => {
    const { service } = setup();
    const result = await service.create(dto({ campaign: 'natal', subIds: ['reel01'] }));
    expect(result.data.subIds).toEqual(['reel01']);
  });

  it('produto inexistente ou arquivado vira 404', async () => {
    const { service, product } = setup();
    await expect(service.create(dto({ productId: 'b6f1c1a0-0000-4000-8000-000000000099' }))).rejects.toBeInstanceOf(NotFoundException);
    product.isArchived = true;
    await expect(service.create(dto())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('origem fora da Shopee vira 409 e não chama o fornecedor', async () => {
    const provider = new MockLinkProvider();
    const spy = vi.spyOn(provider, 'generate');
    const { service, product, links } = setup(provider);
    product.productUrl = 'https://evil.com/produto';
    await expect(service.create(dto())).rejects.toBeInstanceOf(ConflictException);
    expect(spy).not.toHaveBeenCalled();
    expect(links).toHaveLength(0);
  });

  it('falha do fornecedor não grava nada', async () => {
    const failing: LinkProvider = { source: 'shopee', generate: async () => { throw new Error('upstream'); } };
    const { prisma, links } = setup();
    await expect(new AffiliateLinksService(failing, prisma).create(dto())).rejects.toThrow('upstream');
    expect(links).toHaveLength(0);
  });
});

describe('regras de link', () => {
  it('isAllowedOrigin aceita só https da Shopee', () => {
    expect(isAllowedOrigin('https://shopee.com.br/product/1/2')).toBe(true);
    expect(isAllowedOrigin('https://www.shopee.com.br/x')).toBe(true);
    expect(isAllowedOrigin('http://shopee.com.br/x')).toBe(false);
    expect(isAllowedOrigin('https://shopee.com.br.evil.com/x')).toBe(false);
    expect(isAllowedOrigin('não é url')).toBe(false);
  });
  it('effectiveSubIds deriva subIds alfanuméricos de canal e campanha', () => {
    expect(effectiveSubIds({ channel: 'SHOPEE_VIDEO', campaign: 'Promoção de Natal!' })).toEqual(['shopeevideo', 'promocaodenatal']);
    expect(effectiveSubIds({ channel: 'TELEGRAM' })).toEqual(['telegram']);
  });
});

describe('AffiliateLinksService.listByProduct', () => {
  it('lista os links do produto, filtra por canal e não chama o fornecedor', async () => {
    const provider = new MockLinkProvider();
    const spy = vi.spyOn(provider, 'generate');
    const { service } = setup(provider);
    await service.create(dto({ channel: 'INSTAGRAM' }));
    await service.create(dto({ channel: 'TIKTOK' }));
    spy.mockClear();
    const all = await service.listByProduct({ productId: 'b6f1c1a0-0000-4000-8000-000000000001' });
    expect(all.data.map(l => l.channel).sort()).toEqual(['INSTAGRAM', 'TIKTOK']);
    const tiktok = await service.listByProduct({ productId: 'b6f1c1a0-0000-4000-8000-000000000001', channel: 'TIKTOK' });
    expect(tiktok.data).toHaveLength(1);
    expect((await service.listByProduct({ productId: 'b6f1c1a0-0000-4000-8000-0000000000ff' })).data).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});
