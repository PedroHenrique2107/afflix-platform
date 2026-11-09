"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopeeOfferProvider = void 0;
const common_1 = require("@nestjs/common");
const shopee_graphql_client_1 = require("../shopee/shopee-graphql.client");
const shopee_queries_1 = require("../shopee/shopee.queries");
const textOrUndefined = (x) => x == null ? undefined : String(x);
let ShopeeOfferProvider = class ShopeeOfferProvider {
    constructor(client) {
        this.client = client;
    }
    async search(params) {
        const data = await this.client.execute(shopee_queries_1.PRODUCT_OFFERS_QUERY, params);
        if (!data.productOfferV2 || !Array.isArray(data.productOfferV2.nodes)) {
            throw new common_1.BadGatewayException('Schema de busca Shopee incompatível');
        }
        const items = data.productOfferV2.nodes.map(n => ({
            marketplace: 'SHOPEE', itemId: String(n.itemId), shopId: String(n.shopId),
            name: n.productName, productUrl: n.productLink,
            offerUrl: n.offerLink ?? undefined, imageUrl: n.imageUrl ?? undefined,
            price: textOrUndefined(n.priceMin), priceMax: textOrUndefined(n.priceMax),
            commissionRate: textOrUndefined(n.commissionRate),
            estimatedCommission: textOrUndefined(n.commission),
            rating: textOrUndefined(n.ratingStar), sales: n.sales ?? undefined,
        }));
        return { items, pageInfo: data.productOfferV2.pageInfo, source: 'shopee' };
    }
};
exports.ShopeeOfferProvider = ShopeeOfferProvider;
exports.ShopeeOfferProvider = ShopeeOfferProvider = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(shopee_graphql_client_1.ShopeeGraphqlClient)),
    __metadata("design:paramtypes", [shopee_graphql_client_1.ShopeeGraphqlClient])
], ShopeeOfferProvider);
//# sourceMappingURL=shopee-offer.provider.js.map