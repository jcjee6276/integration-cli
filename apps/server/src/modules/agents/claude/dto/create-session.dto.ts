import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateSessionDto {
  @IsOptional()
  @IsString()
  workingDirectory?: string;

  @IsOptional()
  @IsObject()
  env?: Record<string, string>;
}
