import { IsEnum, IsString } from 'class-validator';

export class SaveHarnessDto {
  @IsString()
  content!: string;

  @IsEnum(['md', 'tsx'])
  ext!: 'md' | 'tsx';
}
