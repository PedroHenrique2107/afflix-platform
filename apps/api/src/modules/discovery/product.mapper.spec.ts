import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { offerToProductData, productKey, serializeProduct } from './product.mapper';
import type { Offer } from './offer-provider';

const base: Offer = {
  marketplace: 'SHOPEE', shopId: '456', itemId: '123', name: 'Organizador', productUrl: 'https://shopee.com.br/product/456/123',
};

describe('offerToProductData', () => {
  it('mantém 0.080000 exato, sem erro de ponto flutuante', () => {
    const { create } = offerToProductData({ ...base, commissionRate: '0.080000' });
    expect(create.commissionRate?.toFixed(6)).toBe('0.080000');
    expect(create.commissionRate?.eq('0.08')).toBe(true);
  });

  it('preserva centavos que float erraria (0.1 + 0.2 e 19.99)', () => {
    const { create } = offerToProductData({ ...base, price: '19.99', estimatedCommission: '0.30' });
    expect(create.price?.toString()).toBe('19.99');
    expect(create.estimatedCommission?.toString()).toBe('0.3');
  });

  it('arredonda para a escala do schema (half-up)', () => {
    const { create } = offerToProductData({ ...base, price: '59.905', rating: '4.555', commissionRate: '0.1234567' });
    expect(create.price?.toFixed(2)).toBe('59.91');
    expect(create.rating?.toFixed(2)).toBe('4.56');
    expect(create.commissionRate?.toFixed(6)).toBe('0.123457');
  });

  it('campos opcionais ausentes ficam undefined (NULL no create, intactos no update)', () => {
    const { create, update, snapshot } = offerToProductData(base);
    for (const field of ['offerUrl', 'imageUrl', 'price', 'priceMax', 'commissionRate', 'estimatedCommission', 'rating', 'sales'] as const) {
      expect(create[field]).toBeUndefined();
      expect(update[field]).toBeUndefined();
    }
    expect(snapshot).toEqual({ price: undefined, commissionRate: undefined });
  });

  it('usa a unique composta como chave do upsert', () => {
    const { where } = offerToProductData(base);
    expect(where).toEqual({ marketplace_shopId_itemId: { marketplace: 'SHOPEE', shopId: '456', itemId: '123' } });
    expect(productKey(base)).toBe('["SHOPEE","456","123"]');
  });
});

describe('serializeProduct', () => {
  it('devolve decimais como string na escala do schema', () => {
    const out = serializeProduct({
      id: 'x', marketplace: 'SHOPEE', shopId: '1', itemId: '2', name: 'n', productUrl: 'u', offerUrl: null, imageUrl: null,
      price: new Prisma.Decimal('59.9'), priceMax: null, commissionRate: new Prisma.Decimal('0.08'),
      estimatedCommission: null, rating: new Prisma.Decimal('4.8'), sales: null,
      lastSyncedAt: new Date(0), isArchived: false, createdAt: new Date(0), updatedAt: new Date(0),
    });
    expect(out.price).toBe('59.90');
    expect(out.commissionRate).toBe('0.080000');
    expect(out.commissionPercent).toBe('8.00');
    expect(out.rating).toBe('4.80');
    expect(out.priceMax).toBeNull();
  });
});
