import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

type Row = Record<string, any>;
type UniqueWhere = { marketplace_shopId_itemId: { marketplace: string; shopId: string; itemId: string } };

// Prisma em memória só para testes unitários (a CI não tem banco). Imita o contrato usado pelos services:
// upsert pela unique composta, snapshots, findMany por OR, count, $transaction (callback ou array)
// AffiliateLink com unique em dedupeKey (lança P2002 como o Prisma real), MediaAsset e Publication
// (include de product/affiliateLink/mediaAsset e updateMany condicional por status) e PublicationMetric
// (findMany com include da publicação e do produto, mais recente primeiro).
export function createFakePrisma(options: { failFindMany?: boolean } = {}) {
  const products: Row[] = [];
  const snapshots: Row[] = [];
  const links: Row[] = [];
  const media: Row[] = [];
  const publications: Row[] = [];
  const metrics: Row[] = [];
  const same = (p: Row, k: UniqueWhere['marketplace_shopId_itemId']) =>
    p.marketplace === k.marketplace && p.shopId === k.shopId && p.itemId === k.itemId;
  const matches = (r: Row, where: Row = {}) => Object.entries(where).every(([k, v]) => v === undefined || r[k] === v);
  const pick = (r: Row | undefined, select?: Row) =>
    !r ? null : select ? Object.fromEntries(Object.keys(select).map(k => [k, r[k]])) : r;
  // include no formato usado pelo PublicationsService: { product: { select }, affiliateLink: { select }, mediaAsset: true }.
  const withRelations = (p: Row, include?: Row) => {
    if (!include) return p;
    const sel = (key: string) => (include[key] === true ? undefined : include[key]?.select);
    return {
      ...p,
      ...(include.product && { product: pick(products.find(x => x.id === p.productId), sel('product')) }),
      ...(include.affiliateLink && { affiliateLink: pick(links.find(x => x.id === p.affiliateLinkId), sel('affiliateLink')) }),
      ...(include.mediaAsset && { mediaAsset: pick(media.find(x => x.id === p.mediaAssetId), sel('mediaAsset')) }),
    };
  };
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
      async findUnique(args: { where: { dedupeKey?: string; id?: string } }) {
        const w = args.where;
        return links.find(l => (w.id === undefined || l.id === w.id) && (w.dedupeKey === undefined || l.dedupeKey === w.dedupeKey)) ?? null;
      },
      async findMany(args: { where?: Row; take?: number }) {
        const rows = links.filter(l => matches(l, args.where)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return rows.slice(0, args.take);
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
    mediaAsset: {
      async findUnique(args: { where: { id: string } }) {
        return media.find(m => m.id === args.where.id) ?? null;
      },
      async findFirst(args: { where: { sha256?: string } }) {
        return media.find(m => args.where.sha256 === undefined || m.sha256 === args.where.sha256) ?? null;
      },
      async findMany(args: { skip?: number; take?: number }) {
        const rows = [...media].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return rows.slice(args.skip ?? 0, args.take === undefined ? undefined : (args.skip ?? 0) + args.take);
      },
      async count() {
        return media.length;
      },
      async create(args: { data: Row }) {
        const row = { id: randomUUID(), createdAt: new Date(), sha256: null, sourceUrl: null, rightsEvidence: null, licenseExpiresAt: null, ...defined(args.data) };
        media.push(row);
        return row;
      },
      async update(args: { where: { id: string }; data: Row }) {
        const found = media.find(m => m.id === args.where.id);
        if (!found) throw new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: 'fake' });
        return Object.assign(found, defined(args.data));
      },
    },
    publication: {
      async findUnique(args: { where: { id: string }; include?: Row }) {
        const row = publications.find(p => p.id === args.where.id);
        return row ? withRelations(row, args.include) : null;
      },
      async findMany(args: { where?: Row; include?: Row; skip?: number; take?: number }) {
        const rows = publications.filter(p => matches(p, args.where)).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        const page = rows.slice(args.skip ?? 0, args.take === undefined ? undefined : (args.skip ?? 0) + args.take);
        return page.map(p => withRelations(p, args.include));
      },
      async count(args: { where?: Row } = {}) {
        return publications.filter(p => matches(p, args.where)).length;
      },
      async create(args: { data: Row; include?: Row }) {
        const now = new Date();
        const row = {
          id: randomUUID(), status: 'DRAFT', caption: null, cta: null, affiliateLinkId: null, mediaAssetId: null,
          externalUrl: null, publishedAt: null, createdAt: now, updatedAt: now, ...defined(args.data),
        };
        publications.push(row);
        return withRelations(row, args.include);
      },
      async update(args: { where: { id: string }; data: Row; include?: Row }) {
        const found = publications.find(p => p.id === args.where.id);
        if (!found) throw new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: 'fake' });
        Object.assign(found, defined(args.data), { updatedAt: new Date() });
        return withRelations(found, args.include);
      },
      async updateMany(args: { where: Row; data: Row }) {
        const hits = publications.filter(p => matches(p, args.where));
        hits.forEach(p => Object.assign(p, defined(args.data), { updatedAt: new Date() }));
        return { count: hits.length };
      },
    },
    publicationMetric: {
      async create(args: { data: Row }) {
        const row = { id: randomUUID(), createdAt: new Date(), ...defined(args.data) };
        metrics.push(row);
        return row;
      },
      // include no formato usado pelo MetricsService: { publication: { select: { ..., product: { select } } } }.
      async findMany(args: { where?: Row; include?: { publication?: { select: Row } } } = {}) {
        const rows = metrics.filter(m => matches(m, args.where))
          .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime() || b.createdAt.getTime() - a.createdAt.getTime());
        const sel = args.include?.publication?.select;
        if (!sel) return rows;
        const { product: productSel, ...own } = sel;
        return rows.map(m => {
          const p = publications.find(x => x.id === m.publicationId)!;
          const product = productSel ? { product: pick(products.find(x => x.id === p.productId), productSel.select) } : {};
          return { ...m, publication: { ...pick(p, own), ...product } };
        });
      },
    },
    async $transaction(arg: ((tx: Row) => Promise<unknown>) | Promise<unknown>[]) {
      return typeof arg === 'function' ? arg(api) : Promise.all(arg);
    },
  };

  return { prisma: api as unknown as PrismaService, products, snapshots, links, media, publications, metrics };
}
