import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DiscoveryService } from './discovery.service';
import { MockOfferProvider } from './mock-offer.provider';
import { ImportProductsDto, ListProductsDto, SearchProductsDto } from './discovery.dto';
import { createFakePrisma } from './fake-prisma';
import type { Offer } from './offer-provider';

const newService = (options?: Parameters<typeof createFakePrisma>[0]) => {
  const fake = createFakePrisma(options);
  return { ...fake, service: new DiscoveryService(new MockOfferProvider(), fake.prisma) };
};
const query = (overrides: Partial<SearchProductsDto> = {}): SearchProductsDto =>
  Object.assign(new SearchProductsDto(), { keyword: 'organizador de cozinha', ...overrides });
const importDto = (...offers: Offer[]) => Object.assign(new ImportProductsDto(), { offers });
const listDto = (overrides: Partial<ListProductsDto> = {}) => Object.assign(new ListProductsDto(), overrides);
const offer = (n: number, extra: Partial<Offer> = {}): Offer => ({
  marketplace: 'SHOPEE', shopId: '456', itemId: String(n), name: `Produto ${n}`, productUrl: `https://shopee.com.br/product/456/${n}`, ...extra,
});

describe('DiscoveryService (mock)', () => {
  it('filtra ofertas abaixo de 8% e identifica fonte simulada', async () => {
    const result = await newService().service.search(query());
    expect(result.meta.source).toBe('mock');
    expect(result.data.map(p => p.itemId)).toEqual(['123', '125']);
    expect(result.data.every(p => Number(p.commissionPercent) >= 8)).toBe(true);
  });
  it('respeita preço máximo', async () => {
    const result = await newService().service.search(query({ maxPrice: 30 }));
    expect(result.data.map(p => p.itemId)).toEqual(['125']);
  });
  it('rejeita faixa de preço invertida', async () => {
    await expect(newService().service.search(query({ minPrice: 100, maxPrice: 20 }))).rejects.toThrow();
  });
  it('mantém paginação de origem sem inventar resultados', async () => {
    const result = await newService().service.search(query({ limit: 1 }));
    expect(result.data).toHaveLength(1);
    expect(result.meta.hasNextPage).toBe(true);
  });
});

describe('saved na busca', () => {
  it('é false com catálogo vazio e true só para o que foi importado', async () => {
    const { service } = newService();
    const before = await service.search(query());
    expect(before.data.every(p => p.saved === false)).toBe(true);

    await service.importOffers(importDto(offer(123, { shopId: '456', commissionRate: '0.080000' })));
    const after = await service.search(query());
    expect(after.data.map(p => [p.itemId, p.saved])).toEqual([['123', true], ['125', false]]);
  });

  it('devolve productId do catálogo quando salvo e null quando não', async () => {
    const { service, products } = newService();
    await service.importOffers(importDto(offer(123, { shopId: '456', commissionRate: '0.080000' })));
    const result = await service.search(query());
    expect(result.data.map(p => [p.itemId, p.productId])).toEqual([['123', products[0].id], ['125', null]]);
  });

  it('não derruba a busca se o banco estiver indisponível', async () => {
    const result = await newService({ failFindMany: true }).service.search(query());
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every(p => p.saved === false)).toBe(true);
  });
});

