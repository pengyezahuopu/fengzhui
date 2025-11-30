import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateOrderDto, QueryOrderDto } from './dto';
import {
  OrderStatus,
  EnrollStatus,
  InsuranceStatus,
  Prisma,
} from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class OrderService {
  // 订单超时时间 (分钟)
  private readonly ORDER_TIMEOUT_MINUTES = 15;

  // 平台服务费率
  private readonly PLATFORM_FEE_RATE = 0.05;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 生成订单号: 年月日时分秒 + 6位随机数
   */
  private generateOrderNo(): string {
    const now = new Date();
    const datePart = now
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${datePart}${randomPart}`;
  }

  /**
   * 生成核销码 (支付成功后调用)
   */
  generateVerifyCode(orderId: string): string {
    const timestamp = Date.now();
    const data = `${orderId}:${timestamp}`;
    const secret = process.env.VERIFY_SECRET || 'default-verify-secret';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex')
      .slice(0, 8);

    return Buffer.from(`${orderId}:${timestamp}:${signature}`).toString(
      'base64',
    );
  }

  /**
   * 验证核销码
   */
  validateVerifyCode(code: string): { valid: boolean; orderId?: string } {
    try {
      const decoded = Buffer.from(code, 'base64').toString();
      const [orderId, timestamp, signature] = decoded.split(':');

      // 验证时效 (7天内有效)
      const maxAge = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - parseInt(timestamp) > maxAge) {
        return { valid: false };
      }

      // 验证签名
      const secret = process.env.VERIFY_SECRET || 'default-verify-secret';
      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(`${orderId}:${timestamp}`)
        .digest('hex')
        .slice(0, 8);

      return { valid: signature === expectedSig, orderId };
    } catch {
      return { valid: false };
    }
  }

  /**
   * 创建订单
   */
  async createOrder(userId: string, dto: CreateOrderDto) {
    // 1. 查询报名记录
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: dto.enrollmentId },
      include: {
        activity: {
          include: {
            insuranceProduct: true,
            refundPolicy: true,
            club: true,
          },
        },
        order: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException('报名记录不存在');
    }

    // 2. 验证用户权限
    if (enrollment.userId !== userId) {
      throw new ForbiddenException('无权操作此报名记录');
    }

    // 3. 验证报名状态
    if (enrollment.status !== EnrollStatus.PENDING) {
      throw new BadRequestException('报名状态不正确，无法创建订单');
    }

    // 4. 检查是否已有订单
    if (enrollment.order) {
      // 如果已有未支付订单，检查是否过期
      if (
        enrollment.order.status === OrderStatus.PENDING &&
        enrollment.order.expiresAt > new Date()
      ) {
        return enrollment.order;
      }
    }

    // 5. 计算保险费用
    const activity = enrollment.activity;
    let insuranceFee = new Prisma.Decimal(0);
    let insuranceProductId: string | null = null;

    if (activity.insuranceProduct) {
      insuranceProductId = activity.insuranceProduct.id;
      // 按天计算保险费用
      const days = Math.ceil(
        (activity.endTime.getTime() - activity.startTime.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      insuranceFee = activity.insuranceProduct.price.mul(days);
    }

    // 6. 计算总金额
    const amount = enrollment.amount;
    const totalAmount = amount.add(insuranceFee);

    // 7. 计算过期时间
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.ORDER_TIMEOUT_MINUTES);

    // 8. 创建订单和保险记录
    const order = await this.prisma.$transaction(async (tx) => {
      // 创建订单
      const newOrder = await tx.order.create({
        data: {
          orderNo: this.generateOrderNo(),
          userId,
          activityId: activity.id,
          enrollmentId: dto.enrollmentId,
          amount,
          insuranceFee,
          totalAmount,
          expiresAt,
        },
        include: {
          activity: {
            select: {
              id: true,
              title: true,
              startTime: true,
              endTime: true,
              coverUrl: true,
            },
          },
          enrollment: true,
        },
      });

      // 如果有保险产品，创建保险记录
      if (insuranceProductId) {
        await tx.insurance.create({
          data: {
            orderId: newOrder.id,
            productId: insuranceProductId,
            amount: insuranceFee,
            insuredName: dto.insuredName,
            insuredIdCard: dto.insuredIdCard,
            insuredPhone: dto.insuredPhone,
            startDate: activity.startTime,
            endDate: activity.endTime,
            status: InsuranceStatus.PENDING,
          },
        });
      }

      return newOrder;
    });

    return order;
  }

  /**
   * 获取订单详情
   */
  async getOrderById(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            coverUrl: true,
            club: {
              select: {
                id: true,
                name: true,
                logo: true,
              },
            },
          },
        },
        enrollment: true,
        payment: true,
        refund: true,
        insurance: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('无权访问此订单');
    }

    return order;
  }

  /**
   * 获取用户订单列表
   */
  async getOrders(userId: string, query: QueryOrderDto) {
    const { status, activityId, page = 1, limit = 10 } = query;

    const where: Prisma.OrderWhereInput = {
      userId,
      ...(status && { status }),
      ...(activityId && { activityId }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          activity: {
            select: {
              id: true,
              title: true,
              startTime: true,
              coverUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 取消订单 (仅限待支付状态)
   */
  async cancelOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('无权操作此订单');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('只有待支付订单可以取消');
    }

    // 更新订单状态
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // 取消订单
      const cancelled = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      // 恢复报名状态为待处理 (可重新下单)
      await tx.enrollment.update({
        where: { id: order.enrollmentId },
        data: { status: EnrollStatus.PENDING },
      });

      return cancelled;
    });

    return updatedOrder;
  }

  /**
   * 获取订单核销码
   */
  async getVerifyCode(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        status: true,
        verifyCode: true,
      },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('无权访问此订单');
    }

    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException('只有已支付订单可以获取核销码');
    }

    // 如果已有核销码，直接返回
    if (order.verifyCode) {
      return { verifyCode: order.verifyCode };
    }

    // 生成新的核销码
    const verifyCode = this.generateVerifyCode(orderId);
    await this.prisma.order.update({
      where: { id: orderId },
      data: { verifyCode },
    });

    return { verifyCode };
  }

  /**
   * 支付成功后处理 (由 PaymentService 调用)
   */
  async handlePaymentSuccess(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { insurance: true },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PAYING) {
      throw new BadRequestException('订单状态不正确');
    }

    // 生成核销码
    const verifyCode = this.generateVerifyCode(orderId);

    // 更新订单和报名状态
    await this.prisma.$transaction(async (tx) => {
      // 更新订单状态
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PAID,
          paidAt: new Date(),
          verifyCode,
        },
      });

      // 更新报名状态
      await tx.enrollment.update({
        where: { id: order.enrollmentId },
        data: { status: EnrollStatus.PAID },
      });

      // 保险记录状态保持 PENDING (等待运营投保)
    });

    return { success: true, verifyCode };
  }

  /**
   * 超时取消订单 (由调度器调用)
   */
  async cancelExpiredOrders() {
    const expiredOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
    });

    for (const order of expiredOrders) {
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.CANCELLED,
            cancelledAt: new Date(),
          },
        });

        // 恢复报名状态
        await tx.enrollment.update({
          where: { id: order.enrollmentId },
          data: { status: EnrollStatus.PENDING },
        });
      });
    }

    return { cancelledCount: expiredOrders.length };
  }
}
