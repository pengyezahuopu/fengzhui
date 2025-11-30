import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { WechatPayService } from './wechat-pay.service';
import { PrismaModule } from '../prisma.module';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [PrismaModule, OrderModule],
  controllers: [PaymentController],
  providers: [PaymentService, WechatPayService],
  exports: [PaymentService, WechatPayService],
})
export class PaymentModule {}
