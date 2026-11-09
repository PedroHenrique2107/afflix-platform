"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopeeGraphqlClient = void 0;
exports.signShopeePayload = signShopeePayload;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
function signShopeePayload(appId, timestamp, body, secret) {
    return (0, node_crypto_1.createHash)('sha256').update(appId + timestamp + body + secret, 'utf8').digest('hex');
}
let ShopeeGraphqlClient = class ShopeeGraphqlClient {
    async execute(query, variables) {
        const appId = process.env.SHOPEE_APP_ID;
        const secret = process.env.SHOPEE_APP_SECRET;
        if (!appId || !secret)
            throw new common_1.ServiceUnavailableException('Integração Shopee não configurada');
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
            if (response.status === 429)
                throw new common_1.ServiceUnavailableException('Limite de chamadas da Shopee atingido');
            if (!response.ok)
                throw new common_1.BadGatewayException(`Shopee HTTP ${response.status}`);
            const json = await response.json();
            if (!json || typeof json !== 'object')
                throw new common_1.BadGatewayException('Resposta inválida da Shopee');
            const result = json;
            if (result.errors?.length)
                throw new common_1.BadGatewayException('Operação GraphQL rejeitada pela Shopee');
            if (!result.data)
                throw new common_1.BadGatewayException('Resposta GraphQL sem dados');
            return result.data;
        }
        catch (error) {
            if (error instanceof common_1.BadGatewayException || error instanceof common_1.ServiceUnavailableException)
                throw error;
            throw new common_1.ServiceUnavailableException('Falha de comunicação com Shopee');
        }
        finally {
            clearTimeout(timeout);
        }
    }
};
exports.ShopeeGraphqlClient = ShopeeGraphqlClient;
exports.ShopeeGraphqlClient = ShopeeGraphqlClient = __decorate([
    (0, common_1.Injectable)()
], ShopeeGraphqlClient);
//# sourceMappingURL=shopee-graphql.client.js.map