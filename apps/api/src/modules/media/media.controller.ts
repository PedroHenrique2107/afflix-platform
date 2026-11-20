import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MEDIA_MAX_BYTES } from '@afflix/shared';
import { parseDto } from '../../common/parse-dto';
import { ListMediaAssetsDto, UpdateMediaAssetDto } from './media.dto';
import { MediaService, UploadedMedia } from './media.service';

// Biblioteca de vídeos: só arquivo de vídeo, até MEDIA_MAX_BYTES. O destino (pasta temporária) vem do MulterModule.
const uploadOptions = {
  limits: { fileSize: MEDIA_MAX_BYTES, files: 1 },
  fileFilter: (_req: unknown, file: { mimetype: string }, done: (error: Error | null, accept: boolean) => void) =>
    file.mimetype.startsWith('video/')
      ? done(null, true)
      : done(new BadRequestException('Só arquivos de vídeo são aceitos na biblioteca'), false),
};

@Controller('media')
export class MediaController {
  constructor(@Inject(MediaService) private readonly service: MediaService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  async create(@UploadedFile() file: UploadedMedia | undefined, @Body() rawBody: unknown) {
    return this.service.create(rawBody, file);
  }

  @Get()
  async list(@Query() rawQuery: Record<string, string>) {
    return this.service.list(await parseDto(ListMediaAssetsDto, rawQuery, true));
  }

  @Patch(':id')
  async update(@Param('id', new ParseUUIDPipe()) id: string, @Body() rawBody: unknown) {
    return this.service.update(id, await parseDto(UpdateMediaAssetDto, rawBody, false));
  }
}
