import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { FinanceController } from './finance.controller';
import { AccountService } from './account.service';
import { TransactionService } from './transaction.service';
import { WithdrawalService } from './withdrawal.service';
import { SettlementService } from './settlement.service';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [FinanceController],
  providers: [
    PrismaService,
    AccountService,
    TransactionService,
    WithdrawalService,
    SettlementService,
    DashboardService,
  ],
  exports: [
    AccountService,
    TransactionService,
    WithdrawalService,
    SettlementService,
    DashboardService,
  ],
})
export class FinanceModule {}
