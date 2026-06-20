import * as fs from 'fs';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

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

  // ─── Swagger / OpenAPI ────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Integration CLI API')
    .setDescription(
      'Claude Code · Gemini CLI 등 AI 에이전트를 통합 관리하는 REST API.\n\n' +
        '실시간 출력은 `/tasks` WebSocket 네임스페이스를 통해 수신합니다.',
    )
    .setVersion('1.0')
    .addTag('agents/claude', 'Claude Code 인증·세션 관리')
    .addTag('agents/gemini', 'Gemini CLI 인증·세션 관리')
    .addTag('tasks', '비동기 작업 생성·실행·조회')
    .addTag('sessions', 'DB 저장 세션 조회')
    .addTag('conversations', '대화 메시지 저장·조회')
    .addTag('inspector', '로컬 dev 서버 element inspect (CDP)')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Scalar UI — /docs
  app.use(
    '/docs',
    apiReference({
      spec: { content: document },
      theme: 'saturn',
    }),
  );

  // Raw OpenAPI JSON — /docs-json
  SwaggerModule.setup('docs-json', app, document, {
    jsonDocumentUrl: 'docs-json',
    swaggerUiEnabled: false,
  });

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
