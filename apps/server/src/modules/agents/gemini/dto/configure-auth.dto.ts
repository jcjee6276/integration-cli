import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

import type { GeminiAuthType } from '../gemini-auth.manager';

export class ConfigureAuthDto {
  @ApiProperty({ enum: ['api-key', 'gca'], example: 'api-key', description: '인증 방식' })
  @IsIn(['api-key', 'gca'])
  authType!: GeminiAuthType;

  @ApiPropertyOptional({ example: 'AIza...', description: 'API Key (authType=api-key 시 필수)' })
  @IsOptional()
  @IsString()
  apiKey?: string;
}
