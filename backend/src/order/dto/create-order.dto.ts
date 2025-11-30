import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  enrollmentId: string;

  @IsString()
  @IsNotEmpty()
  insuredName: string;

  @IsString()
  @IsOptional()
  insuredIdCard?: string;

  @IsString()
  @IsNotEmpty()
  insuredPhone: string;
}
