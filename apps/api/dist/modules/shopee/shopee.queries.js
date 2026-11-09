"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GENERATE_SHORT_LINK_MUTATION = exports.PRODUCT_OFFERS_QUERY = void 0;
// Os campos/argumentos devem ser confirmados pelo schema da conta real.
exports.PRODUCT_OFFERS_QUERY = `
query SearchOffers($keyword: String!, $page: Int!, $limit: Int!) {
  productOfferV2(keyword: $keyword, listType: 1, sortType: 5, page: $page, limit: $limit) {
    nodes {
      itemId shopId productName productLink offerLink imageUrl
      priceMin priceMax commissionRate commission ratingStar sales
    }
    pageInfo { page limit hasNextPage }
  }
}`;
exports.GENERATE_SHORT_LINK_MUTATION = `
mutation GenerateLink($input: GenerateShortLinkInput!) {
  generateShortLink(input: $input) { shortLink }
}`;
//# sourceMappingURL=shopee.queries.js.map