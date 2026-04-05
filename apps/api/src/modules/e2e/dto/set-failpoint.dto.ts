import { IsIn, IsInt, IsObject, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class SetFailpointDto {
  @IsString()
  path!: string;

  @IsIn(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
  method!: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

  @IsInt()
  @Min(400)
  @Max(599)
  statusCode!: number;

  @IsOptional()
  @IsObject()
  body?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  delayMs?: number;

  @IsOptional()
  @IsPositive()
  times?: number;
}
