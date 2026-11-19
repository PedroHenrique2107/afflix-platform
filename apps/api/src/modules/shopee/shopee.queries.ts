// Os campos/argumentos devem ser confirmados pelo schema da conta real.
export const PRODUCT_OFFERS_QUERY = `
query SearchOffers($keyword: String!, $page: Int!, $limit: Int!) {
  productOfferV2(keyword: $keyword, listType: 1, sortType: 5, page: $page, limit: $limit) {
    nodes {
      itemId shopId productName productLink offerLink imageUrl
      priceMin priceMax commissionRate commission ratingStar sales
    }
    pageInfo { page limit hasNextPage }
  }
}`;

// Input montado inline: o schema da Shopee não expõe "GenerateShortLinkInput" (erro 10010 Unknown type,
// observado na conta real em 18/11/2026). Variáveis escalares evitam depender do nome interno do tipo.
// subIds é [String!] no schema real (10010 com [String]).
export const GENERATE_SHORT_LINK_MUTATION = `
mutation GenerateLink($originUrl: String!, $subIds: [String!]) {
  generateShortLink(input: { originUrl: $originUrl, subIds: $subIds }) { shortLink }
}`;
