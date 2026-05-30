import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class RerunTaskDto {
  @ApiPropertyOptional({ example: '이전 결과에서 테스트 코드도 추가해줘', description: '재실행 시 보완 메모' })
  @IsOptional()
  @IsString()
  supplementNote?: string;

  @ApiPropertyOptional({ example: true, description: '재실행 시 테스트 코드 작성을 지시할지 여부' })
  @IsOptional()
  @IsBoolean()
  writeTestCode?: boolean;
}
