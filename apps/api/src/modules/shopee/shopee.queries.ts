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

export const GENERATE_SHORT_LINK_MUTATION = `
mutation GenerateLink($input: GenerateShortLinkInput!) {
  generateShortLink(input: $input) { shortLink }
}`;
