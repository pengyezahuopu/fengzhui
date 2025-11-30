import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { VerificationService } from './verification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VerifyOrderDto, QueryVerificationDto } from './dto';

@Controller('verifications')
@UseGuards(JwtAuthGuard)
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  /**
   * 扫码核销订单
   * POST /verifications/verify
   */
  @Post('verify')
  async verifyOrder(@Req() req: Request, @Body() dto: VerifyOrderDto) {
    const verifierId = req['user'].userId;
    return this.verificationService.verifyOrder(verifierId, dto.code, dto.note);
  }

  /**
   * 根据订单号核销
   * POST /verifications/verify-by-order-no/:orderNo
   */
  @Post('verify-by-order-no/:orderNo')
  async verifyByOrderNo(@Req() req: Request, @Param('orderNo') orderNo: string) {
    const verifierId = req['user'].userId;
    return this.verificationService.verifyByOrderNo(verifierId, orderNo);
  }

  /**
   * 获取领队/管理员待核销活动列表
   * GET /verifications/pending-activities
   */
  @Get('pending-activities')
  async getPendingActivities(@Req() req: Request) {
    const userId = req['user'].userId;
    return this.verificationService.getPendingVerificationActivities(userId);
  }

  /**
   * 获取活动核销统计
   * GET /verifications/activities/:activityId/stats
   */
  @Get('activities/:activityId/stats')
  async getActivityStats(
    @Req() req: Request,
    @Param('activityId') activityId: string,
  ) {
    const userId = req['user'].userId;
    return this.verificationService.getActivityVerificationStats(userId, activityId);
  }

  /**
   * 获取活动核销列表
   * GET /verifications/activities/:activityId
   */
  @Get('activities/:activityId')
  async getActivityVerifications(
    @Req() req: Request,
    @Param('activityId') activityId: string,
    @Query() query: QueryVerificationDto,
  ) {
    const userId = req['user'].userId;
    return this.verificationService.getActivityVerifications(
      userId,
      activityId,
      query.status as 'pending' | 'verified' | 'all',
    );
  }
}
