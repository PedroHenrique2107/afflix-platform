import { describe, expect, it } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { parseDto } from '../../common/parse-dto';
import { createFakePrisma } from '../discovery/fake-prisma';
import { MetricsReportDto, RecordPublicationMetricDto } from './metric.dto';
import { MetricsService } from './metrics.service';

const PRODUCT_A = 'b6f1c1a0-0000-4000-8000-00000000000a';
const PRODUCT_B = 'b6f1c1a0-0000-4000-8000-00000000000b';
const PUB_A1 = 'e6f1c1a0-0000-4000-8000-0000000000a1';
const PUB_A2 = 'e6f1c1a0-0000-4000-8000-0000000000a2';
const PUB_B1 = 'e6f1c1a0-0000-4000-8000-0000000000b1';
const PUB_DRAFT = 'e6f1c1a0-0000-4000-8000-0000000000d0';
const NOW = new Date('2026-11-20T15:00:00.000Z');

const setup = () => {
  const fake = createFakePrisma();
  fake.products.push(
    { id: PRODUCT_A, name: 'Organizador de gaveta', isArchived: false },
    { id: PRODUCT_B, name: 'Escorredor de louça', isArchived: false },
  );
  const pub = (id: string, productId: string, channel: string, publishedAt: Date | null) => ({
    id, productId, channel, status: publishedAt ? 'PUBLISHED_MANUALLY' : 'DRAFT',
    externalUrl: publishedAt ? `https://www.instagram.com/p/${id.slice(-2)}` : null, publishedAt,
    createdAt: new Date('2026-11-01T00:00:00Z'), updatedAt: new Date('2026-11-01T00:00:00Z'),
  });
  fake.publications.push(
    pub(PUB_A1, PRODUCT_A, 'INSTAGRAM', new Date('2026-11-10T18:00:00Z')),
    pub(PUB_A2, PRODUCT_A, 'TIKTOK', new Date('2026-11-12T12:00:00Z')),
    pub(PUB_B1, PRODUCT_B, 'TELEGRAM', new Date('2026-11-15T09:00:00Z')),
    pub(PUB_DRAFT, PRODUCT_A, 'INSTAGRAM', null),
  );
  return { ...fake, service: new MetricsService(fake.prisma) };
};

const base = { kind: 'CLICKS', value: '120', source: 'MANUAL', sourceReference: 'Insights do Instagram', observedAt: '2026-11-18T20:00:00.000Z' };
const dto = (fields: Record<string, unknown> = {}) => parseDto(RecordPublicationMetricDto, { ...base, ...fields }, false);
const record = async (service: MetricsService, pubId: string, fields: Record<string, unknown> = {}) =>
  service.record(pubId, await dto(fields), NOW);

