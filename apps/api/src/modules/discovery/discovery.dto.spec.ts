import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchProductsDto } from './discovery.dto';

describe('SearchProductsDto', () => {
  it('usa os defaults para consulta sem filtros opcionais', async () => {
    const dto = plainToInstance(SearchProductsDto, { keyword: '  organizador de cozinha  ' });
    expect(dto.keyword).toBe('organizador de cozinha');
    expect(dto.minCommissionPercent).toBe(8);
    expect(await validate(dto)).toHaveLength(0);
  });
  it('não transforma campo vazio em preço zero', async () => {
    const dto = plainToInstance(SearchProductsDto, { keyword: 'organizador de cozinha', minPrice: '' });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
  it('rejeita paginação fora dos limites', async () => {
    const dto = plainToInstance(SearchProductsDto, { keyword: 'organizador de cozinha', limit: '51' });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
