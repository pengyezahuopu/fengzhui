import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateInsuranceProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  provider: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  price: number;

  @IsString()
  @IsOptional()
  priceUnit?: string;

  @IsString()
  @IsOptional()
  coverage?: string;

  @IsNumber()
  @IsOptional()
  maxCompensation?: number;
}

export class UpdateInsuranceProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

export class UpdatePolicyDto {
  @IsString()
  @IsNotEmpty()
  policyNo: string;

  @IsString()
  @IsOptional()
  policyUrl?: string;
}

export class ExportInsuranceQuery {
  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;
}
