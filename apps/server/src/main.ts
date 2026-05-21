import * as fs from 'fs';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';

import { AppModule } from './app.module';
import { ensureJiDirs, JI_PATHS } from './common/ji-paths';

async function bootstrap() {
  ensureJiDirs();

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error', 'debug'],
  });

  // 로그를 ~/.ji/logs/server.log 에 추가 기록
  const logStream = fs.createWriteStream(JI_PATHS.serverLog, { flags: 'a' });
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk: string | Uint8Array, ...args: unknown[]) => {
    logStream.write(chunk);
    return (origWrite as (...a: unknown[]) => boolean)(chunk, ...args);
  };

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useWebSocketAdapter(new IoAdapter(app));
  app.enableCors();

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
