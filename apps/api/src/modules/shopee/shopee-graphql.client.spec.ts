import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { describeGraphqlErrors, isAllowedShortLink, ShopeeGraphqlClient, signShopeePayload } from './shopee-graphql.client';

describe('describeGraphqlErrors', () => {
  it('resume código e mensagem da Shopee', () => {
    expect(describeGraphqlErrors([{ message: 'error', extensions: { code: 10035, message: 'no access' } }]))
      .toBe('[10035] no access');
    expect(describeGraphqlErrors([{ message: 'invalid input' }, {}]))
      .toBe('[sem-codigo] invalid input | [sem-codigo] sem mensagem');
  });
});
describe('Shopee signing', () => {
  it('assina exatamente os bytes enviados', () => {
    const raw = '{"query":"{ productOfferV2 { nodes { itemId } } }","variables":{}}';
    const expected = createHash('sha256').update('app1700000000' + raw + 'secret').digest('hex');
    expect(signShopeePayload('app','1700000000',raw,'secret')).toBe(expected);
  });
});

describe('isAllowedShortLink', () => {
  it('aceita https em host da Shopee', () => {
    expect(isAllowedShortLink('https://s.shopee.com.br/AbC123')).toBe(true);
    expect(isAllowedShortLink('https://shope.ee/xyz')).toBe(true);
  });
  it('recusa http, host de terceiros, credencial embutida e não-string', () => {
    expect(isAllowedShortLink('http://s.shopee.com.br/AbC123')).toBe(false);
    expect(isAllowedShortLink('https://evil.com/s.shopee.com.br')).toBe(false);
    expect(isAllowedShortLink('https://s.shopee.com.br.evil.com/x')).toBe(false);
    expect(isAllowedShortLink('https://user:pass@s.shopee.com.br/x')).toBe(false);
    expect(isAllowedShortLink('javascript:alert(1)')).toBe(false);
    expect(isAllowedShortLink(undefined)).toBe(false);
  });
});

describe('ShopeeGraphqlClient.generateShortLink', () => {
  const client = new ShopeeGraphqlClient();
  const input = { originUrl: 'https://shopee.com.br/produto-i.456.123', subIds: ['instagram', 'natal'] };
  const respond = (status: number, body: unknown) =>
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

  beforeEach(() => {
    vi.stubEnv('SHOPEE_APP_ID', 'app-fake');
    vi.stubEnv('SHOPEE_APP_SECRET', 'secret-fake');
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it('envia a mutation com originUrl e subIds e devolve o shortLink', async () => {
    const fetchMock = respond(200, { data: { generateShortLink: { shortLink: 'https://s.shopee.com.br/AbC123' } } });
    await expect(client.generateShortLink(input)).resolves.toBe('https://s.shopee.com.br/AbC123');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(sent.query).toContain('generateShortLink(input: { originUrl: $originUrl, subIds: $subIds })');
    expect(sent.query).not.toContain('GenerateShortLinkInput'); // tipo inexistente no schema real (erro 10010)
    expect(sent.variables).toEqual({ originUrl: input.originUrl, subIds: input.subIds });
  });

  it('não repete a mutation quando a Shopee falha', async () => {
    const fetchMock = respond(500, {});
    await expect(client.generateShortLink(input)).rejects.toBeInstanceOf(BadGatewayException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('trata errors do GraphQL com HTTP 200 como falha', async () => {
    respond(200, { data: null, errors: [{ message: 'invalid subIds' }] });
    await expect(client.generateShortLink(input)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('recusa resposta sem shortLink ou com link fora da Shopee', async () => {
    respond(200, { data: { generateShortLink: null } });
    await expect(client.generateShortLink(input)).rejects.toBeInstanceOf(BadGatewayException);
    vi.restoreAllMocks();
    respond(200, { data: { generateShortLink: { shortLink: 'https://evil.com/x' } } });
    await expect(client.generateShortLink(input)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('429 vira indisponibilidade', async () => {
    respond(429, {});
    await expect(client.generateShortLink(input)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('sem credenciais não chama a Shopee', async () => {
    vi.stubEnv('SHOPEE_APP_ID', '');
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(client.generateShortLink(input)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
