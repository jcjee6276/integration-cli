import { IsNotEmpty, IsString } from 'class-validator';

export class MergeFileDto {
  @IsString()
  @IsNotEmpty()
  filePath!: string;
}
