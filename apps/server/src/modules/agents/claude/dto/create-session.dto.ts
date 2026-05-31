import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class ClaudeCreateSessionDto {
  @ApiPropertyOptional({ example: '/Users/me/my-project', description: '세션 작업 디렉토리' })
  @IsOptional()
  @IsString()
  workingDirectory?: string;

  @ApiPropertyOptional({ example: 'sonnet', description: 'Claude CLI 모델명 또는 별칭' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ example: 'high', description: 'Claude reasoning effort' })
  @IsOptional()
  @IsString()
  reasoning?: string;

  @ApiPropertyOptional({ example: { NODE_ENV: 'development' }, description: '추가 환경 변수' })
  @IsOptional()
  @IsObject()
  env?: Record<string, string>;
}
