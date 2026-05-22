import { IsNotEmpty, IsString } from 'class-validator';

export class ConfigureCodexAuthDto {
  @IsString()
  @IsNotEmpty()
  apiKey!: string;
}
