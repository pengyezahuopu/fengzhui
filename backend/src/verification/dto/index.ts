import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class VerifyOrderDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  note?: string;
}

export class QueryVerificationDto {
  @IsString()
  @IsOptional()
  activityId?: string;

  @IsString()
  @IsOptional()
  status?: 'pending' | 'verified' | 'all';
}
