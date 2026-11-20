import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { LocalMediaStorage, MEDIA_STORAGE, mediaTempDir } from './media-storage';

@Module({
  // Factory: a pasta é lida em runtime, depois do load-env.
  imports: [MulterModule.registerAsync({ useFactory: () => ({ dest: mediaTempDir() }) })],
  controllers: [MediaController],
  providers: [MediaService, { provide: MEDIA_STORAGE, useFactory: () => new LocalMediaStorage() }],
})
export class MediaModule {}
