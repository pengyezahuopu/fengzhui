import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { RefundService } from './refund.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRefundDto, ReviewRefundDto } from './dto';
import { RefundStatus } from '@prisma/client';

@Controller('refunds')
@UseGuards(JwtAuthGuard)
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  /**
   * 预览退款金额
   * GET /refunds/preview?orderId=xxx
   */
  @Get('preview')
  async previewRefund(
    @Req() req: Request,
    @Query('orderId') orderId: string,
  ) {
    const userId = req['user'].userId;
    return this.refundService.previewRefund(userId, orderId);
  }

  /**
   * 申请退款
   * POST /refunds
   */
  @Post()
  async createRefund(@Req() req: Request, @Body() dto: CreateRefundDto) {
    const userId = req['user'].userId;
    return this.refundService.createRefund(userId, dto);
  }

  /**
   * 获取用户退款列表
   * GET /refunds
   */
  @Get()
  async getUserRefunds(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: RefundStatus,
  ) {
    const userId = req['user'].userId;
    return this.refundService.getUserRefunds(userId, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      status,
    });
  }

  /**
   * 获取退款详情
   * GET /refunds/:id
   */
  @Get(':id')
  async getRefundById(@Req() req: Request, @Param('id') refundId: string) {
    const userId = req['user'].userId;
    return this.refundService.getRefundById(userId, refundId);
  }

  /**
   * 审批通过退款 (俱乐部管理员)
   * PUT /refunds/:id/approve
   */
  @Put(':id/approve')
  async approveRefund(@Req() req: Request, @Param('id') refundId: string) {
    const adminUserId = req['user'].userId;
    return this.refundService.approveRefund(adminUserId, refundId);
  }

  /**
   * 拒绝退款 (俱乐部管理员)
   * PUT /refunds/:id/reject
   */
  @Put(':id/reject')
  async rejectRefund(
    @Req() req: Request,
    @Param('id') refundId: string,
    @Body() dto: ReviewRefundDto,
  ) {
    const adminUserId = req['user'].userId;
    return this.refundService.rejectRefund(
      adminUserId,
      refundId,
      dto.rejectReason || '审核未通过',
    );
  }

  /**
   * 获取俱乐部待审批退款 (俱乐部管理员)
   * GET /refunds/club/:clubId/pending
   */
  @Get('club/:clubId/pending')
  async getClubPendingRefunds(@Param('clubId') clubId: string) {
    return this.refundService.getClubPendingRefunds(clubId);
  }
}
