import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateInsuranceProductDto,
  UpdateInsuranceProductDto,
  UpdatePolicyDto,
} from './dto';
import { InsuranceStatus, Prisma } from '@prisma/client';

@Injectable()
export class InsuranceService {
  private readonly logger = new Logger(InsuranceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== 保险产品管理 (管理员) ====================

  /**
   * 获取所有保险产品
   */
  async getProducts(includeInactive = false) {
    return this.prisma.insuranceProduct.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * 获取保险产品详情
   */
  async getProductById(productId: string) {
    const product = await this.prisma.insuranceProduct.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('保险产品不存在');
    }

    return product;
  }

  /**
   * 创建保险产品 (管理员)
   */
  async createProduct(dto: CreateInsuranceProductDto) {
    return this.prisma.insuranceProduct.create({
      data: {
        name: dto.name,
        provider: dto.provider,
        description: dto.description,
        price: new Prisma.Decimal(dto.price),
        priceUnit: dto.priceUnit || 'PER_PERSON_DAY',
        coverage: dto.coverage,
        maxCompensation: dto.maxCompensation
          ? new Prisma.Decimal(dto.maxCompensation)
          : null,
      },
    });
  }

  /**
   * 更新保险产品 (管理员)
   */
  async updateProduct(productId: string, dto: UpdateInsuranceProductDto) {
    const product = await this.getProductById(productId);

    return this.prisma.insuranceProduct.update({
      where: { id: productId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.price !== undefined && {
          price: new Prisma.Decimal(dto.price),
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  // ==================== 保险记录管理 ====================

  /**
   * 获取用户的保险记录
   */
  async getUserInsurances(userId: string) {
    return this.prisma.insurance.findMany({
      where: {
        order: { userId },
      },
      include: {
        product: true,
        order: {
          include: {
            activity: {
              select: { id: true, title: true, startTime: true, endTime: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 获取保险详情
   */
  async getInsuranceById(userId: string, insuranceId: string) {
    const insurance = await this.prisma.insurance.findUnique({
      where: { id: insuranceId },
      include: {
        product: true,
        order: {
          include: {
            activity: {
              select: {
                id: true,
                title: true,
                startTime: true,
                endTime: true,
                club: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!insurance) {
      throw new NotFoundException('保险记录不存在');
    }

    if (insurance.order.userId !== userId) {
      throw new ForbiddenException('无权访问此保险记录');
    }

    return insurance;
  }

  // ==================== 运营管理功能 ====================

  /**
   * 获取待投保列表 (运营导出)
   */
  async getPendingInsurances(query: { startDate?: string; endDate?: string }) {
    const where: Prisma.InsuranceWhereInput = {
      status: InsuranceStatus.PENDING,
      policyNo: null, // 尚未回填保单号的
    };

    // 按活动开始时间过滤
    if (query.startDate || query.endDate) {
      where.startDate = {};
      if (query.startDate) {
        where.startDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.startDate.lte = new Date(query.endDate);
      }
    }

    return this.prisma.insurance.findMany({
      where,
      include: {
        product: { select: { name: true, provider: true } },
        order: {
          include: {
            user: { select: { id: true, nickname: true, phone: true } },
            activity: {
              select: {
                id: true,
                title: true,
                startTime: true,
                endTime: true,
                club: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  /**
   * 导出待投保数据 (CSV格式)
   */
  async exportPendingInsurances(query: { startDate?: string; endDate?: string }) {
    const insurances = await this.getPendingInsurances(query);

    // 构建CSV数据
    const headers = [
      '序号',
      '保险产品',
      '保险公司',
      '被保险人姓名',
      '被保险人电话',
      '身份证号',
      '保障开始时间',
      '保障结束时间',
      '活动名称',
      '俱乐部',
      '保险金额',
      '订单号',
    ];

    const rows = insurances.map((ins, index) => [
      index + 1,
      ins.product.name,
      ins.product.provider,
      ins.insuredName,
      ins.insuredPhone,
      ins.insuredIdCard || '',
      ins.startDate.toISOString().split('T')[0],
      ins.endDate.toISOString().split('T')[0],
      ins.order.activity.title,
      ins.order.activity.club?.name || '',
      ins.amount.toNumber(),
      ins.order.orderNo,
    ]);

    return {
      headers,
      rows,
      total: insurances.length,
    };
  }

  /**
   * 回填保单号 (运营)
   */
  async updatePolicy(insuranceId: string, dto: UpdatePolicyDto) {
    const insurance = await this.prisma.insurance.findUnique({
      where: { id: insuranceId },
    });

    if (!insurance) {
      throw new NotFoundException('保险记录不存在');
    }

    const updated = await this.prisma.insurance.update({
      where: { id: insuranceId },
      data: {
        policyNo: dto.policyNo,
        policyUrl: dto.policyUrl,
        status: InsuranceStatus.ACTIVE,
      },
    });

    this.logger.log(
      `Insurance policy updated: ${insuranceId}, policyNo: ${dto.policyNo}`,
    );

    return updated;
  }

  /**
   * 批量回填保单号 (运营)
   */
  async batchUpdatePolicies(
    updates: Array<{ insuranceId: string; policyNo: string; policyUrl?: string }>,
  ) {
    const results = await Promise.all(
      updates.map((update) =>
        this.updatePolicy(update.insuranceId, {
          policyNo: update.policyNo,
          policyUrl: update.policyUrl,
        }),
      ),
    );

    return {
      success: results.length,
      total: updates.length,
    };
  }

  /**
   * 更新过期保险状态
   */
  async updateExpiredInsurances() {
    const now = new Date();

    const result = await this.prisma.insurance.updateMany({
      where: {
        status: InsuranceStatus.ACTIVE,
        endDate: { lt: now },
      },
      data: {
        status: InsuranceStatus.EXPIRED,
      },
    });

    if (result.count > 0) {
      this.logger.log(`Updated ${result.count} expired insurances`);
    }

    return { updatedCount: result.count };
  }

  /**
   * 获取保险统计 (管理员)
   */
  async getInsuranceStats() {
    const [pending, active, expired, claimed, totalAmount] = await Promise.all([
      this.prisma.insurance.count({ where: { status: InsuranceStatus.PENDING } }),
      this.prisma.insurance.count({ where: { status: InsuranceStatus.ACTIVE } }),
      this.prisma.insurance.count({ where: { status: InsuranceStatus.EXPIRED } }),
      this.prisma.insurance.count({ where: { status: InsuranceStatus.CLAIMED } }),
      this.prisma.insurance.aggregate({
        _sum: { amount: true },
        where: {
          status: { in: [InsuranceStatus.ACTIVE, InsuranceStatus.EXPIRED] },
        },
      }),
    ]);

    return {
      pending,
      active,
      expired,
      claimed,
      totalAmount: totalAmount._sum.amount?.toNumber() || 0,
    };
  }
}
