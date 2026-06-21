import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUrl } from 'class-validator';

export class CrawlDto {
  @ApiProperty({ description: '크롤할 로컬 앱 URL', example: 'http://localhost:3000' })
  @IsString()
  @IsUrl({ require_tld: false, require_protocol: true })
  appUrl!: string;

  @ApiPropertyOptional({ description: '라우트 자동 발견에 쓸 프로젝트 경로' })
  @IsOptional()
  @IsString()
  projectPath?: string;

  @ApiPropertyOptional({ description: '명시적 라우트 목록 (없으면 app 디렉토리에서 자동 발견)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  routes?: string[];
}
