import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { BadGatewayException, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  backoffDelayMs, DEFAULT_MAX_RETRIES, describeGraphqlErrors, isAllowedShortLink, maxRetriesFromEnv,
  parseRetryAfterMs, REQUEST_TIMEOUT_MS, ShopeeGraphqlClient, signShopeePayload,
} from './shopee-graphql.client';

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

// Credenciais fake com padrão reconhecível: nenhum teste pode achar isso em mensagem ou log.
const FAKE_APP_ID = 'app-id-fake-123';
const FAKE_SECRET = 'secret-fake-456';
const QUERY = 'query Q { productOfferV2 { nodes { itemId } } }';

class TestClient extends ShopeeGraphqlClient {
  readonly sleeps: number[] = [];
  protected override sleep(ms: number): Promise<void> { this.sleeps.push(ms); return Promise.resolve(); }
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const gqlError = (code: number, message: string) => ({ data: null, errors: [{ message: 'error', extensions: { code, message } }] });
const ok = { data: { productOfferV2: { nodes: [] } } };

function expectNoCredential(text: string) {
  expect(text).not.toContain(FAKE_APP_ID);
  expect(text).not.toContain(FAKE_SECRET);
  expect(text).not.toMatch(/Signature=|Credential=/);
}

async function captureError(promise: Promise<unknown>): Promise<Error> {
  try { await promise; } catch (error) { return error as Error; }
  throw new Error('esperava falha');
}

describe('ShopeeGraphqlClient.execute — erros mandatórios (doc 05)', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.stubEnv('SHOPEE_APP_ID', FAKE_APP_ID);
    vi.stubEnv('SHOPEE_APP_SECRET', FAKE_SECRET);
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });

  const loggedText = () => warn.mock.calls.map(c => c.join(' ')).join('\n');

  it('10020 (assinatura inválida) vira 502 sem detalhe de credencial', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, gqlError(10020, `Invalid Signature for ${FAKE_APP_ID}`)));
    const error = await captureError(new TestClient().execute(QUERY, {}));
    expect(error).toBeInstanceOf(BadGatewayException);
    expect(error.message).toBe('Falha de autenticação com a Shopee');
    expectNoCredential(JSON.stringify((error as BadGatewayException).getResponse()));
  });

  it('10035 (conta sem acesso) vira 502 com mensagem própria', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, gqlError(10035, 'no access')));
    const error = await captureError(new TestClient().execute(QUERY, {}));
    expect(error).toBeInstanceOf(BadGatewayException);
    expect(error.message).toBe('Conta sem acesso à API da Shopee');
  });

  it('HTTP 429 vira 503 de limite de chamadas', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(429, {}));
    const error = await captureError(new TestClient().execute(QUERY, {}));
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.message).toBe('Limite de chamadas da Shopee atingido');
  });

  it('data + errors na mesma resposta é falha, não resultado parcial', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, {
      data: { productOfferV2: { nodes: [{ itemId: 1 }] } },
      errors: [{ message: 'Cannot query field "commission"', extensions: { code: 10010 } }],
    }));
    const error = await captureError(new TestClient().execute(QUERY, {}));
    expect(error).toBeInstanceOf(BadGatewayException);
    expect(error.message).toBe('Operação GraphQL rejeitada pela Shopee');
  });

  it('timeout de 15s aborta e vira 503', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const pending = captureError(new TestClient().execute(QUERY, {}));
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    const error = await pending;
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.message).toBe('Falha de comunicação com Shopee');
  });

  it('envia a credencial só no header Authorization, nunca no body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, ok));
    await new TestClient().execute(QUERY, { keyword: 'x' });
    const init = fetchMock.mock.calls[0][1]!;
    expectNoCredential(String(init.body));
    expect((init.headers as Record<string, string>).Authorization)
      .toMatch(/^SHA256 Credential=app-id-fake-123, Timestamp=\d+, Signature=[0-9a-f]{64}$/);
  });

  it('nenhum cenário de erro vaza credencial na mensagem HTTP', async () => {
    const scenarios = [
      json(200, gqlError(10020, `bad sig ${FAKE_SECRET}`)), json(200, gqlError(10035, 'no access')),
      json(429, {}), json(500, {}), json(403, {}), new Response('não é json', { status: 200 }),
    ];
    for (const response of scenarios) {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response);
      const error = await captureError(new TestClient().execute(QUERY, {}));
      expectNoCredential(`${error.message} ${JSON.stringify((error as BadGatewayException).getResponse?.())}`);
    }
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error(`connect ECONNREFUSED Credential=${FAKE_APP_ID}`));
    const network = await captureError(new TestClient().execute(QUERY, {}));
    expectNoCredential(network.message);
    // O log só repassa código e mensagem que a própria Shopee devolveu; nunca header, assinatura ou erro de rede bruto.
    expect(loggedText()).not.toContain(FAKE_APP_ID);
    expect(loggedText()).not.toMatch(/Signature=|Credential=/);
  });

  it('marca a última chamada bem-sucedida e não marca em falha', async () => {
    const client = new TestClient();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(500, {}));
    await captureError(client.execute(QUERY, {}));
    expect(client.getLastSuccessAt()).toBeNull();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(200, ok));
    await client.execute(QUERY, {});
    expect(client.getLastSuccessAt()).toBeInstanceOf(Date);
  });
});

