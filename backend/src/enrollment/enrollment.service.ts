import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EnrollStatus, ActivityStatus } from '@prisma/client';

@Injectable()
export class EnrollmentService {
  constructor(private prisma: PrismaService) {}

  // 创建报名
  async createEnrollment(data: {
    activityId: string;
    userId: string;
    contactName: string;
    contactPhone: string;
  }) {
    // 检查活动是否存在且可报名
    const activity = await this.prisma.activity.findUnique({
      where: { id: data.activityId },
      include: {
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    if (activity.status !== ActivityStatus.PUBLISHED) {
      throw new BadRequestException('Activity is not open for enrollment');
    }

    // 检查是否已满员
    if (activity._count.enrollments >= activity.maxPeople) {
      throw new BadRequestException('Activity is full');
    }

    // 检查用户是否已报名
    const existingEnrollment = await this.prisma.enrollment.findFirst({
      where: {
        activityId: data.activityId,
        userId: data.userId,
        status: {
          notIn: [EnrollStatus.CANCELLED, EnrollStatus.REFUNDED],
        },
      },
    });

    if (existingEnrollment) {
      throw new ConflictException('User has already enrolled in this activity');
    }

    // 创建报名记录
    const enrollment = await this.prisma.enrollment.create({
      data: {
        activityId: data.activityId,
        userId: data.userId,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        amount: activity.price,
        status: EnrollStatus.PENDING,
      },
      include: {
        activity: true,
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
          },
        },
      },
    });

    // 检查是否需要更新活动状态为满员
    const newCount = activity._count.enrollments + 1;
    if (newCount >= activity.maxPeople) {
      await this.prisma.activity.update({
        where: { id: data.activityId },
        data: { status: ActivityStatus.FULL },
      });
    }

    return enrollment;
  }

  // 获取报名详情
  async getEnrollmentById(id: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      include: {
        activity: {
          include: {
            route: true,
            club: true,
            leader: {
              include: {
                user: {
                  select: {
                    nickname: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            phone: true,
          },
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with ID ${id} not found`);
    }

    return enrollment;
  }

  // 取消报名
  async cancelEnrollment(id: string, userId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      include: { activity: true },
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with ID ${id} not found`);
    }

    if (enrollment.userId !== userId) {
      throw new BadRequestException('You can only cancel your own enrollment');
    }

    if (
      enrollment.status === EnrollStatus.CANCELLED ||
      enrollment.status === EnrollStatus.REFUNDED
    ) {
      throw new BadRequestException('Enrollment is already cancelled');
    }

    // 检查活动是否已开始
    if (new Date() >= enrollment.activity.startTime) {
      throw new BadRequestException(
        'Cannot cancel enrollment after activity has started',
      );
    }

    const updated = await this.prisma.enrollment.update({
      where: { id },
      data: { status: EnrollStatus.CANCELLED },
    });

    // 如果活动之前是满员状态，恢复为可报名
    if (enrollment.activity.status === ActivityStatus.FULL) {
      await this.prisma.activity.update({
        where: { id: enrollment.activityId },
        data: { status: ActivityStatus.PUBLISHED },
      });
    }

    return updated;
  }

  // 确认支付（模拟）
  async confirmPayment(id: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with ID ${id} not found`);
    }

    if (enrollment.status !== EnrollStatus.PENDING) {
      throw new BadRequestException('Only pending enrollments can be paid');
    }

    return this.prisma.enrollment.update({
      where: { id },
      data: { status: EnrollStatus.PAID },
    });
  }

  // 签到
  async checkIn(id: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with ID ${id} not found`);
    }

    if (enrollment.status !== EnrollStatus.PAID) {
      throw new BadRequestException('Only paid enrollments can be checked in');
    }

    return this.prisma.enrollment.update({
      where: { id },
      data: { status: EnrollStatus.CHECKED_IN },
    });
  }

  // 获取活动的所有报名
  async getActivityEnrollments(activityId: string) {
    return this.prisma.enrollment.findMany({
      where: { activityId },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // 获取用户的所有报名
  async getUserEnrollments(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId },
      include: {
        activity: {
          include: {
            route: true,
            club: {
              select: {
                id: true,
                name: true,
                logo: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
