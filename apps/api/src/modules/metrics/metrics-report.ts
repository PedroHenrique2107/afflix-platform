import { Prisma } from '@prisma/client';
import type { PublicationMetric } from '@prisma/client';
import { METRIC_KINDS, METRIC_MONEY_KINDS, METRIC_SOURCES } from '@afflix/shared';
import type {
  AffiliateChannel, MetricKind, MetricsReportCell, MetricsReportGroup, MetricsReportGroupBy, MetricSource,
  PublicationMetricView, PublicationStatus,
} from '@afflix/shared';

export const METRIC_PUBLICATION_SELECT = {
  id: true, channel: true, status: true, externalUrl: true, publishedAt: true,
  product: { select: { id: true, name: true } },
} as const;

export type MetricWithPublication = PublicationMetric & {
  publication: {
    id: string; channel: string; status: string; externalUrl: string | null; publishedAt: Date | null;
    product: { id: string; name: string };
  };
};

export function formatMetricValue(kind: MetricKind, value: Prisma.Decimal | string): string {
  return new Prisma.Decimal(value).toFixed(METRIC_MONEY_KINDS.includes(kind) ? 2 : 0);
}

export function serializeMetric(m: PublicationMetric): PublicationMetricView {
  const kind = m.kind as MetricKind;
  return {
    id: m.id,
    publicationId: m.publicationId,
    kind,
    value: formatMetricValue(kind, m.value),
    source: m.source as MetricSource,
    sourceReference: m.sourceReference,
    observedAt: m.observedAt.toISOString(),
    createdAt: m.createdAt.toISOString(),
  };
}

// Mais recente primeiro; empate na observação desempata pelo registro mais novo (correção do operador).
const newer = (a: PublicationMetric, b: PublicationMetric) =>
  b.observedAt.getTime() - a.observedAt.getTime() || b.createdAt.getTime() - a.createdAt.getTime();

// Cada registro é um acumulado: vale o último por publicação + métrica + fonte. Somar o histórico contaria em dobro.
// Manual e relatório oficial ficam em células separadas e nunca se somam.
export function buildMetricsReport(rows: MetricWithPublication[], groupBy: MetricsReportGroupBy): MetricsReportGroup[] {
  const latest = new Map<string, MetricWithPublication>();
  for (const row of [...rows].sort(newer)) {
    const key = `${row.publicationId}|${row.kind}|${row.source}`;
    if (!latest.has(key)) latest.set(key, row);
  }

  type Acc = { group: MetricsReportGroup; cells: Map<string, { sum: Prisma.Decimal; rows: MetricWithPublication[] }> };
  const groups = new Map<string, Acc>();
  for (const row of latest.values()) {
    const p = row.publication;
    const groupKey = groupBy === 'publication' ? p.id : p.product.id;
    let acc = groups.get(groupKey);
    if (!acc) {
      acc = {
        group: {
          product: { id: p.product.id, name: p.product.name },
          publication: groupBy === 'publication'
            ? {
                id: p.id, channel: p.channel as AffiliateChannel, status: p.status as PublicationStatus,
                externalUrl: p.externalUrl, publishedAt: p.publishedAt?.toISOString() ?? null,
              }
            : null,
          metrics: [],
        },
        cells: new Map(),
      };
      groups.set(groupKey, acc);
    }
    const cellKey = `${row.kind}|${row.source}`;
    const cell = acc.cells.get(cellKey) ?? { sum: new Prisma.Decimal(0), rows: [] };
    cell.sum = cell.sum.plus(row.value);
    cell.rows.push(row);
    acc.cells.set(cellKey, cell);
  }

  const result: MetricsReportGroup[] = [];
  for (const { group, cells } of groups.values()) {
    for (const kind of METRIC_KINDS) {
      for (const source of METRIC_SOURCES) {
        const cell = cells.get(`${kind}|${source}`);
        if (!cell) continue;
        const times = cell.rows.map(r => r.observedAt.getTime());
        const metric: MetricsReportCell = {
          kind,
          source,
          value: formatMetricValue(kind, cell.sum),
          publicationCount: cell.rows.length,
          observedAt: new Date(Math.max(...times)).toISOString(),
          oldestObservedAt: new Date(Math.min(...times)).toISOString(),
          sourceReferences: [...new Set(cell.rows.map(r => r.sourceReference))].sort(),
        };
        group.metrics.push(metric);
      }
    }
    result.push(group);
  }

  // Por publicação: mais recente primeiro. Por produto: ordem alfabética.
  return result.sort((a, b) =>
    groupBy === 'publication'
      ? (b.publication?.publishedAt ?? '').localeCompare(a.publication?.publishedAt ?? '') || a.product.name.localeCompare(b.product.name)
      : a.product.name.localeCompare(b.product.name, 'pt-BR'));
}
