import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { ImportOfferDto, ImportProductsDto, ListProductsDto, SearchProductsDto } from './discovery.dto';

// Sobe o controller real atrás de HTTP, com o mesmo prefixo e ValidationPipe global do main.ts.
// Sem decorator metadata (tsx/vitest), o pipe global não enxerga o DTO: quem valida é o parseDto
// chamado dentro do controller. Se essa chamada sumir, estes testes quebram.
const service = { search: vi.fn(), listProducts: vi.fn(), importOffers: vi.fn() };

@Module({ controllers: [DiscoveryController], providers: [{ provide: DiscoveryService, useValue: service }] })
class DiscoveryTestModule {}

let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  app = await NestFactory.create(DiscoveryTestModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(0, '127.0.0.1');
  baseUrl = `${(await app.getUrl()).replace('[::1]', '127.0.0.1')}/api/v1/products`;
});

afterAll(async () => { await app?.close(); });

beforeEach(() => {
  for (const fn of Object.values(service)) fn.mockReset().mockResolvedValue({ data: 'ok' });
});

const get = async (path: string) => {
  const res = await fetch(`${baseUrl}${path}`);
  return { status: res.status, body: await res.json() };
};
const post = async (path: string, payload: unknown) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json() };
};
const messages = (body: { message: unknown }) => ([] as unknown[]).concat(body.message).join(' | ');

describe('GET /products/search', () => {
  it('query inválida responde 400 dizendo o campo e não chama o service', async () => {
    const { status, body } = await get('/search?keyword=ab');
    expect(status).toBe(400);
    expect(messages(body)).toMatch(/keyword/);
    expect(service.search).not.toHaveBeenCalled();
  });

  it('sem keyword responde 400', async () => {
    const { status, body } = await get('/search');
    expect(status).toBe(400);
    expect(messages(body)).toMatch(/keyword/);
    expect(service.search).not.toHaveBeenCalled();
  });

  it('número fora dos limites ou vazio responde 400 nomeando cada campo', async () => {
    const { status, body } = await get('/search?keyword=organizador&limit=51&minPrice=&minRating=6');
    expect(status).toBe(400);
    expect(messages(body)).toMatch(/limit/);
    expect(messages(body)).toMatch(/minPrice/);
    expect(messages(body)).toMatch(/minRating/);
    expect(service.search).not.toHaveBeenCalled();
  });

  it('parâmetro desconhecido responde 400', async () => {
    const { status, body } = await get('/search?keyword=organizador&categoria=cozinha');
    expect(status).toBe(400);
    expect(messages(body)).toMatch(/categoria/);
    expect(service.search).not.toHaveBeenCalled();
  });

  it('query válida chega ao service como SearchProductsDto com números e keyword aparada', async () => {
    const { status, body } = await get('/search?keyword=%20%20organizador%20de%20gaveta%20%20&minCommissionPercent=12.5&page=2&limit=10&minPrice=9.9&maxPrice=50&minRating=4');
    expect(status).toBe(200);
    expect(body).toEqual({ data: 'ok' });
    expect(service.search).toHaveBeenCalledTimes(1);
    const dto = service.search.mock.calls[0][0];
    expect(dto).toBeInstanceOf(SearchProductsDto);
    expect(dto).toEqual(Object.assign(new SearchProductsDto(), {
      keyword: 'organizador de gaveta', minCommissionPercent: 12.5, page: 2, limit: 10, minPrice: 9.9, maxPrice: 50, minRating: 4,
    }));
  });

  it('query válida sem opcionais recebe os defaults numéricos', async () => {
    const { status } = await get('/search?keyword=organizador');
    expect(status).toBe(200);
    const dto = service.search.mock.calls[0][0];
    expect(dto).toBeInstanceOf(SearchProductsDto);
    expect(dto).toMatchObject({ keyword: 'organizador', minCommissionPercent: 8, page: 1, limit: 20 });
    expect(dto.minPrice).toBeUndefined();
  });
});

describe('GET /products', () => {
  it('paginação inválida responde 400 e não chama o service', async () => {
    const { status, body } = await get('?page=0&limit=abc');
    expect(status).toBe(400);
    expect(messages(body)).toMatch(/page/);
    expect(messages(body)).toMatch(/limit/);
    expect(service.listProducts).not.toHaveBeenCalled();
  });

  it('paginação válida chega ao service como ListProductsDto numérico', async () => {
    const { status } = await get('?page=3&limit=50');
    expect(status).toBe(200);
    const dto = service.listProducts.mock.calls[0][0];
    expect(dto).toBeInstanceOf(ListProductsDto);
    expect(dto).toEqual(Object.assign(new ListProductsDto(), { page: 3, limit: 50 }));
  });
});

describe('POST /products/import', () => {
  const offer = {
    marketplace: 'SHOPEE', shopId: '123', itemId: '456', name: 'Organizador de gaveta',
    productUrl: 'https://shopee.com.br/produto-ficticio', price: '29.90', commissionRate: '0.1', sales: 10,
  };

  it('lote vazio ou oferta inválida responde 400 apontando o caminho do erro', async () => {
    const empty = await post('/import', { offers: [] });
    expect(empty.status).toBe(400);
    expect(messages(empty.body)).toMatch(/offers/);

    const invalid = await post('/import', { offers: [{ ...offer, name: '', price: '29,90' }] });
    expect(invalid.status).toBe(400);
    expect(messages(invalid.body)).toMatch(/offers\.0\.name/);
    expect(messages(invalid.body)).toMatch(/offers\.0\.price/);
    expect(service.importOffers).not.toHaveBeenCalled();
  });

  it('não converte tipos no corpo: sales como string responde 400', async () => {
    const { status, body } = await post('/import', { offers: [{ ...offer, sales: '10' }] });
    expect(status).toBe(400);
    expect(messages(body)).toMatch(/sales/);
    expect(service.importOffers).not.toHaveBeenCalled();
  });

  it('lote válido chega ao service como ImportProductsDto com ofertas instanciadas', async () => {
    const { status } = await post('/import', { offers: [offer] });
    expect(status).toBe(200);
    const dto = service.importOffers.mock.calls[0][0];
    expect(dto).toBeInstanceOf(ImportProductsDto);
    expect(dto.offers[0]).toBeInstanceOf(ImportOfferDto);
    expect(dto.offers[0]).toMatchObject(offer);
  });
});
