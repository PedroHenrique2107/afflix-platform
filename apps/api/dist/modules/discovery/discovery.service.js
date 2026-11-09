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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscoveryService = void 0;
const common_1 = require("@nestjs/common");
const decimal_js_1 = __importDefault(require("decimal.js"));
const offer_provider_1 = require("./offer-provider");
const commission_1 = require("./commission");
function within(value, min, max) {
    if (min === undefined && max === undefined)
        return true;
    if (value === undefined)
        return false;
    let d;
    try {
        d = new decimal_js_1.default(value);
    }
    catch {
        return false;
    }
    return d.isFinite() && (min === undefined || d.gte(min)) && (max === undefined || d.lte(max));
}
let DiscoveryService = class DiscoveryService {
    constructor(provider) {
        this.provider = provider;
    }
    async search(dto) {
        if (dto.minPrice !== undefined && dto.maxPrice !== undefined && dto.minPrice > dto.maxPrice) {
            throw new common_1.BadRequestException('minPrice não pode superar maxPrice');
        }
        if (!Number.isInteger(dto.page) || !Number.isInteger(dto.limit) || dto.page < 1 || dto.limit < 1 || dto.limit > 50) {
            throw new common_1.BadRequestException('Paginação inválida');
        }
        const found = await this.provider.search({ keyword: dto.keyword, page: dto.page, limit: dto.limit });
        const data = found.items.filter(p => (0, commission_1.meetsMinimumCommission)(p.commissionRate, dto.minCommissionPercent) &&
            within(p.price, dto.minPrice, dto.maxPrice) &&
            within(p.rating, dto.minRating)).map(p => ({ ...p, commissionPercent: new decimal_js_1.default(p.commissionRate).mul(100).toFixed(2), saved: false }));
        return { data, meta: { ...found.pageInfo, source: found.source } };
    }
};
exports.DiscoveryService = DiscoveryService;
exports.DiscoveryService = DiscoveryService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(offer_provider_1.OFFER_PROVIDER)),
    __metadata("design:paramtypes", [Object])
], DiscoveryService);
//# sourceMappingURL=discovery.service.js.map