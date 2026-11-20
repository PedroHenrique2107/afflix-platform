import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { parseDto } from '../../common/parse-dto';
import { MetricsReportDto, RecordPublicationMetricDto } from './metric.dto';
import { MetricsService } from './metrics.service';

// Rotas sem prefixo no @Controller: o registro pendura em /publications/:id, o relatório fica em /metrics.
@Controller()
export class MetricsController {
  constructor(@Inject(MetricsService) private readonly service: MetricsService) {}

  @Post('publications/:id/metrics')
  async record(@Param('id', new ParseUUIDPipe()) id: string, @Body() rawBody: unknown) {
    return this.service.record(id, await parseDto(RecordPublicationMetricDto, rawBody, false));
  }

  @Get('publications/:id/metrics')
  async list(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.listForPublication(id);
  }

  @Get('metrics/report')
  async report(@Query() rawQuery: Record<string, string>) {
    return this.service.report(await parseDto(MetricsReportDto, rawQuery, false));
  }
}
