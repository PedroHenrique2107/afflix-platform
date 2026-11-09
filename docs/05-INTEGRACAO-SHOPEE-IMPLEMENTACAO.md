# Integração Shopee Affiliate — arquivos importantes de código

## Pré-requisitos

Conta da sócia aprovada como afiliada e autorização para API. A Shopee Affiliate API usa identificadores e credenciais do programa de afiliados, distintos do Partner ID/Key da API para vendedores.

Documentação técnica pública consultada em 07/11/2026: https://www.affiliateshopee.com.br/documentacao (terceiros; confrontar com a área oficial). Portal de afiliados: https://affiliate.shopee.com.br/open_api. A compatibilidade precisa ser **homologada com credenciais efetivas**.

## Ordem de leitura dos arquivos

1. `apps/api/src/modules/shopee/shopee-graphql.client.ts`: request GraphQL por POST, assinatura SHA256 de `appId+timestamp+bodyExato+secret` e header `SHA256 Credential=..., Timestamp=..., Signature=...`.
2. `apps/api/src/modules/shopee/shopee.queries.ts`: `productOfferV2` e `generateShortLink`, com query documentada que deve ser testada na conta.
3. `apps/api/src/modules/discovery/offer-provider.ts`: interface independente de fornecedor.
4. `apps/api/src/modules/discovery/shopee-offer.provider.ts`: mapeamento Shopee→domínio.
5. `apps/api/src/modules/discovery/mock-offer.provider.ts`: dados fictícios.
6. `apps/api/src/modules/discovery/commission.ts`: filtro decimal de 8%.
7. `apps/api/src/modules/discovery/discovery.service.ts`: filtros e resposta normalizada.
8. `apps/api/src/modules/discovery/discovery.controller.ts`: endpoint REST de busca.
9. `apps/api/src/modules/discovery/discovery.module.ts`: seleção entre mock/live por env.
10. `apps/api/src/modules/discovery/commission.spec.ts`: testes de comissão.

## Configuração

Copiar `apps/api/.env.example` para `apps/api/.env`. Sem credenciais, `SHOPEE_MOCK_MODE=true`. Após habilitação e validação da conta, adicionar App ID/Secret e definir false. Segredo nunca deve ir para React, PR, screenshot, commit ou conversa.

## Exemplos GraphQL

```graphql
query SearchOffers($keyword: String!, $page: Int!, $limit: Int!) {
  productOfferV2(keyword: $keyword, listType: 1, sortType: 5, page: $page, limit: $limit) {
    nodes { itemId shopId productName productLink offerLink imageUrl priceMin commissionRate ratingStar }
    pageInfo { page limit hasNextPage }
  }
}
```

```graphql
mutation GenerateLink($input: GenerateShortLinkInput!) {
  generateShortLink(input:$input) { shortLink }
}
```

Confirme `GenerateShortLinkInput`, limites dos `subIds`, quotas e campos disponibilizados antes da mutation real. Campos não permitidos à conta podem produzir `errors` no GraphQL.

## Testes mandatórios antes do live

Assinatura de bytes reais, timeout, 429, 10020 (assinatura inválida), 10035 (sem acesso), respostas `data + errors`, comissão decimal, IDs com mais de 53 bits, geração de short link, atribuição correta no painel da conta, data freshness e idempotência.

## Critério de conclusão

Somente marcar integração real como `done` após teste com token autorizado, logs redigidos e evidência da atribuição; o mock não comprova acesso à API.
