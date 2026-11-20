import { Injectable, BadGatewayException, HttpException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { GENERATE_SHORT_LINK_MUTATION } from './shopee.queries';

export function signShopeePayload(appId: string, timestamp: string, body: string, secret: string): string {
  return createHash('sha256').update(appId + timestamp + body + secret, 'utf8').digest('hex');
}

// Hosts aceitos para o shortLink devolvido pela Shopee. s.shopee.com.br confirmado na conta real em 18/11/2026;
// shope.ee e shp.ee mantidos por serem domínios curtos oficiais, ainda não observados.
export const SHOPEE_SHORT_LINK_HOSTS = ['s.shopee.com.br', 'shope.ee', 'shp.ee'];

export type ShortLinkInput = { originUrl: string; subIds: string[] };

// Só aceita https em host da Shopee: o link vai para o banco e para a tela, então nada de URL arbitrária.
export function isAllowedShortLink(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  return url.protocol === 'https:' && !url.username && !url.password && SHOPEE_SHORT_LINK_HOSTS.includes(url.hostname);
}

type GraphqlError = { message?: string; extensions?: { code?: number | string; message?: string } };

// Só código e mensagem do erro: nunca body, header, assinatura ou credencial.
export function describeGraphqlErrors(errors: GraphqlError[]): string {
  return errors
    .map(e => `[${e.extensions?.code ?? 'sem-codigo'}] ${e.extensions?.message ?? e.message ?? 'sem mensagem'}`)
    .join(' | ')
    .slice(0, 500);
}

// Códigos de erro da Shopee Affiliate Open API (vêm em errors[].extensions.code, com HTTP 200).
export const SHOPEE_ERROR = {
  SYSTEM: '10000',      // "System Error" do lado da Shopee: equivalente a 5xx (observado na conta real em 20/11/2026)
  AUTH: '10020',        // assinatura, timestamp ou credencial inválidos
  RATE_LIMIT: '10030',  // limite de chamadas: equivalente ao HTTP 429
  NO_ACCESS: '10035',   // conta sem acesso à Open API
} as const;

export const REQUEST_TIMEOUT_MS = 15000;
export const DEFAULT_MAX_RETRIES = 2;
const MAX_RETRIES_CEILING = 5;
const BACKOFF_BASE_MS = 500;
const BACKOFF_MAX_MS = 8000;
const RETRY_AFTER_MAX_MS = 30000;

// Teto de novas tentativas após a primeira (SHOPEE_MAX_RETRIES). Valor inválido cai no padrão; limitado a 0..5.
export function maxRetriesFromEnv(raw = process.env.SHOPEE_MAX_RETRIES): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_MAX_RETRIES;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return DEFAULT_MAX_RETRIES;
  return Math.min(n, MAX_RETRIES_CEILING);
}

// Backoff exponencial com jitter: 500ms, 1s, 2s... (+ até 250ms), teto de 8s.
export function backoffDelayMs(attempt: number, random = Math.random): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** (attempt - 1), BACKOFF_MAX_MS) + Math.floor(random() * 250);
}

