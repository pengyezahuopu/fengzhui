import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OrderStatus, EnrollStatus, ClubRole } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 验证核销码格式
   */
  private validateVerifyCode(code: string): { valid: boolean; orderId?: string } {
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
   * 检查用户是否有核销权限
   */
  private async checkVerifyPermission(
    userId: string,
    activityId: string,
  ): Promise<{ hasPermission: boolean; role?: string }> {
    // 查询活动信息
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        leader: true,
        club: {
          include: {
            members: {
              include: {
                leader: true,
              },
            },
          },
        },
      },
    });

    if (!activity) {
      return { hasPermission: false };
    }

    // 检查是否是活动领队
    if (activity.leader.userId === userId) {
      return { hasPermission: true, role: 'leader' };
    }

    // 检查是否是俱乐部管理员
    const member = activity.club.members.find((m) => m.leader?.userId === userId);
    if (member && (member.role === ClubRole.OWNER || member.role === ClubRole.ADMIN)) {
      return { hasPermission: true, role: 'club_admin' };
    }

    // 检查是否是系统管理员
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role === 'ADMIN') {
      return { hasPermission: true, role: 'system_admin' };
    }

    return { hasPermission: false };
  }

  /**
   * 扫码核销订单
   */
  async verifyOrder(verifierId: string, code: string, note?: string) {
    // 1. 验证核销码
    const validation = this.validateVerifyCode(code);
    if (!validation.valid || !validation.orderId) {
      throw new BadRequestException('核销码无效或已过期');
    }

    // 2. 查询订单
    const order = await this.prisma.order.findUnique({
      where: { id: validation.orderId },
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
          },
        },
        user: {
          select: {
            id: true,
            nickname: true,
            phone: true,
          },
        },
        enrollment: {
          select: {
            contactName: true,
            contactPhone: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 3. 检查核销权限
    const permission = await this.checkVerifyPermission(verifierId, order.activityId);
    if (!permission.hasPermission) {
      throw new ForbiddenException('无权核销此订单');
    }

    // 4. 检查订单状态
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException(`订单状态不正确: ${order.status}`);
    }

    // 5. 检查是否已核销
    if (order.verifiedAt) {
      throw new BadRequestException('订单已核销');
    }

    // 6. 检查核销码是否匹配
    if (order.verifyCode !== code) {
      throw new BadRequestException('核销码不匹配');
    }

    // 7. 执行核销
    const verifiedOrder = await this.prisma.$transaction(async (tx) => {
      // 更新订单核销状态
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          verifiedAt: new Date(),
          verifiedBy: verifierId,
        },
        include: {
          activity: {
            select: {
              id: true,
              title: true,
              startTime: true,
            },
          },
          user: {
            select: {
              id: true,
              nickname: true,
            },
          },
          enrollment: {
            select: {
              contactName: true,
            },
          },
        },
      });

      // 更新报名状态为已签到
      await tx.enrollment.update({
        where: { id: order.enrollmentId },
        data: { status: EnrollStatus.CHECKED_IN },
      });

      return updated;
    });

    this.logger.log(
      `Order verified: ${order.id} by ${verifierId} (${permission.role})`,
    );

    return {
      success: true,
      order: {
        id: verifiedOrder.id,
        orderNo: verifiedOrder.orderNo,
        contactName: verifiedOrder.enrollment.contactName,
        userName: verifiedOrder.user.nickname,
        activity: verifiedOrder.activity,
        verifiedAt: verifiedOrder.verifiedAt,
      },
    };
  }

  /**
   * 获取活动的核销统计
   */
  async getActivityVerificationStats(verifierId: string, activityId: string) {
    // 检查权限
    const permission = await this.checkVerifyPermission(verifierId, activityId);
    if (!permission.hasPermission) {
      throw new ForbiddenException('无权查看此活动的核销信息');
    }

    // 获取活动信息
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      select: {
        id: true,
        title: true,
        startTime: true,
        maxPeople: true,
      },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    // 统计核销情况
    const [total, verified, pending] = await Promise.all([
      // 总已支付订单数
      this.prisma.order.count({
        where: {
          activityId,
          status: OrderStatus.PAID,
        },
      }),
      // 已核销订单数
      this.prisma.order.count({
        where: {
          activityId,
          status: OrderStatus.PAID,
          verifiedAt: { not: null },
        },
      }),
      // 待核销订单数
      this.prisma.order.count({
        where: {
          activityId,
          status: OrderStatus.PAID,
          verifiedAt: null,
        },
      }),
    ]);

    return {
      activity,
      stats: {
        total,
        verified,
        pending,
        verifiedRate: total > 0 ? Math.round((verified / total) * 100) : 0,
      },
    };
  }

  /**
   * 获取活动的核销列表
   */
  async getActivityVerifications(
    verifierId: string,
    activityId: string,
    status: 'pending' | 'verified' | 'all' = 'all',
  ) {
    // 检查权限
    const permission = await this.checkVerifyPermission(verifierId, activityId);
    if (!permission.hasPermission) {
      throw new ForbiddenException('无权查看此活动的核销信息');
    }

    // 构建查询条件
    const where: {
      activityId: string;
      status: OrderStatus;
      verifiedAt?: { not?: null } | null;
    } = {
      activityId,
      status: OrderStatus.PAID,
    };

    if (status === 'pending') {
      where.verifiedAt = null;
    } else if (status === 'verified') {
      where.verifiedAt = { not: null };
    }

    // 查询订单列表
    const orders = await this.prisma.order.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            phone: true,
          },
        },
        enrollment: {
          select: {
            contactName: true,
            contactPhone: true,
          },
        },
      },
      orderBy: [
        { verifiedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return orders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      contactName: order.enrollment.contactName,
      contactPhone: order.enrollment.contactPhone,
      user: order.user,
      paidAt: order.paidAt,
      verifiedAt: order.verifiedAt,
      verifiedBy: order.verifiedBy,
    }));
  }

  /**
   * 获取领队/管理员待核销的活动列表
   */
  async getPendingVerificationActivities(userId: string) {
    // 获取用户有权限核销的活动
    const now = new Date();
    const twoDaysLater = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    // 查询用户作为领队的活动
    const leaderActivities = await this.prisma.activity.findMany({
      where: {
        leader: { userId },
        startTime: { lte: twoDaysLater },
        endTime: { gte: now },
        orders: {
          some: {
            status: OrderStatus.PAID,
            verifiedAt: null,
          },
        },
      },
      include: {
        _count: {
          select: {
            orders: {
              where: {
                status: OrderStatus.PAID,
                verifiedAt: null,
              },
            },
          },
        },
        club: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // 查询用户作为俱乐部管理员的活动
    const clubMemberships = await this.prisma.clubMember.findMany({
      where: {
        leader: { userId },
        role: { in: [ClubRole.OWNER, ClubRole.ADMIN] },
      },
      select: { clubId: true },
    });

    const clubIds = clubMemberships.map((m) => m.clubId);

    const adminActivities =
      clubIds.length > 0
        ? await this.prisma.activity.findMany({
            where: {
              clubId: { in: clubIds },
              leader: { userId: { not: userId } },
              startTime: { lte: twoDaysLater },
              endTime: { gte: now },
              orders: {
                some: {
                  status: OrderStatus.PAID,
                  verifiedAt: null,
                },
              },
            },
            include: {
              _count: {
                select: {
                  orders: {
                    where: {
                      status: OrderStatus.PAID,
                      verifiedAt: null,
                    },
                  },
                },
              },
              club: {
                select: {
                  id: true,
                  name: true,
                },
              },
              leader: {
                select: {
                  realName: true,
                },
              },
            },
          })
        : [];

    // 合并并格式化结果
    const activities = [
      ...leaderActivities.map((a) => ({
        id: a.id,
        title: a.title,
        startTime: a.startTime,
        endTime: a.endTime,
        club: a.club,
        pendingCount: a._count.orders,
        role: 'leader' as const,
      })),
      ...adminActivities.map((a) => ({
        id: a.id,
        title: a.title,
        startTime: a.startTime,
        endTime: a.endTime,
        club: a.club,
        leaderName: a.leader.realName,
        pendingCount: a._count.orders,
        role: 'admin' as const,
      })),
    ];

    // 按开始时间排序
    activities.sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    return activities;
  }

  /**
   * 根据订单号快速核销
   */
  async verifyByOrderNo(verifierId: string, orderNo: string) {
    // 查询订单获取核销码
    const order = await this.prisma.order.findUnique({
      where: { orderNo },
      select: {
        id: true,
        verifyCode: true,
        activityId: true,
        status: true,
        verifiedAt: true,
      },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    if (!order.verifyCode) {
      throw new BadRequestException('订单没有核销码');
    }

    // 使用核销码进行核销
    return this.verifyOrder(verifierId, order.verifyCode);
  }
}
