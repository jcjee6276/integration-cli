import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class UpdateRequirementDto {
  @IsString()
  content!: string;

  @IsOptional()
  orderIndex?: number;
}

export class UpdateAgentDto {
  @IsString()
  role!: string;

  @IsOptional()
  @IsString()
  customRole?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  workingDir?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateRequirementDto)
  requirements?: UpdateRequirementDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAgentDto)
  agents?: UpdateAgentDto[];
}