describe('ShopeeGraphqlClient.execute — retry com backoff (RNF03)', () => {
  beforeEach(() => {
    vi.stubEnv('SHOPEE_APP_ID', FAKE_APP_ID);
    vi.stubEnv('SHOPEE_APP_SECRET', FAKE_SECRET);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it('repete 429, 5xx e falha de rede até dar certo', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(503, {}))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(json(200, ok));
    const client = new TestClient();
    await expect(client.execute(QUERY, {}, { retry: true })).resolves.toEqual(ok.data);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(client.sleeps).toHaveLength(2);
  });

  it('para no teto de SHOPEE_MAX_RETRIES e devolve o erro da última tentativa', async () => {
    vi.stubEnv('SHOPEE_MAX_RETRIES', '3');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(500, {}));
    await expect(new TestClient().execute(QUERY, {}, { retry: true })).rejects.toBeInstanceOf(BadGatewayException);
    expect(fetchMock).toHaveBeenCalledTimes(4); // 1 + 3 retries
  });

  it('SHOPEE_MAX_RETRIES=0 desliga o retry', async () => {
    vi.stubEnv('SHOPEE_MAX_RETRIES', '0');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(429, {}));
    await expect(new TestClient().execute(QUERY, {}, { retry: true })).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['10020 (autenticação)', () => json(200, gqlError(10020, 'Invalid Signature'))],
    ['10035 (sem acesso)', () => json(200, gqlError(10035, 'no access'))],
    ['HTTP 403', () => json(403, {})],
    ['erro de schema', () => json(200, gqlError(10010, 'Cannot query field'))],
  ])('nunca repete %s', async (_name, response) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response());
    await expect(new TestClient().execute(QUERY, {}, { retry: true })).rejects.toBeInstanceOf(BadGatewayException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('10030 (limite da Shopee via GraphQL) é tratado como 429', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(200, gqlError(10030, 'rate limit')))
      .mockResolvedValueOnce(json(200, ok));
    await expect(new TestClient().execute(QUERY, {}, { retry: true })).resolves.toEqual(ok.data);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('10000 (System Error da Shopee, visto na conta real) é repetido como 5xx', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(200, gqlError(10000, 'System Error')))
      .mockResolvedValueOnce(json(200, ok));
    await expect(new TestClient().execute(QUERY, {}, { retry: true })).resolves.toEqual(ok.data);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('10000 persistente esgota o teto e vira 502 "Shopee indisponível"', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(200, gqlError(10000, 'System Error')));
    const error = await captureError(new TestClient().execute(QUERY, {}, { retry: true }));
    expect(error).toBeInstanceOf(BadGatewayException);
    expect(error.message).toBe('Shopee indisponível no momento');
    expect(fetchMock).toHaveBeenCalledTimes(1 + DEFAULT_MAX_RETRIES);
  });

  it('respeita Retry-After do 429', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(429, {}, { 'Retry-After': '2' }))
      .mockResolvedValueOnce(json(200, ok));
    const client = new TestClient();
    await client.execute(QUERY, {}, { retry: true });
    expect(client.sleeps).toEqual([2000]);
  });

  it('desiste sem esperar quando Retry-After passa de 30s', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(429, {}, { 'Retry-After': '120' }));
    const client = new TestClient();
    await expect(client.execute(QUERY, {}, { retry: true })).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(client.sleeps).toEqual([]);
  });

  it('sem retry: true (padrão) não repete nem falha transitória', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(503, {}));
    await expect(new TestClient().execute(QUERY, {})).rejects.toBeInstanceOf(BadGatewayException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('generateShortLink nunca repete, mesmo em falha transitória', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(503, {}));
    await expect(new TestClient().generateShortLink({ originUrl: 'https://shopee.com.br/p-i.1.2', subIds: [] }))
      .rejects.toBeInstanceOf(BadGatewayException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('helpers de retry', () => {
  it('maxRetriesFromEnv: padrão, inválido e teto', () => {
    expect(maxRetriesFromEnv(undefined)).toBe(DEFAULT_MAX_RETRIES);
    expect(maxRetriesFromEnv('')).toBe(DEFAULT_MAX_RETRIES);
    expect(maxRetriesFromEnv('abc')).toBe(DEFAULT_MAX_RETRIES);
    expect(maxRetriesFromEnv('-1')).toBe(DEFAULT_MAX_RETRIES);
    expect(maxRetriesFromEnv('1.5')).toBe(DEFAULT_MAX_RETRIES);
    expect(maxRetriesFromEnv('0')).toBe(0);
    expect(maxRetriesFromEnv('99')).toBe(5);
  });

  it('backoffDelayMs cresce exponencialmente com teto', () => {
    const noJitter = () => 0;
    expect([1, 2, 3, 4, 5, 6].map(a => backoffDelayMs(a, noJitter))).toEqual([500, 1000, 2000, 4000, 8000, 8000]);
    expect(backoffDelayMs(1, () => 0.999)).toBe(749);
  });

  it('parseRetryAfterMs aceita segundos e data HTTP', () => {
    expect(parseRetryAfterMs(null)).toBeUndefined();
    expect(parseRetryAfterMs('3')).toBe(3000);
    expect(parseRetryAfterMs('lixo')).toBeUndefined();
    const now = Date.parse('2026-11-20T12:00:00Z');
    expect(parseRetryAfterMs('Fri, 20 Nov 2026 12:00:05 GMT', now)).toBe(5000);
  });
});
