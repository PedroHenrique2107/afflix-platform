# Integração Shopee Affiliate — especificação e validação

## Pré-requisitos
Conta de afiliada aprovada, acesso à Open API habilitado, App ID e Secret sob controle da titular, uso permitido conforme termos. Não compartilhar senha de login, CPF ou Secret em chats, commits ou frontend.

## Estratégia de integração
`ShopeeOfferProvider` abstrai `searchOffers`, `getOffer`, `generateAffiliateLink`, `getConversionReports` (últimos conforme permissões). Implementações `MockShopeeProvider` e `OfficialShopeeProvider` compartilham contrato interno. Mock é padrão até homologação.

## GraphQL
O endpoint e o esquema devem ser **confirmados no portal oficial da conta** antes de habilitar modo real. Referência de endpoint frequentemente documentada: `https://open-api.affiliate.shopee.com.br/graphql`. Operações frequentemente citadas: `productOfferV2` e `generateShortLink`; nomes de argumentos, campos, versão, autorização e formato de assinatura podem variar. Não tratar snippets de terceiros como contrato oficial.

## Assinatura
Implementar assinatura isolada em `shopee-signature.ts`, com testes baseados em vetores oficiais. Uma variante divulgada usa SHA256 de `appId + timestamp + rawBody + secret` e header `SHA256 Credential=..., Timestamp=..., Signature=...`; **não habilitar produção sem confrontar exatamente com documentação vigente e testar na conta autorizada**. Serializar o corpo uma única vez e assinar os mesmos bytes transmitidos.

## Tratamento de dados
IDs do produto e loja como strings; taxa em decimal fracionário validado; moeda BRL; preços em Decimal; URLs sanitizadas; timestamps de coleta; campos ausentes não devem virar zero. Avaliações podem não estar disponíveis em todos os resultados.

## Resiliência
Timeout de 15s, retry exponencial com jitter apenas para falhas transitórias, 429 com respeito a Retry-After, limite de concorrência, logs redigidos, requestId, cache curto e circuit breaker se necessário. Não contornar limites com múltiplas contas.

## Plano de homologação
1. Verificar autorização e documentação disponível para a conta.
2. Confirmar endpoint, schema, query e rate limits.
3. Criar fixtures redigidas de resposta real.
4. Validar assinatura com teste real sem expor Secret.
5. Confirmar semântica `commissionRate`, preços, paginação e links.
6. Validar geração de shortlink/subIds e atribuição.
7. Documentar evidências, versão e data.

## Limites
API de afiliados não implica API de publicação em Shopee Video. Publicação manual permanece na V1.
