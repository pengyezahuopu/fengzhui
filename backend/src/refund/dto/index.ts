import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { RefundReason } from '@prisma/client';

export class CreateRefundDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsEnum(RefundReason)
  reason: RefundReason;

  @IsString()
  @IsOptional()
  reasonDetail?: string;
}

export class ReviewRefundDto {
  @IsString()
  @IsOptional()
  rejectReason?: string;
}

export class RefundPreviewResult {
  orderId: string;
  orderAmount: number;
  refundAmount: number;
  refundPercent: number;
  reason: string;
  canRefund: boolean;
}
