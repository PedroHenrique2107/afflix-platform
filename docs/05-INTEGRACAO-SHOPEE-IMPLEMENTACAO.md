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
    nodes {
      itemId shopId productName productLink offerLink imageUrl
      priceMin priceMax commissionRate commission ratingStar sales
    }
    pageInfo { page limit hasNextPage }
  }
}
```

### Homologação da busca na conta real (SW-4, 20/11/2026)

Executada com `pnpm --filter @afflix/api shopee:homologar` (introspecção + busca de 3 itens; saída sem credencial e com URLs sem query string). Resultado:

- **Query aceita sem ajuste**: os 12 campos acima e os argumentos `listType`/`sortType` existem e são liberados para a conta.
- Assinatura do campo: `productOfferV2(listType: Int, matchId: Int64, keyword: String, sortType: Int, page: Int, limit: Int, itemId: Int64, shopId: Int64, productCatId: Int, isAMSOffer: Boolean, isKeySeller: Boolean): ProductOfferConnectionV2!`.
- `ProductOfferV2` tem 25 campos. Não pedidos hoje (disponíveis para evolução): `price`, `shopName`, `appExistRate`, `appNewRate`, `webExistRate`, `webNewRate`, `sellerCommissionRate`, `shopeeCommissionRate`, `priceDiscountRate`, `periodStartTime`, `periodEndTime`, `productCatIds`, `shopType`.
- Tipos: `itemId`, `shopId`, `sales` são `Int64` (chegam como number JSON); preço, taxas, `commission` e `ratingStar` são `String`.
- **`commissionRate` é fração** (`"0.53"` = 53%). Confirmado com dinheiro: `commission = priceMin × commissionRate` nos 3 itens (ex.: `17.85 × 0.53 = 9.4605`).
- **IDs**: valores reais com ~11 dígitos (ex.: `58255557635`), bem abaixo de 2^53. Por garantia, o provider descarta (com aviso no log) item cujo ID chegue fora do intervalo seguro, em vez de gravar ID corrompido.
- **`ratingStar: "0"`** aparece em produto sem avaliação; o provider mapeia para ausente, não para nota zero.
- `productLink` real: `https://shopee.com.br/product/{shopId}/{itemId}`. `offerLink` já vem como short link `s.shopee.com.br`.

Fixture redigida desta resposta: `apps/api/src/modules/discovery/shopee-offer.provider.spec.ts`.

```graphql
mutation GenerateLink($originUrl: String!, $subIds: [String!]) {
  generateShortLink(input: { originUrl: $originUrl, subIds: $subIds }) { shortLink }
}
```

O schema real **não expõe** o tipo `GenerateShortLinkInput` (erro `10010 Unknown type`, observado em 18/11/2026): monte o input inline com variáveis escalares, como acima. `subIds` é `[String!]` no schema (com `[String]` volta `10010`). Confirme limites dos `subIds`, quotas e campos disponibilizados antes da mutation real. Campos não permitidos à conta podem produzir `errors` no GraphQL.

## Testes mandatórios antes do live

Assinatura de bytes reais, timeout, 429, 10020 (assinatura inválida), 10035 (sem acesso), respostas `data + errors`, comissão decimal, IDs com mais de 53 bits, geração de short link, atribuição correta no painel da conta, data freshness e idempotência.

## Critério de conclusão

Somente marcar integração real como `done` após teste com token autorizado, logs redigidos e evidência da atribuição; o mock não comprova acesso à API.
