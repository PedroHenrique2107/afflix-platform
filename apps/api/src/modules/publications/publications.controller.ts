import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query, StreamableFile } from '@nestjs/common';
import { parseDto } from '../../common/parse-dto';
import { ChangePublicationStatusDto, CreatePublicationDto, ListPublicationsDto, UpdatePublicationDto } from './publication.dto';
import { PublicationsService } from './publications.service';

@Controller('publications')
export class PublicationsController {
  constructor(@Inject(PublicationsService) private readonly service: PublicationsService) {}

  @Post()
  async create(@Body() rawBody: unknown) {
    return this.service.create(await parseDto(CreatePublicationDto, rawBody, false));
  }

  @Get()
  async list(@Query() rawQuery: Record<string, string>) {
    return this.service.list(await parseDto(ListPublicationsDto, rawQuery, true));
  }

  @Get(':id')
  async get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.get(id);
  }

  // Download do briefing em texto (UTF-8). 409 se faltar legenda, CTA ou link.
  @Get(':id/briefing')
  async briefing(@Param('id', new ParseUUIDPipe()) id: string) {
    const { filename, content } = await this.service.exportBriefing(id);
    return new StreamableFile(Buffer.from(content, 'utf8'), {
      type: 'text/plain; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Patch(':id')
  async update(@Param('id', new ParseUUIDPipe()) id: string, @Body() rawBody: unknown) {
    return this.service.update(id, await parseDto(UpdatePublicationDto, rawBody, false));
  }

  // Transição separada da edição: o corpo é só o destino e, para PUBLISHED_MANUALLY, URL e data.
  @Post(':id/status')
  @HttpCode(200)
  async changeStatus(@Param('id', new ParseUUIDPipe()) id: string, @Body() rawBody: unknown) {
    return this.service.changeStatus(id, await parseDto(ChangePublicationStatusDto, rawBody, false));
  }
}
