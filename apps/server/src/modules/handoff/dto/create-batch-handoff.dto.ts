import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { HANDOFF_AGENT_IDS, type HandoffAgentId } from './create-agent-handoff.dto';

export class BatchHandoffItem {
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  title!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  route?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  filePath?: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  @IsOptional()
  line?: number;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  @IsOptional()
  endLine?: number;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  detail?: string;
}

export class CreateBatchHandoffDto {
  @IsIn(HANDOFF_AGENT_IDS)
  agentId!: HandoffAgentId;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  projectPath?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  instruction?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => BatchHandoffItem)
  items!: BatchHandoffItem[];
}
