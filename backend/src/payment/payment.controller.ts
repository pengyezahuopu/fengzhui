import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentService } from './payment.service';
import { ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrepayDto } from './dto';
import { PaymentNotification } from './wechat-pay.service';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * 发起预支付
   * POST /payments/prepay
   */
  @Post('prepay')
  @UseGuards(JwtAuthGuard)
  async prepay(@Req() req: Request, @Body() dto: PrepayDto) {
    const userId = req['user'].userId;
    return this.paymentService.prepay(userId, dto);
  }

  /**
   * 微信支付回调
   * POST /payments/notify/wechat
   * 注意：此接口不需要认证，由微信服务器调用
   */
  @Post('notify/wechat')
  @HttpCode(HttpStatus.OK)
  async wechatNotify(
    @Headers('wechatpay-timestamp') timestamp: string,
    @Headers('wechatpay-nonce') nonce: string,
    @Headers('wechatpay-signature') signature: string,
    @Headers('wechatpay-serial') serial: string,
    @Body() notification: PaymentNotification,
    @Req() req: RawBodyRequest<Request>,
  ) {
    // 获取原始请求体用于签名验证
    const rawBody = req.rawBody?.toString() || JSON.stringify(notification);

    return this.paymentService.handleWechatNotify(
      notification,
      { timestamp, nonce, signature, serial },
      rawBody,
    );
  }

  /**
   * 查询支付状态
   * GET /payments/:orderId/status
   */
  @Get(':orderId/status')
  @UseGuards(JwtAuthGuard)
  async getPaymentStatus(
    @Req() req: Request,
    @Param('orderId') orderId: string,
  ) {
    const userId = req['user'].userId;
    const detail = await this.paymentService.getPaymentDetail(userId, orderId);
    return {
      status: detail.status,
      paymentStatus: detail.payment?.status || 'pending',
    };
  }

  /**
   * 同步支付状态 (主动查询微信)
   * POST /payments/:orderId/sync
   */
  @Post(':orderId/sync')
  @UseGuards(JwtAuthGuard)
  async syncPaymentStatus(
    @Req() req: Request,
    @Param('orderId') orderId: string,
  ) {
    const userId = req['user'].userId;
    await this.paymentService.getPaymentDetail(userId, orderId);
    return this.paymentService.syncPaymentStatus(orderId);
  }

  /**
   * 开发环境模拟支付成功，便于 H5 端到端测试
   */
  @Post(':orderId/mock-success')
  @UseGuards(JwtAuthGuard)
  async mockSuccess(
    @Req() req: Request,
    @Param('orderId') orderId: string,
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('生产环境不允许模拟支付');
    }
    const userId = req['user'].userId;
    await this.paymentService.getPaymentDetail(userId, orderId);
    return this.paymentService.mockPaymentSuccess(orderId);
  }

  /**
   * 获取支付详情
   * GET /payments/:orderId
   */
  @Get(':orderId')
  @UseGuards(JwtAuthGuard)
  async getPaymentDetail(
    @Req() req: Request,
    @Param('orderId') orderId: string,
  ) {
    const userId = req['user'].userId;
    return this.paymentService.getPaymentDetail(userId, orderId);
  }

  /**
   * 模拟支付成功 (仅开发环境)
   * POST /payments/:orderId/mock-success
   * 用于 H5 端到端测试
   */
  @Post(':orderId/mock-success')
  @UseGuards(JwtAuthGuard)
  async mockPaymentSuccess(
    @Req() req: Request,
    @Param('orderId') orderId: string,
  ) {
    const userId = req['user'].userId;
    return this.paymentService.mockPaymentSuccess(userId, orderId);
  }
}
