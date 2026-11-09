import Decimal from 'decimal.js';

export function meetsMinimumCommission(rawRate: string | undefined, minimumPercent: number): boolean {
  if (rawRate === undefined) return false;
  if (!Number.isFinite(minimumPercent) || minimumPercent < 0 || minimumPercent > 100) return false;
  let rate: Decimal;
  try { rate = new Decimal(rawRate); } catch { return false; }
  if (!rate.isFinite() || rate.lt(0) || rate.gt(1)) return false;
  return rate.gte(new Decimal(minimumPercent).div(100));
}
