import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class ClaudeCreateSessionDto {
  @ApiPropertyOptional({ example: '/Users/me/my-project', description: '세션 작업 디렉토리' })
  @IsOptional()
  @IsString()
  workingDirectory?: string;

  @ApiPropertyOptional({ example: { NODE_ENV: 'development' }, description: '추가 환경 변수' })
  @IsOptional()
  @IsObject()
  env?: Record<string, string>;
}
