import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { AgentModel, ConversationType } from '../enums/conversation.enum';

export class CreateConversationDto {
  @ApiProperty({ example: 'uuid-session-id', description: '세션 ID' })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @ApiProperty({ example: 'uuid-prompt-id', description: '프롬프트 ID' })
  @IsString()
  @IsNotEmpty()
  promptId!: string;

  @ApiProperty({ example: '코드 분석해줘', description: '메시지 내용' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({ enum: AgentModel, example: AgentModel.CLAUDE, description: '에이전트 모델' })
  @IsEnum(AgentModel)
  agentModel!: AgentModel;

  @ApiProperty({ enum: ConversationType, example: ConversationType.USER_MESSAGE, description: '메시지 유형' })
  @IsEnum(ConversationType)
  type!: ConversationType;

  @IsInt()
  @IsOptional()
  agentId?: number | null;

  @IsInt()
  @IsOptional()
  runId?: number | null;
}
