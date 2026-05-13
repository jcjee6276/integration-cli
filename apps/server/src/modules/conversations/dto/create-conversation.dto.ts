import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

import { AgentModel, ConversationType } from '../enums/conversation.enum';

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  promptId!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsEnum(AgentModel)
  agentModel!: AgentModel;

  @IsEnum(ConversationType)
  type!: ConversationType;
}
