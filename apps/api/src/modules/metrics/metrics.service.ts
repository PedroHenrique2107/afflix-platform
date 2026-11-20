import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ListPublicationMetricsResponse, MetricsReportResponse, PublicationMetricResponse } from '@afflix/shared';
import { PrismaService } from '../prisma/prisma.service';
import { parsePublishedAt } from '../publications/publication.dto';
import { isDateOnly, metricValueError, MetricsReportDto, RecordPublicationMetricDto } from './metric.dto';
import { buildMetricsReport, METRIC_PUBLICATION_SELECT, MetricWithPublication, serializeMetric } from './metrics-report';

// Mesma tolerância do registro de publicação: relógio do navegador um pouco à frente do servidor.
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

@Injectable()
export class MetricsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(publicationId: string, dto: RecordPublicationMetricDto, now = new Date()): Promise<PublicationMetricResponse> {
    const publication = await this.prisma.publication.findUnique({ where: { id: publicationId } });
    if (!publication) throw new NotFoundException('Publicação não encontrada');
    // Sem data de publicação não há post no canal para medir.
    if (!publication.publishedAt) {
      throw new ConflictException('Só publicação já publicada recebe métrica; registre a publicação antes');
    }

    const valueError = metricValueError(dto.kind, dto.value);
    if (valueError) throw new BadRequestException(valueError);

    const observedAt = parsePublishedAt(dto.observedAt);
    if (observedAt.getTime() > now.getTime() + CLOCK_SKEW_MS) {
      throw new BadRequestException('observedAt não pode estar no futuro');
    }
    // Data sem hora compara por dia: o operador anota "dia 20" para um post das 18h do dia 20.
    const floor = isDateOnly(dto.observedAt) ? startOfUtcDay(publication.publishedAt) : publication.publishedAt;
    if (observedAt.getTime() < floor.getTime()) {
      throw new BadRequestException('observedAt não pode ser anterior à data de publicação');
    }

    const row = await this.prisma.publicationMetric.create({
      data: {
        publicationId,
        kind: dto.kind,
        value: new Prisma.Decimal(dto.value),
        source: dto.source,
        sourceReference: dto.sourceReference,
        observedAt,
      },
    });
    return { data: serializeMetric(row) };
  }

  async listForPublication(publicationId: string): Promise<ListPublicationMetricsResponse> {
    const publication = await this.prisma.publication.findUnique({ where: { id: publicationId } });
    if (!publication) throw new NotFoundException('Publicação não encontrada');
    const rows = await this.prisma.publicationMetric.findMany({
      where: { publicationId },
      orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return { data: rows.map(serializeMetric) };
  }

  // Volume do MVP (dezenas de publicações) cabe em memória; agrega na api para manter a regra do acumulado num lugar só.
  async report(dto: MetricsReportDto, now = new Date()): Promise<MetricsReportResponse> {
    const rows = await this.prisma.publicationMetric.findMany({
      include: { publication: { select: METRIC_PUBLICATION_SELECT } },
      orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return {
      data: buildMetricsReport(rows as MetricWithPublication[], dto.groupBy),
      meta: { groupBy: dto.groupBy, generatedAt: now.toISOString() },
    };
  }
}
