import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SendInputDto {
  @ApiProperty({ example: '현재 코드를 분석해줘', description: '에이전트에게 전달할 메시지' })
  @IsString()
  @MinLength(1)
  input!: string;
}
