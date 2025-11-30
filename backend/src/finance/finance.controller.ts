import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountService } from './account.service';
import { TransactionService } from './transaction.service';
import { WithdrawalService } from './withdrawal.service';
import { SettlementService } from './settlement.service';
import { DashboardService } from './dashboard.service';
import {
  UpdateBankAccountDto,
  QueryTransactionDto,
  CreateWithdrawalDto,
  QueryWithdrawalDto,
  ReviewWithdrawalDto,
  QuerySettlementDto,
} from './dto';

@Controller('finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(
    private readonly accountService: AccountService,
    private readonly transactionService: TransactionService,
    private readonly withdrawalService: WithdrawalService,
    private readonly settlementService: SettlementService,
    private readonly dashboardService: DashboardService,
  ) {}

  // ==================== Dashboard ====================

  /**
   * 获取俱乐部 Dashboard 统计
   */
  @Get('clubs/:clubId/dashboard')
  async getDashboardStats(@Param('clubId') clubId: string) {
    return this.dashboardService.getDashboardStats(clubId);
  }

  /**
   * 获取收入趋势
   */
  @Get('clubs/:clubId/dashboard/income-trend')
  async getIncomeTrend(
    @Param('clubId') clubId: string,
    @Query('days') days: string,
  ) {
    return this.dashboardService.getIncomeTrend(
      clubId,
      parseInt(days) || 7,
    );
  }

  /**
   * 获取活动排行榜
   */
  @Get('clubs/:clubId/dashboard/activity-ranking')
  async getActivityRanking(
    @Param('clubId') clubId: string,
    @Query('limit') limit: string,
  ) {
    return this.dashboardService.getActivityRanking(
      clubId,
      parseInt(limit) || 10,
    );
  }

  // ==================== 账户管理 ====================

  /**
   * 获取俱乐部账户详情
   */
  @Get('clubs/:clubId/account')
  async getAccountDetail(@Param('clubId') clubId: string) {
    return this.accountService.getAccountDetail(clubId);
  }

  /**
   * 更新银行账户信息
   */
  @Put('clubs/:clubId/account/bank')
  async updateBankAccount(
    @Param('clubId') clubId: string,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.accountService.updateBankAccount(clubId, dto);
  }

  // ==================== 流水查询 ====================

  /**
   * 获取俱乐部流水列表
   */
  @Get('clubs/:clubId/transactions')
  async getTransactions(
    @Param('clubId') clubId: string,
    @Query() query: QueryTransactionDto,
  ) {
    return this.transactionService.getTransactions(clubId, query);
  }

  /**
   * 获取月度统计
   */
  @Get('clubs/:clubId/transactions/monthly')
  async getMonthlyStats(
    @Param('clubId') clubId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.transactionService.getMonthlyStats(
      clubId,
      parseInt(year) || new Date().getFullYear(),
      parseInt(month) || new Date().getMonth() + 1,
    );
  }

  /**
   * 获取财务报表
   */
  @Get('clubs/:clubId/transactions/report')
  async getFinanceReport(
    @Param('clubId') clubId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.transactionService.getFinanceReport(clubId, startDate, endDate);
  }

  // ==================== 提现管理 ====================

  /**
   * 申请提现
   */
  @Post('clubs/:clubId/withdrawals')
  async createWithdrawal(
    @Request() req: any,
    @Param('clubId') clubId: string,
    @Body() dto: CreateWithdrawalDto,
  ) {
    return this.withdrawalService.createWithdrawal(req.user.id, clubId, dto);
  }

  /**
   * 获取提现列表
   */
  @Get('clubs/:clubId/withdrawals')
  async getWithdrawals(
    @Param('clubId') clubId: string,
    @Query() query: QueryWithdrawalDto,
  ) {
    return this.withdrawalService.getWithdrawals(clubId, query);
  }

  /**
   * 获取提现详情
   */
  @Get('clubs/:clubId/withdrawals/:withdrawalId')
  async getWithdrawalById(
    @Param('clubId') clubId: string,
    @Param('withdrawalId') withdrawalId: string,
  ) {
    return this.withdrawalService.getWithdrawalById(clubId, withdrawalId);
  }

  // ==================== 结算管理 ====================

  /**
   * 获取结算列表
   */
  @Get('clubs/:clubId/settlements')
  async getSettlements(
    @Param('clubId') clubId: string,
    @Query() query: QuerySettlementDto,
  ) {
    return this.settlementService.getSettlements(clubId, query);
  }

  /**
   * 获取结算详情
   */
  @Get('clubs/:clubId/settlements/:settlementId')
  async getSettlementById(
    @Param('clubId') clubId: string,
    @Param('settlementId') settlementId: string,
  ) {
    return this.settlementService.getSettlementById(clubId, settlementId);
  }

  /**
   * 获取待结算统计
   */
  @Get('clubs/:clubId/settlements/pending/stats')
  async getPendingSettlementStats(@Param('clubId') clubId: string) {
    return this.settlementService.getPendingSettlementStats(clubId);
  }

  // ==================== 管理员接口 ====================

  /**
   * 获取待处理提现列表 (管理员)
   */
  @Get('admin/withdrawals/pending')
  async getPendingWithdrawals(
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return this.withdrawalService.getPendingWithdrawals(
      parseInt(page) || 1,
      parseInt(limit) || 20,
    );
  }

  /**
   * 审批通过提现 (管理员)
   */
  @Post('admin/withdrawals/:withdrawalId/approve')
  async approveWithdrawal(
    @Request() req: any,
    @Param('withdrawalId') withdrawalId: string,
  ) {
    return this.withdrawalService.approveWithdrawal(req.user.id, withdrawalId);
  }

  /**
   * 拒绝提现 (管理员)
   */
  @Post('admin/withdrawals/:withdrawalId/reject')
  async rejectWithdrawal(
    @Request() req: any,
    @Param('withdrawalId') withdrawalId: string,
    @Body() dto: ReviewWithdrawalDto,
  ) {
    return this.withdrawalService.rejectWithdrawal(
      req.user.id,
      withdrawalId,
      dto.rejectReason || '审核不通过',
    );
  }

  /**
   * 完成提现打款 (管理员)
   */
  @Post('admin/withdrawals/:withdrawalId/complete')
  async completeWithdrawal(
    @Request() req: any,
    @Param('withdrawalId') withdrawalId: string,
  ) {
    return this.withdrawalService.completeWithdrawal(req.user.id, withdrawalId);
  }

  /**
   * 手动触发活动结算 (管理员)
   */
  @Post('admin/settlements/activity/:activityId')
  async settleActivity(@Param('activityId') activityId: string) {
    return this.settlementService.settleActivity(activityId);
  }
}