// Retry-After em segundos ou data HTTP. Ausente/ilegível -> undefined (usa o backoff).
export function parseRetryAfterMs(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

const errorCodes = (errors: GraphqlError[]) => errors.map(e => String(e.extensions?.code ?? ''));

// Falha que vale repetir (429, 5xx, timeout, rede, 10030, 10000). Carrega a exceção a devolver se o teto estourar.
class TransientShopeeError extends Error {
  constructor(readonly reason: string, readonly exception: HttpException, readonly retryAfterMs?: number) {
    super(reason);
  }
}

export type ExecuteOptions = {
  // Só para operação idempotente (queries). Mutation nunca: generateShortLink chama sem retry.
  retry?: boolean;
};

@Injectable()
export class ShopeeGraphqlClient {
  private readonly logger = new Logger(ShopeeGraphqlClient.name);
  // Última chamada bem-sucedida à Shopee (RF08). Em memória: volta a null quando a api reinicia.
  private lastSuccessAt: Date | null = null;

  getLastSuccessAt(): Date | null {
    return this.lastSuccessAt;
  }

  // Mutation não é idempotente do lado da Shopee: nunca repetir automaticamente após falha ou timeout (doc 03).
  async generateShortLink(input: ShortLinkInput): Promise<string> {
    const data = await this.execute<{ generateShortLink?: { shortLink?: unknown } | null }>(
      GENERATE_SHORT_LINK_MUTATION,
      { originUrl: input.originUrl, subIds: input.subIds },
    );
    const shortLink = data.generateShortLink?.shortLink;
    if (!isAllowedShortLink(shortLink)) throw new BadGatewayException('Link curto inválido retornado pela Shopee');
    return shortLink;
  }

  async execute<T>(query: string, variables: Record<string, unknown>, options: ExecuteOptions = {}): Promise<T> {
    const appId = process.env.SHOPEE_APP_ID;
    const secret = process.env.SHOPEE_APP_SECRET;
    if (!appId || !secret) throw new ServiceUnavailableException('Integração Shopee não configurada');
    const maxAttempts = options.retry ? 1 + maxRetriesFromEnv() : 1;
    for (let attempt = 1; ; attempt++) {
      try {
        const data = await this.executeOnce<T>(query, variables, appId, secret);
        this.lastSuccessAt = new Date();
        return data;
      } catch (error) {
        if (!(error instanceof TransientShopeeError)) throw error;
        if (attempt >= maxAttempts) throw error.exception;
        const delay = error.retryAfterMs ?? backoffDelayMs(attempt);
        if (delay > RETRY_AFTER_MAX_MS) throw error.exception; // Shopee pediu espera longa demais para segurar a requisição
        this.logger.warn(`Falha transitória na Shopee (${error.reason}); tentativa ${attempt + 1}/${maxAttempts} em ${delay}ms`);
        await this.sleep(delay);
      }
    }
  }

  // Isolado para os testes não esperarem o backoff de verdade.
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async executeOnce<T>(query: string, variables: Record<string, unknown>, appId: string, secret: string): Promise<T> {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ query, variables });
    const signature = signShopeePayload(appId, timestamp, body, secret);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(process.env.SHOPEE_API_URL || 'https://open-api.affiliate.shopee.com.br/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
        },
        body,
        signal: controller.signal,
      });
    } catch {
      // Timeout (abort) ou falha de rede. Não loga o erro bruto: pode carregar a requisição.
      const reason = controller.signal.aborted ? 'timeout' : 'falha de rede';
      throw new TransientShopeeError(reason, new ServiceUnavailableException('Falha de comunicação com Shopee'));
    } finally { clearTimeout(timeout); }

    if (response.status === 429) {
      throw new TransientShopeeError('HTTP 429', new ServiceUnavailableException('Limite de chamadas da Shopee atingido'),
        parseRetryAfterMs(response.headers.get('retry-after')));
    }
    if (response.status >= 500) {
      throw new TransientShopeeError(`HTTP ${response.status}`, new BadGatewayException(`Shopee HTTP ${response.status}`));
    }
    if (!response.ok) throw new BadGatewayException(`Shopee HTTP ${response.status}`);

    let json: unknown;
    try { json = await response.json(); } catch { throw new BadGatewayException('Resposta inválida da Shopee'); }
    if (!json || typeof json !== 'object') throw new BadGatewayException('Resposta inválida da Shopee');
    const result = json as { data?: T; errors?: GraphqlError[] };
    if (result.errors?.length) {
      // Diagnóstico no log da api; a resposta HTTP só diz a categoria, nunca detalhe de credencial.
      this.logger.warn(`Shopee rejeitou a operação GraphQL: ${describeGraphqlErrors(result.errors)}`);
      const codes = errorCodes(result.errors);
      if (codes.includes(SHOPEE_ERROR.AUTH)) throw new BadGatewayException('Falha de autenticação com a Shopee');
      if (codes.includes(SHOPEE_ERROR.NO_ACCESS)) throw new BadGatewayException('Conta sem acesso à API da Shopee');
      if (codes.includes(SHOPEE_ERROR.RATE_LIMIT)) {
        throw new TransientShopeeError('código 10030', new ServiceUnavailableException('Limite de chamadas da Shopee atingido'));
      }
      if (codes.includes(SHOPEE_ERROR.SYSTEM)) {
        throw new TransientShopeeError('código 10000', new BadGatewayException('Shopee indisponível no momento'));
      }
      // data + errors juntos também é falha: dado parcial não entra como resultado válido.
      throw new BadGatewayException('Operação GraphQL rejeitada pela Shopee');
    }
    if (!result.data) throw new BadGatewayException('Resposta GraphQL sem dados');
    return result.data;
  }
}
