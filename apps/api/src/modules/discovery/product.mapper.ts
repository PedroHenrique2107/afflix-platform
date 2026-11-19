import { Prisma } from '@prisma/client';
import type { Product } from '@prisma/client';
import type { Offer } from './offer-provider';

// Escalas do schema.prisma. Dinheiro e comissão nunca passam por Number.
const SCALE = { money: 2, commissionRate: 6, rating: 2 } as const;

const toDecimal = (value: string | undefined, scale: number): Prisma.Decimal | undefined =>
  value === undefined ? undefined : new Prisma.Decimal(value).toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_UP);

export type ProductKey = { marketplace: Offer['marketplace']; shopId: string; itemId: string };

export const productKey = (o: ProductKey): string => JSON.stringify([o.marketplace, o.shopId, o.itemId]);

// Campo ausente na oferta vira `undefined`: no create o Prisma grava NULL e no update mantém o valor atual.
export function offerToProductData(offer: Offer) {
  const key: ProductKey = { marketplace: offer.marketplace, shopId: offer.shopId, itemId: offer.itemId };
  const fields = {
    name: offer.name,
    productUrl: offer.productUrl,
    offerUrl: offer.offerUrl,
    imageUrl: offer.imageUrl,
    price: toDecimal(offer.price, SCALE.money),
    priceMax: toDecimal(offer.priceMax, SCALE.money),
    commissionRate: toDecimal(offer.commissionRate, SCALE.commissionRate),
    estimatedCommission: toDecimal(offer.estimatedCommission, SCALE.money),
    rating: toDecimal(offer.rating, SCALE.rating),
    sales: offer.sales,
  };
  const now = new Date();
  return {
    key,
    where: { marketplace_shopId_itemId: key } satisfies Prisma.ProductWhereUniqueInput,
    create: { ...key, ...fields, lastSyncedAt: now } satisfies Prisma.ProductCreateInput,
    update: { ...fields, lastSyncedAt: now } satisfies Prisma.ProductUpdateInput,
    snapshot: { price: fields.price, commissionRate: fields.commissionRate },
  };
}

const fixed = (d: Prisma.Decimal | null, scale: number): string | null => (d === null ? null : d.toFixed(scale));

// Decimal serializa sem padding ("0.08"); aqui devolvemos strings na escala do schema ("0.080000").
export function serializeProduct(p: Product) {
  return {
    id: p.id,
    marketplace: p.marketplace,
    shopId: p.shopId,
    itemId: p.itemId,
    name: p.name,
    productUrl: p.productUrl,
    offerUrl: p.offerUrl,
    imageUrl: p.imageUrl,
    price: fixed(p.price, SCALE.money),
    priceMax: fixed(p.priceMax, SCALE.money),
    commissionRate: fixed(p.commissionRate, SCALE.commissionRate),
    commissionPercent: p.commissionRate === null ? null : p.commissionRate.mul(100).toFixed(2),
    estimatedCommission: fixed(p.estimatedCommission, SCALE.money),
    rating: fixed(p.rating, SCALE.rating),
    sales: p.sales,
    lastSyncedAt: p.lastSyncedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
