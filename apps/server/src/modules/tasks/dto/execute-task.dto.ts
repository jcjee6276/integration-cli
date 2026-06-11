import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, ValidateNested } from 'class-validator';

export class AgentTestCodePreferenceDto {
  @ApiPropertyOptional({ example: 1, description: '에이전트 ID' })
  @IsNumber()
  agentId!: number;

  @ApiPropertyOptional({ example: true, description: '테스트 코드 작성 여부' })
  @IsBoolean()
  writeTestCode!: boolean;
}

export class ExecuteTaskDto {
  @ApiPropertyOptional({ type: [AgentTestCodePreferenceDto], description: '에이전트별 테스트 코드 작성 여부' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentTestCodePreferenceDto)
  agentTestCodePreferences?: AgentTestCodePreferenceDto[];
}