describe('RecordPublicationMetricDto', () => {
  it.each(['kind', 'value', 'source', 'sourceReference', 'observedAt'])('sem %s responde 400', async field => {
    const { [field]: _, ...rest } = base as Record<string, unknown>;
    await expect(parseDto(RecordPublicationMetricDto, rest, false)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('referência só com espaços não identifica origem', async () => {
    await expect(dto({ sourceReference: '   ' })).rejects.toThrow(BadRequestException);
  });

  it('recusa valor negativo, com 3 casas ou que não é número', async () => {
    for (const value of ['-1', '10.123', 'abc', '']) await expect(dto({ value })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa fonte fora da lista', async () => {
    const err = await dto({ source: 'ESTIMATIVA' }).catch(e => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(JSON.stringify(err.getResponse())).toContain('MANUAL, OFFICIAL_REPORT');
  });
});

describe('MetricsService.record', () => {
  it('grava com fonte, referência e data de observação', async () => {
    const { service, metrics } = setup();
    const { data } = await record(service, PUB_A1, { value: 120 });
    expect(data).toMatchObject({
      publicationId: PUB_A1, kind: 'CLICKS', value: '120', source: 'MANUAL',
      sourceReference: 'Insights do Instagram', observedAt: '2026-11-18T20:00:00.000Z',
    });
    expect(metrics).toHaveLength(1);
  });

  it('comissão aceita centavos e sai com 2 casas', async () => {
    const { service } = setup();
    const { data } = await record(service, PUB_A1, { kind: 'COMMISSION', value: '12.5', source: 'OFFICIAL_REPORT', sourceReference: 'Painel Shopee Afiliados 11/2026' });
    expect(data.value).toBe('12.50');
  });

  it('contagem com fração responde 400', async () => {
    const { service, metrics } = setup();
    await expect(record(service, PUB_A1, { kind: 'ORDERS', value: '2.5' })).rejects.toThrow(/inteiro/);
    expect(metrics).toHaveLength(0);
  });

  it('publicação inexistente responde 404 e rascunho responde 409', async () => {
    const { service, metrics } = setup();
    await expect(record(service, 'e6f1c1a0-0000-4000-8000-0000000000ff')).rejects.toBeInstanceOf(NotFoundException);
    await expect(record(service, PUB_DRAFT)).rejects.toBeInstanceOf(ConflictException);
    expect(metrics).toHaveLength(0);
  });

  it('observação no futuro ou antes da publicação responde 400', async () => {
    const { service } = setup();
    await expect(record(service, PUB_A1, { observedAt: '2026-11-21T00:00:00.000Z' })).rejects.toThrow(/futuro/);
    await expect(record(service, PUB_A1, { observedAt: '2026-11-10T17:59:00.000Z' })).rejects.toThrow(/anterior/);
  });

  it('data sem hora no dia da publicação é aceita', async () => {
    const { service } = setup();
    const { data } = await record(service, PUB_A1, { observedAt: '2026-11-10' });
    expect(data.observedAt).toBe('2026-11-10T00:00:00.000Z');
    await expect(record(service, PUB_A1, { observedAt: '2026-11-09' })).rejects.toThrow(/anterior/);
  });
});

describe('MetricsService.listForPublication', () => {
  it('devolve o histórico da publicação, mais recente primeiro', async () => {
    const { service } = setup();
    await record(service, PUB_A1, { value: '50', observedAt: '2026-11-11T10:00:00.000Z' });
    await record(service, PUB_A1, { value: '120', observedAt: '2026-11-18T10:00:00.000Z' });
    await record(service, PUB_A2, { value: '7' });
    const { data } = await service.listForPublication(PUB_A1);
    expect(data.map(m => m.value)).toEqual(['120', '50']);
    await expect(service.listForPublication('e6f1c1a0-0000-4000-8000-0000000000ff')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('MetricsService.report', () => {
  const report = async (service: MetricsService, groupBy: string) =>
    service.report(await parseDto(MetricsReportDto, { groupBy }, false), NOW);

  const seed = async (service: MetricsService) => {
    // Acumulado: 50 e depois 120 na mesma publicação/fonte. O relatório usa 120, não 170.
    await record(service, PUB_A1, { value: '50', observedAt: '2026-11-11T10:00:00.000Z', sourceReference: 'Insights 11/11' });
    await record(service, PUB_A1, { value: '120', observedAt: '2026-11-18T10:00:00.000Z' });
    // Mesmo clique pelo relatório oficial: célula separada, nunca somada à manual.
    await record(service, PUB_A1, { value: '110', source: 'OFFICIAL_REPORT', sourceReference: 'Painel Shopee Afiliados', observedAt: '2026-11-17T10:00:00.000Z' });
    await record(service, PUB_A2, { value: '30', observedAt: '2026-11-14T10:00:00.000Z', sourceReference: 'Analytics do TikTok' });
    await record(service, PUB_A2, { kind: 'COMMISSION', value: '4.35', source: 'OFFICIAL_REPORT', sourceReference: 'Painel Shopee Afiliados', observedAt: '2026-11-19T10:00:00.000Z' });
  };

  it('por publicação: último acumulado por métrica e fonte, manual e oficial separados', async () => {
    const { service } = setup();
    await seed(service);
    const { data, meta } = await report(service, 'publication');
    expect(meta).toEqual({ groupBy: 'publication', generatedAt: NOW.toISOString() });
    // B1 não tem registro: não aparece com zero inventado.
    expect(data.map(g => g.publication!.id)).toEqual([PUB_A2, PUB_A1]);
    const a1 = data.find(g => g.publication!.id === PUB_A1)!;
    expect(a1.product).toEqual({ id: PRODUCT_A, name: 'Organizador de gaveta' });
    expect(a1.publication).toMatchObject({ channel: 'INSTAGRAM', status: 'PUBLISHED_MANUALLY', publishedAt: '2026-11-10T18:00:00.000Z' });
    expect(a1.metrics).toEqual([
      { kind: 'CLICKS', source: 'MANUAL', value: '120', publicationCount: 1, observedAt: '2026-11-18T10:00:00.000Z', oldestObservedAt: '2026-11-18T10:00:00.000Z', sourceReferences: ['Insights do Instagram'] },
      { kind: 'CLICKS', source: 'OFFICIAL_REPORT', value: '110', publicationCount: 1, observedAt: '2026-11-17T10:00:00.000Z', oldestObservedAt: '2026-11-17T10:00:00.000Z', sourceReferences: ['Painel Shopee Afiliados'] },
    ]);
  });

  it('por produto: soma o último de cada publicação e mostra o intervalo de observação', async () => {
    const { service } = setup();
    await seed(service);
    const { data } = await report(service, 'product');
    expect(data).toHaveLength(1);
    const [a] = data;
    expect(a.publication).toBeNull();
    expect(a.metrics).toEqual([
      { kind: 'CLICKS', source: 'MANUAL', value: '150', publicationCount: 2, observedAt: '2026-11-18T10:00:00.000Z', oldestObservedAt: '2026-11-14T10:00:00.000Z', sourceReferences: ['Analytics do TikTok', 'Insights do Instagram'] },
      { kind: 'CLICKS', source: 'OFFICIAL_REPORT', value: '110', publicationCount: 1, observedAt: '2026-11-17T10:00:00.000Z', oldestObservedAt: '2026-11-17T10:00:00.000Z', sourceReferences: ['Painel Shopee Afiliados'] },
      { kind: 'COMMISSION', source: 'OFFICIAL_REPORT', value: '4.35', publicationCount: 1, observedAt: '2026-11-19T10:00:00.000Z', oldestObservedAt: '2026-11-19T10:00:00.000Z', sourceReferences: ['Painel Shopee Afiliados'] },
    ]);
  });

  it('mesma observação registrada duas vezes vale a correção mais recente', async () => {
    const { service, metrics } = setup();
    await record(service, PUB_B1, { value: '80' });
    await record(service, PUB_B1, { value: '75' });
    metrics[1].createdAt = new Date(metrics[0].createdAt.getTime() + 1000);
    const { data } = await report(service, 'publication');
    expect(data[0].metrics[0].value).toBe('75');
  });

  it('sem registros devolve lista vazia e groupBy inválido responde 400', async () => {
    const { service } = setup();
    expect((await report(service, 'product')).data).toEqual([]);
    await expect(report(service, 'channel')).rejects.toBeInstanceOf(BadRequestException);
    await expect(parseDto(MetricsReportDto, {}, false)).rejects.toBeInstanceOf(BadRequestException);
  });
});
