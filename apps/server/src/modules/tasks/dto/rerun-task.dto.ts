import { IsOptional, IsString } from 'class-validator';

export class RerunTaskDto {
  @IsOptional()
  @IsString()
  supplementNote?: string;
}
