import { Transform } from 'class-transformer';
import { IsIn, IsISO8601, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  METRIC_KINDS, METRIC_MONEY_KINDS, METRIC_SOURCE_REFERENCE_MAX_LENGTH, METRIC_SOURCE_REFERENCE_MIN_LENGTH, METRIC_SOURCES,
  METRICS_REPORT_GROUP_BY,
} from '@afflix/shared';
import type { MetricKind, MetricSource, MetricsReportGroupBy } from '@afflix/shared';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
// Aceita número ou string no JSON; guarda como string para não passar por float.
const toDecimalString = ({ value }: { value: unknown }) =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : typeof value === 'string' ? value.trim() : value;

// Até 12 dígitos inteiros e 2 casas: cabe em Decimal(14,2). Nunca negativo.
const DECIMAL_14_2 = /^\d{1,12}(\.\d{1,2})?$/;
const INTEGER = /^\d{1,12}$/;

export class RecordPublicationMetricDto {
  @IsIn(METRIC_KINDS, { message: `kind é obrigatório e deve ser um de: ${METRIC_KINDS.join(', ')}` })
  kind!: MetricKind;

  @Transform(toDecimalString)
  @IsString({ message: 'value é obrigatório' })
  @Matches(DECIMAL_14_2, { message: 'value deve ser um número >= 0 com até 2 casas decimais' })
  value!: string;

  @IsIn(METRIC_SOURCES, { message: `source é obrigatório e deve ser um de: ${METRIC_SOURCES.join(', ')}` })
  source!: MetricSource;

  @Transform(trim)
  @IsString({ message: 'sourceReference é obrigatório' })
  @MinLength(METRIC_SOURCE_REFERENCE_MIN_LENGTH, { message: `sourceReference deve identificar a origem do número (mínimo ${METRIC_SOURCE_REFERENCE_MIN_LENGTH} caracteres)` })
  @MaxLength(METRIC_SOURCE_REFERENCE_MAX_LENGTH)
  sourceReference!: string;

  @Transform(trim)
  @IsISO8601({ strict: true, strictSeparator: true }, { message: 'observedAt é obrigatório e deve ser uma data ISO 8601' })
  observedAt!: string;
}

export class MetricsReportDto {
  @Transform(trim)
  @IsIn(METRICS_REPORT_GROUP_BY, { message: `groupBy é obrigatório e deve ser um de: ${METRICS_REPORT_GROUP_BY.join(', ')}` })
  groupBy!: MetricsReportGroupBy;
}

// Contagem (visualização, clique, pedido) não tem fração; comissão é BRL com até 2 casas.
export function metricValueError(kind: MetricKind, value: string): string | null {
  if (METRIC_MONEY_KINDS.includes(kind)) return null;
  return INTEGER.test(value) ? null : `${kind} é uma contagem: value deve ser inteiro`;
}

export const isDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
