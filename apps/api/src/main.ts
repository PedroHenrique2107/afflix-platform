import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './modules/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.enableCors({ origin: process.env.WEB_ORIGIN || 'http://localhost:5173' });
  // Nunca use '0.0.0.0' para expor esta V1 sem autenticação.
  await app.listen(Number(process.env.PORT || 3000), '127.0.0.1');
}
void bootstrap();
