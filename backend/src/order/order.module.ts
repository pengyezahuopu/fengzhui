import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderSchedulerService } from './order-scheduler.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [OrderController],
  providers: [OrderService, OrderSchedulerService, PrismaService],
  exports: [OrderService],
})
export class OrderModule {}
