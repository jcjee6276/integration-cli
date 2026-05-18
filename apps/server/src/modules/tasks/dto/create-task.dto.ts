import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CreateRequirementDto {
  @IsString()
  content!: string;

  @IsOptional()
  orderIndex?: number;
}

export class CreateAgentDto {
  @IsString()
  role!: string;

  @IsOptional()
  @IsString()
  customRole?: string;
}

export class CreateTaskDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  workingDir?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRequirementDto)
  requirements?: CreateRequirementDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAgentDto)
  agents?: CreateAgentDto[];
}
