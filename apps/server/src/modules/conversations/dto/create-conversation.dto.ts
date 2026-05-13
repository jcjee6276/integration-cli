import { IsNotEmpty, IsString } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty()
  agentSessionId!: string;

  @IsString()
  @IsNotEmpty()
  promptId!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}
