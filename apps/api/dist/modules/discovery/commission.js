"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.meetsMinimumCommission = meetsMinimumCommission;
const decimal_js_1 = __importDefault(require("decimal.js"));
function meetsMinimumCommission(rawRate, minimumPercent) {
    if (rawRate === undefined)
        return false;
    if (!Number.isFinite(minimumPercent) || minimumPercent < 0 || minimumPercent > 100)
        return false;
    let rate;
    try {
        rate = new decimal_js_1.default(rawRate);
    }
    catch {
        return false;
    }
    if (!rate.isFinite() || rate.lt(0) || rate.gt(1))
        return false;
    return rate.gte(new decimal_js_1.default(minimumPercent).div(100));
}
//# sourceMappingURL=commission.js.map