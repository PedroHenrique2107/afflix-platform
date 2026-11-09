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
exports.DiscoveryController = void 0;
const common_1 = require("@nestjs/common");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const discovery_service_1 = require("./discovery.service");
const discovery_dto_1 = require("./discovery.dto");
let DiscoveryController = class DiscoveryController {
    constructor(service) {
        this.service = service;
    }
    async search(rawQuery) {
        const dto = (0, class_transformer_1.plainToInstance)(discovery_dto_1.SearchProductsDto, rawQuery, { enableImplicitConversion: true });
        const errors = await (0, class_validator_1.validate)(dto, { whitelist: true, forbidNonWhitelisted: true });
        if (errors.length)
            throw new common_1.BadRequestException(errors.flatMap(e => Object.values(e.constraints ?? {})));
        return this.service.search(dto);
    }
};
exports.DiscoveryController = DiscoveryController;
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DiscoveryController.prototype, "search", null);
exports.DiscoveryController = DiscoveryController = __decorate([
    (0, common_1.Controller)('products'),
    __param(0, (0, common_1.Inject)(discovery_service_1.DiscoveryService)),
    __metadata("design:paramtypes", [discovery_service_1.DiscoveryService])
], DiscoveryController);
//# sourceMappingURL=discovery.controller.js.map