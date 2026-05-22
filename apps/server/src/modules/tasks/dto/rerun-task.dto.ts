import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RerunTaskDto {
  @ApiPropertyOptional({ example: '이전 결과에서 테스트 코드도 추가해줘', description: '재실행 시 보완 메모' })
  @IsOptional()
  @IsString()
  supplementNote?: string;
}