describe('importOffers', () => {
  it('importar a mesma oferta duas vezes gera 1 produto e 2 snapshots', async () => {
    const { service, products, snapshots } = newService();
    const first = await service.importOffers(importDto(offer(1, { price: '10.00', commissionRate: '0.080000' })));
    const second = await service.importOffers(importDto(offer(1, { price: '12.50', commissionRate: '0.100000' })));

    const item = { id: products[0].id, marketplace: 'SHOPEE', shopId: '456', itemId: '1' };
    expect(first.data).toEqual({ created: 1, updated: 0, total: 1, items: [item] });
    expect(second.data).toEqual({ created: 0, updated: 1, total: 1, items: [item] });
    expect(products).toHaveLength(1);
    expect(snapshots).toHaveLength(2);
    expect(snapshots.every(s => s.productId === products[0].id)).toBe(true);
    expect(snapshots.map(s => s.price.toFixed(2))).toEqual(['10.00', '12.50']);
    expect(products[0].price.toFixed(2)).toBe('12.50');
  });

  it('persiste decimais exatos', async () => {
    const { service, products, snapshots } = newService();
    await service.importOffers(importDto(offer(1, { price: '19.99', commissionRate: '0.080000', rating: '4.80' })));
    expect(products[0].commissionRate.toFixed(6)).toBe('0.080000');
    expect(products[0].price.toString()).toBe('19.99');
    expect(snapshots[0].commissionRate.toFixed(6)).toBe('0.080000');
  });

  it('importa oferta sem rating e sem priceMax', async () => {
    const { service, products, snapshots } = newService();
    const result = await service.importOffers(importDto(offer(1, { price: '10.00' })));
    expect(result.data.created).toBe(1);
    expect(products[0].rating).toBeNull();
    expect(products[0].priceMax).toBeNull();
    expect(snapshots[0].commissionRate).toBeNull();
  });

  it('reimportar sem um campo opcional não apaga o valor já salvo', async () => {
    const { service, products } = newService();
    await service.importOffers(importDto(offer(1, { rating: '4.50' })));
    await service.importOffers(importDto(offer(1)));
    expect(products[0].rating.toFixed(2)).toBe('4.50');
  });

  it('mesma oferta repetida no lote conta 1 criada, 1 atualizada e 2 snapshots', async () => {
    const { service, products, snapshots } = newService();
    const result = await service.importOffers(importDto(offer(1), offer(1)));
    expect(result.data).toEqual({ created: 1, updated: 1, total: 2, items: [{ id: products[0].id, marketplace: 'SHOPEE', shopId: '456', itemId: '1' }] });
    expect(products).toHaveLength(1);
    expect(snapshots).toHaveLength(2);
  });

  it('items traz um id por produto distinto do lote', async () => {
    const { service, products } = newService();
    const result = await service.importOffers(importDto(offer(1), offer(2)));
    expect(result.data.items.map(i => i.id)).toEqual(products.map(p => p.id));
  });
});

describe('listProducts', () => {
  it('pagina ordenando por lastSyncedAt desc e ignora arquivados', async () => {
    const { service, products } = newService();
    await service.importOffers(importDto(offer(1), offer(2), offer(3)));
    products[0].lastSyncedAt = new Date('2026-01-01');
    products[1].lastSyncedAt = new Date('2026-03-01');
    products[2].lastSyncedAt = new Date('2026-02-01');
    products.push({ ...products[0], id: 'arq', itemId: '99', isArchived: true, lastSyncedAt: new Date('2027-01-01') });

    const page1 = await service.listProducts(listDto({ page: 1, limit: 2 }));
    expect(page1.data.map(p => p.itemId)).toEqual(['2', '3']);
    expect(page1.meta).toEqual({ page: 1, limit: 2, total: 3, hasNextPage: true });

    const page2 = await service.listProducts(listDto({ page: 2, limit: 2 }));
    expect(page2.data.map(p => p.itemId)).toEqual(['1']);
    expect(page2.meta.hasNextPage).toBe(false);
  });
});

describe('ImportProductsDto', () => {
  const check = async (body: unknown) =>
    validate(plainToInstance(ImportProductsDto, body), { whitelist: true, forbidNonWhitelisted: true });
  const valid = { marketplace: 'SHOPEE', shopId: '1', itemId: '2', name: 'n', productUrl: 'https://shopee.com.br/p/1/2' };

  it('aceita oferta só com campos obrigatórios', async () => {
    expect(await check({ offers: [valid] })).toHaveLength(0);
  });
  it('rejeita lista vazia, lote acima de 50 e campo desconhecido', async () => {
    expect((await check({ offers: [] })).length).toBeGreaterThan(0);
    expect((await check({ offers: Array.from({ length: 51 }, () => valid) })).length).toBeGreaterThan(0);
    expect((await check({ offers: [{ ...valid, id: 'injetado' }] })).length).toBeGreaterThan(0);
  });
  it('rejeita decimal inválido, comissão acima de 100% e URL fora de http(s)', async () => {
    expect((await check({ offers: [{ ...valid, price: '-1' }] })).length).toBeGreaterThan(0);
    expect((await check({ offers: [{ ...valid, price: '1e3' }] })).length).toBeGreaterThan(0);
    expect((await check({ offers: [{ ...valid, commissionRate: '1.5' }] })).length).toBeGreaterThan(0);
    expect((await check({ offers: [{ ...valid, rating: '5.5' }] })).length).toBeGreaterThan(0);
    expect((await check({ offers: [{ ...valid, productUrl: 'javascript:alert(1)' }] })).length).toBeGreaterThan(0);
  });
});
