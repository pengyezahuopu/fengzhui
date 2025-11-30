import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';
import { TransactionType, WithdrawalStatus } from '@prisma/client';

// ==================== Account DTOs ====================

export class UpdateBankAccountDto {
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @IsString()
  @IsNotEmpty()
  bankAccount: string;

  @IsString()
  @IsNotEmpty()
  accountName: string;
}

// ==================== Transaction DTOs ====================

export class QueryTransactionDto {
  @IsString()
  @IsOptional()
  activityId?: string;

  @IsEnum(TransactionType)
  @IsOptional()
  type?: TransactionType;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  @IsOptional()
  page?: number;

  @IsNumber()
  @IsOptional()
  limit?: number;
}

// ==================== Withdrawal DTOs ====================

export class CreateWithdrawalDto {
  @IsNumber()
  @Min(100) // 最低提现100元
  amount: number;
}

export class QueryWithdrawalDto {
  @IsEnum(WithdrawalStatus)
  @IsOptional()
  status?: WithdrawalStatus;

  @IsNumber()
  @IsOptional()
  page?: number;

  @IsNumber()
  @IsOptional()
  limit?: number;
}

export class ReviewWithdrawalDto {
  @IsString()
  @IsOptional()
  rejectReason?: string;
}

// ==================== Settlement DTOs ====================

export class QuerySettlementDto {
  @IsString()
  @IsOptional()
  activityId?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  @IsOptional()
  page?: number;

  @IsNumber()
  @IsOptional()
  limit?: number;
}

// ==================== Dashboard DTOs ====================

export class DashboardStatsDto {
  totalIncome: number;
  monthlyIncome: number;
  pendingSettlement: number;
  balance: number;
  totalActivities: number;
  activeActivities: number;
  totalEnrollments: number;
  monthlyEnrollments: number;
}

export class FinanceReportDto {
  period: string;
  income: number;
  refund: number;
  withdrawal: number;
  platformFee: number;
  netIncome: number;
}
