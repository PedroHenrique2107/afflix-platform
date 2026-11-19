import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

type Row = Record<string, any>;
type UniqueWhere = { marketplace_shopId_itemId: { marketplace: string; shopId: string; itemId: string } };

// Prisma em memória só para testes unitários (a CI não tem banco). Imita o contrato usado pelos services:
// upsert pela unique composta, snapshots, findMany por OR, count, $transaction (callback ou array)
// e AffiliateLink com unique em dedupeKey (lança P2002 como o Prisma real).
export function createFakePrisma(options: { failFindMany?: boolean } = {}) {
  const products: Row[] = [];
  const snapshots: Row[] = [];
  const links: Row[] = [];
  const same = (p: Row, k: UniqueWhere['marketplace_shopId_itemId']) =>
    p.marketplace === k.marketplace && p.shopId === k.shopId && p.itemId === k.itemId;
  const defined = (o: Row) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

  const api: Row = {
    product: {
      async findUnique(args: { where: { id: string } }) {
        return products.find(p => p.id === args.where.id) ?? null;
      },
      async findMany(args: { where?: { OR?: Row[]; isArchived?: boolean }; select?: Row; skip?: number; take?: number }) {
        if (options.failFindMany) throw new Error('banco indisponível');
        let rows = products.filter(p => {
          const w = args.where ?? {};
          if (w.isArchived !== undefined && p.isArchived !== w.isArchived) return false;
          return !w.OR || w.OR.some(k => same(p, k as never));
        });
        rows = [...rows].sort((a, b) => b.lastSyncedAt.getTime() - a.lastSyncedAt.getTime());
        return rows.slice(args.skip ?? 0, args.take === undefined ? undefined : (args.skip ?? 0) + args.take);
      },
      async count(args: { where?: { isArchived?: boolean } }) {
        return products.filter(p => args.where?.isArchived === undefined || p.isArchived === args.where.isArchived).length;
      },
      async upsert(args: { where: UniqueWhere; create: Row; update: Row }) {
        const found = products.find(p => same(p, args.where.marketplace_shopId_itemId));
        if (found) return Object.assign(found, defined(args.update), { updatedAt: new Date() });
        const row = { id: randomUUID(), isArchived: false, createdAt: new Date(), updatedAt: new Date(), ...defined(args.create) };
        const full = { price: null, priceMax: null, commissionRate: null, estimatedCommission: null, rating: null, sales: null, offerUrl: null, imageUrl: null, ...row };
        products.push(full);
        return full;
      },
    },
    priceSnapshot: {
      async create(args: { data: Row }) {
        const row = { id: randomUUID(), observedAt: new Date(), price: null, commissionRate: null, ...defined(args.data) };
        snapshots.push(row);
        return row;
      },
    },
    affiliateLink: {
      async findUnique(args: { where: { dedupeKey: string } }) {
        return links.find(l => l.dedupeKey === args.where.dedupeKey) ?? null;
      },
      async create(args: { data: Row }) {
        if (links.some(l => l.dedupeKey === args.data.dedupeKey)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed on dedupeKey', { code: 'P2002', clientVersion: 'fake' });
        }
        const row = { id: randomUUID(), createdAt: new Date(), campaign: null, ...defined(args.data) };
        links.push(row);
        return row;
      },
    },
    async $transaction(arg: ((tx: Row) => Promise<unknown>) | Promise<unknown>[]) {
      return typeof arg === 'function' ? arg(api) : Promise.all(arg);
    },
  };

  return { prisma: api as unknown as PrismaService, products, snapshots, links };
}
