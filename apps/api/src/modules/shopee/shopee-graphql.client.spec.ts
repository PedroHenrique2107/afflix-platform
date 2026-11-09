import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { signShopeePayload } from './shopee-graphql.client';
describe('Shopee signing', () => {
  it('assina exatamente os bytes enviados', () => {
    const raw = '{"query":"{ productOfferV2 { nodes { itemId } } }","variables":{}}';
    const expected = createHash('sha256').update('app1700000000' + raw + 'secret').digest('hex');
    expect(signShopeePayload('app','1700000000',raw,'secret')).toBe(expected);
  });
});
