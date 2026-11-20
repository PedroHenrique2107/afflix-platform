import type {
  ListPublicationMetricsResponse, MetricsReportGroupBy, MetricsReportResponse, PublicationMetricResponse,
  RecordPublicationMetricRequest,
} from '@afflix/shared';
import { getJson, postJson } from './client';

// Só publicação já publicada aceita métrica (409 nas demais).
export const recordPublicationMetric = (publicationId: string, body: RecordPublicationMetricRequest) =>
  postJson<PublicationMetricResponse>(`/api/v1/publications/${publicationId}/metrics`, body);

export const listPublicationMetrics = (publicationId: string) =>
  getJson<ListPublicationMetricsResponse>(`/api/v1/publications/${publicationId}/metrics`);

export const getMetricsReport = (groupBy: MetricsReportGroupBy) =>
  getJson<MetricsReportResponse>(`/api/v1/metrics/report?groupBy=${groupBy}`);
