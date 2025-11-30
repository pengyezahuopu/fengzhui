import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto, QueryOrderDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * 创建订单
   * POST /orders
   */
  @Post()
  async createOrder(@Request() req, @Body() dto: CreateOrderDto) {
    return this.orderService.createOrder(req.user.userId, dto);
  }

  /**
   * 获取订单列表
   * GET /orders
   */
  @Get()
  async getOrders(@Request() req, @Query() query: QueryOrderDto) {
    return this.orderService.getOrders(req.user.userId, query);
  }

  /**
   * 获取订单详情
   * GET /orders/:id
   */
  @Get(':id')
  async getOrderById(@Request() req, @Param('id') id: string) {
    return this.orderService.getOrderById(req.user.userId, id);
  }

  /**
   * 取消订单
   * POST /orders/:id/cancel
   */
  @Post(':id/cancel')
  async cancelOrder(@Request() req, @Param('id') id: string) {
    return this.orderService.cancelOrder(req.user.userId, id);
  }

  /**
   * 获取核销码
   * GET /orders/:id/verify-code
   */
  @Get(':id/verify-code')
  async getVerifyCode(@Request() req, @Param('id') id: string) {
    return this.orderService.getVerifyCode(req.user.userId, id);
  }
}
