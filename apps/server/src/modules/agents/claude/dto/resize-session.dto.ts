import { IsInt, Max, Min } from 'class-validator';

export class ResizeSessionDto {
  @IsInt()
  @Min(10)
  @Max(500)
  cols!: number;

  @IsInt()
  @Min(5)
  @Max(200)
  rows!: number;
}
