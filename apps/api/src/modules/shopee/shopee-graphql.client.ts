import { Injectable, BadGatewayException, Logger, ServiceUnavailableException } from '@nestjs/common';
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

@Injectable()
export class ShopeeGraphqlClient {
  private readonly logger = new Logger(ShopeeGraphqlClient.name);

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

  async execute<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const appId = process.env.SHOPEE_APP_ID;
    const secret = process.env.SHOPEE_APP_SECRET;
    if (!appId || !secret) throw new ServiceUnavailableException('Integração Shopee não configurada');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ query, variables });
    const signature = signShopeePayload(appId, timestamp, body, secret);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(process.env.SHOPEE_API_URL || 'https://open-api.affiliate.shopee.com.br/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
        },
        body,
        signal: controller.signal,
      });
      if (response.status === 429) throw new ServiceUnavailableException('Limite de chamadas da Shopee atingido');
      if (!response.ok) throw new BadGatewayException(`Shopee HTTP ${response.status}`);
      const json: unknown = await response.json();
      if (!json || typeof json !== 'object') throw new BadGatewayException('Resposta inválida da Shopee');
      const result = json as { data?: T; errors?: GraphqlError[] };
      if (result.errors?.length) {
        // Diagnóstico no log da api (10020 assinatura, 10035 sem acesso etc.); a resposta HTTP segue genérica.
        this.logger.warn(`Shopee rejeitou a operação GraphQL: ${describeGraphqlErrors(result.errors)}`);
        throw new BadGatewayException('Operação GraphQL rejeitada pela Shopee');
      }
      if (!result.data) throw new BadGatewayException('Resposta GraphQL sem dados');
      return result.data;
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Falha de comunicação com Shopee');
    } finally { clearTimeout(timeout); }
  }
}
