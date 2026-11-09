import { describe, expect, it } from 'vitest';
import { DiscoveryService } from './discovery.service';
import { MockOfferProvider } from './mock-offer.provider';
import { SearchProductsDto } from './discovery.dto';

const service = new DiscoveryService(new MockOfferProvider());
const query = (overrides: Partial<SearchProductsDto> = {}): SearchProductsDto =>
  Object.assign(new SearchProductsDto(), { keyword: 'organizador de cozinha', ...overrides });

describe('DiscoveryService (mock)', () => {
  it('filtra ofertas abaixo de 8% e identifica fonte simulada', async () => {
    const result = await service.search(query());
    expect(result.meta.source).toBe('mock');
    expect(result.data.map(p => p.itemId)).toEqual(['123', '125']);
    expect(result.data.every(p => Number(p.commissionPercent) >= 8)).toBe(true);
  });
  it('respeita preço máximo', async () => {
    const result = await service.search(query({ maxPrice: 30 }));
    expect(result.data.map(p => p.itemId)).toEqual(['125']);
  });
  it('rejeita faixa de preço invertida', async () => {
    await expect(service.search(query({ minPrice: 100, maxPrice: 20 }))).rejects.toThrow();
  });
  it('mantém paginação de origem sem inventar resultados', async () => {
    const result = await service.search(query({ limit: 1 }));
    expect(result.data).toHaveLength(1);
    expect(result.meta.hasNextPage).toBe(true);
  });
});
