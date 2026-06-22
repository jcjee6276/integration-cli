import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const HANDOFF_AGENT_IDS = ['claude', 'gemini', 'codex'] as const;
export type HandoffAgentId = (typeof HANDOFF_AGENT_IDS)[number];

export class CreateAgentHandoffDto {
  @IsIn(HANDOFF_AGENT_IDS)
  agentId!: HandoffAgentId;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  request!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  projectPath?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  filePath!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  fileName?: string;

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
  @MaxLength(20000)
  selectedText?: string;
}
