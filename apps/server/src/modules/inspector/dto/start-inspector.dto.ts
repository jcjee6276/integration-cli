import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl } from 'class-validator';

export class StartInspectorDto {
  @ApiProperty({
    description: '인스펙트할 로컬 dev 서버 URL',
    example: 'http://localhost:3000',
  })
  @IsString()
  @IsUrl({ require_tld: false, require_protocol: true })
  appUrl!: string;
}
