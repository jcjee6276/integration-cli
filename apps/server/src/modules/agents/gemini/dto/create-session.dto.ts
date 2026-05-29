import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateSessionDto {
  @ApiPropertyOptional({ example: '/Users/me/my-project', description: '세션 작업 디렉토리' })
  @IsOptional()
  @IsString()
  workingDirectory?: string;
}
