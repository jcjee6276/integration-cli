import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CreateRequirementDto {
  @ApiProperty({ example: 'TypeScript로 마이그레이션', description: '요구 사항 내용' })
  @IsString()
  content!: string;

  @ApiPropertyOptional({ example: 0, description: '순서 인덱스' })
  @IsOptional()
  orderIndex?: number;
}

export class CreateAgentDto {
  @ApiPropertyOptional({ enum: ['claude', 'gemini'], example: 'claude', description: '에이전트 종류' })
  @IsOptional()
  @IsString()
  agentType?: string;

  @ApiProperty({ example: 'developer', description: '에이전트 역할' })
  @IsString()
  role!: string;

  @ApiPropertyOptional({ example: '시니어 백엔드 개발자', description: '커스텀 역할 설명' })
  @IsOptional()
  @IsString()
  customRole?: string;
}

export class CreateTaskDto {
  @ApiProperty({ example: 'API 리팩터링', description: '작업 제목' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: '/Users/me/my-project', description: '작업 디렉토리' })
  @IsOptional()
  @IsString()
  workingDir?: string;

  @ApiPropertyOptional({ type: [CreateRequirementDto], description: '요구 사항 목록' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRequirementDto)
  requirements?: CreateRequirementDto[];

  @ApiPropertyOptional({ type: [CreateAgentDto], description: '투입 에이전트 목록' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAgentDto)
  agents?: CreateAgentDto[];
}
