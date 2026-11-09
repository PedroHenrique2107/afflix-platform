import { Injectable, BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';

export function signShopeePayload(appId: string, timestamp: string, body: string, secret: string): string {
  return createHash('sha256').update(appId + timestamp + body + secret, 'utf8').digest('hex');
}

@Injectable()
export class ShopeeGraphqlClient {
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
      const result = json as { data?: T; errors?: Array<{ message: string }> };
      if (result.errors?.length) throw new BadGatewayException('Operação GraphQL rejeitada pela Shopee');
      if (!result.data) throw new BadGatewayException('Resposta GraphQL sem dados');
      return result.data;
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Falha de comunicação com Shopee');
    } finally { clearTimeout(timeout); }
  }
}
