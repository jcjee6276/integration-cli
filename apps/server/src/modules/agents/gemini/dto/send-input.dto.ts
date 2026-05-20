import { IsString, MinLength } from 'class-validator';

export class SendInputDto {
  @IsString()
  @MinLength(1)
  input!: string;
}
