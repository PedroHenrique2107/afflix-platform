import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadGatewayException, Logger } from '@nestjs/common';
import { ShopeeGraphqlClient } from '../shopee/shopee-graphql.client';
import { PRODUCT_OFFERS_QUERY } from '../shopee/shopee.queries';
import { safeShopeeId, ShopeeOfferProvider, shopeeNodeToOffer } from './shopee-offer.provider';

// Fixture da resposta real de productOfferV2 (homologação SW-4, 20/11/2026, keyword "organizador de cozinha").
// offerLink trocado por link fictício: o short link real carrega a atribuição da conta.
const REAL_RESPONSE = {
  productOfferV2: {
    nodes: [
      { itemId: 58255557635, shopId: 736567489, productName: 'Porta Filtro Café 102 e 103 Suporte Moderno para Coador de Papel Organizador Dec',
        productLink: 'https://shopee.com.br/product/736567489/58255557635', offerLink: 'https://s.shopee.com.br/FICTICIO1',
        imageUrl: 'https://cf.shopee.com.br/file/br-11134207-81ztm-mkylnpk41xj55f',
        priceMin: '17.85', priceMax: '17.85', commissionRate: '0.53', commission: '9.4605', ratingStar: '5', sales: 0 },
      { itemId: 23498464792, shopId: 1242226486, productName: 'Carrinho Organizador De Aço Multiuso 3 Prateleiras Premium Rodízio 360º Cozinha ',
        productLink: 'https://shopee.com.br/product/1242226486/23498464792', offerLink: 'https://s.shopee.com.br/FICTICIO2',
        imageUrl: 'https://cf.shopee.com.br/file/sg-11134201-7rffd-m9hn0dh7ck0pdf',
        priceMin: '137.99', priceMax: '137.99', commissionRate: '0.44', commission: '60.7156', ratingStar: '4.8', sales: 128 },
      { itemId: 23394742751, shopId: 826099347, productName: 'Kit Potes Coloridos Multiuso 3 5 10 20 Unidades Plástico Festa Doces Salgados Le',
        productLink: 'https://shopee.com.br/product/826099347/23394742751', offerLink: 'https://s.shopee.com.br/FICTICIO3',
        imageUrl: 'https://cf.shopee.com.br/file/br-11134207-820mc-ms7i4c777k05b2',
        priceMin: '11.78', priceMax: '29.89', commissionRate: '0.4', commission: '4.712', ratingStar: '0', sales: 1 },
    ],
    pageInfo: { page: 1, limit: 3, hasNextPage: true },
  },
};

function providerReturning(data: unknown) {
  const client = { execute: vi.fn().mockResolvedValue(data) } as unknown as ShopeeGraphqlClient;
  return { provider: new ShopeeOfferProvider(client), execute: client.execute as ReturnType<typeof vi.fn> };
}

describe('ShopeeOfferProvider (fixture da conta real)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mapeia a resposta real para o domínio', async () => {
    const { provider } = providerReturning(REAL_RESPONSE);
    const result = await provider.search({ keyword: 'organizador de cozinha', page: 1, limit: 3 });
    expect(result.source).toBe('shopee');
    expect(result.pageInfo).toEqual({ page: 1, limit: 3, hasNextPage: true });
    expect(result.items[1]).toEqual({
      marketplace: 'SHOPEE', itemId: '23498464792', shopId: '1242226486',
      name: 'Carrinho Organizador De Aço Multiuso 3 Prateleiras Premium Rodízio 360º Cozinha ',
      productUrl: 'https://shopee.com.br/product/1242226486/23498464792', offerUrl: 'https://s.shopee.com.br/FICTICIO2',
      imageUrl: 'https://cf.shopee.com.br/file/sg-11134201-7rffd-m9hn0dh7ck0pdf',
      price: '137.99', priceMax: '137.99', commissionRate: '0.44', estimatedCommission: '60.7156', rating: '4.8', sales: 128,
    });
  });

  it('commissionRate é fração: commission = priceMin × commissionRate em todos os itens reais', async () => {
    const { provider } = providerReturning(REAL_RESPONSE);
    const { items } = await provider.search({ keyword: 'x', page: 1, limit: 3 });
    for (const item of items) {
      expect(Number(item.commissionRate)).toBeLessThanOrEqual(1);
      expect(Number(item.price) * Number(item.commissionRate)).toBeCloseTo(Number(item.estimatedCommission), 4);
    }
  });

  it('ratingStar "0" vira sem avaliação', async () => {
    const { provider } = providerReturning(REAL_RESPONSE);
    const { items } = await provider.search({ keyword: 'x', page: 1, limit: 3 });
    expect(items.map(i => i.rating)).toEqual(['5', '4.8', undefined]);
  });

  it('busca com retry ligado (query idempotente)', async () => {
    const { provider, execute } = providerReturning(REAL_RESPONSE);
    await provider.search({ keyword: 'organizador', page: 2, limit: 10 });
    expect(execute).toHaveBeenCalledWith(PRODUCT_OFFERS_QUERY, { keyword: 'organizador', page: 2, limit: 10 }, { retry: true });
  });

  it('descarta item com ID acima de 2^53 em vez de gravar ID corrompido', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const nodes = [{ ...REAL_RESPONSE.productOfferV2.nodes[0], itemId: 2 ** 53 + 2 }, REAL_RESPONSE.productOfferV2.nodes[1]];
    const { provider } = providerReturning({ productOfferV2: { ...REAL_RESPONSE.productOfferV2, nodes } });
    const { items } = await provider.search({ keyword: 'x', page: 1, limit: 3 });
    expect(items.map(i => i.itemId)).toEqual(['23498464792']);
  });

  it('schema incompatível vira 502', async () => {
    const { provider } = providerReturning({ productOfferV2: null });
    await expect(provider.search({ keyword: 'x', page: 1, limit: 3 })).rejects.toBeInstanceOf(BadGatewayException);
  });
});

describe('safeShopeeId', () => {
  it('aceita inteiro seguro positivo, number ou string de dígitos', () => {
    expect(safeShopeeId(58255557635)).toBe('58255557635');
    expect(safeShopeeId('58255557635')).toBe('58255557635');
    expect(safeShopeeId('9007199254740993')).toBe('9007199254740993'); // string preserva precisão
  });
  it('recusa number inseguro, zero, negativo, fração e lixo', () => {
    for (const bad of [2 ** 53 + 2, 0, -1, 1.5, NaN, '', '0', '-1', '12a', '1.5']) expect(safeShopeeId(bad)).toBeUndefined();
  });
  it('shopeeNodeToOffer devolve undefined quando o ID é inseguro', () => {
    expect(shopeeNodeToOffer({ ...REAL_RESPONSE.productOfferV2.nodes[0], shopId: 2 ** 60 })).toBeUndefined();
  });
});
