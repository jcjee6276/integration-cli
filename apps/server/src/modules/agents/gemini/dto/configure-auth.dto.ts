import { IsIn, IsOptional, IsString } from 'class-validator';

import type { GeminiAuthType } from '../gemini-auth.manager';

export class ConfigureAuthDto {
  @IsIn(['api-key', 'gca'])
  authType!: GeminiAuthType;

  @IsOptional()
  @IsString()
  apiKey?: string;
}
