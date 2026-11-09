"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockOfferProvider = void 0;
const common_1 = require("@nestjs/common");
const FIXTURES = [
    { marketplace: 'SHOPEE', shopId: '456', itemId: '123', name: 'Organizador de cozinha (DADO FICTÍCIO)', productUrl: 'https://shopee.com.br/product/456/123', price: '59.90', commissionRate: '0.080000', rating: '4.8' },
    { marketplace: 'SHOPEE', shopId: '456', itemId: '124', name: 'Organizador de armário (DADO FICTÍCIO)', productUrl: 'https://shopee.com.br/product/456/124', price: '39.90', commissionRate: '0.075000', rating: '4.7' },
    { marketplace: 'SHOPEE', shopId: '789', itemId: '125', name: 'Organizador de gavetas (DADO FICTÍCIO)', productUrl: 'https://shopee.com.br/product/789/125', price: '29.90', commissionRate: '0.110000', rating: '4.9' },
];
let MockOfferProvider = class MockOfferProvider {
    async search({ keyword, page, limit }) {
        const words = keyword.toLocaleLowerCase('pt-BR').split(/\s+/).filter(Boolean);
        const matched = FIXTURES.filter(item => words.some(word => item.name.toLocaleLowerCase('pt-BR').includes(word)));
        const offset = (page - 1) * limit;
        return { items: matched.slice(offset, offset + limit), pageInfo: { page, limit, hasNextPage: offset + limit < matched.length }, source: 'mock' };
    }
};
exports.MockOfferProvider = MockOfferProvider;
exports.MockOfferProvider = MockOfferProvider = __decorate([
    (0, common_1.Injectable)()
], MockOfferProvider);
//# sourceMappingURL=mock-offer.provider.js.map