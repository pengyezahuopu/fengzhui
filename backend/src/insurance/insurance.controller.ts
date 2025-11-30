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
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { InsuranceService } from './insurance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateInsuranceProductDto,
  UpdateInsuranceProductDto,
  UpdatePolicyDto,
  ExportInsuranceQuery,
} from './dto';

@Controller('insurances')
@UseGuards(JwtAuthGuard)
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  // ==================== 保险产品 (公开) ====================

  /**
   * 获取保险产品列表
   * GET /insurances/products
   */
  @Get('products')
  async getProducts(@Query('includeInactive') includeInactive?: string) {
    return this.insuranceService.getProducts(includeInactive === 'true');
  }

  /**
   * 获取保险产品详情
   * GET /insurances/products/:id
   */
  @Get('products/:id')
  async getProductById(@Param('id') productId: string) {
    return this.insuranceService.getProductById(productId);
  }

  // ==================== 保险产品管理 (管理员) ====================

  /**
   * 创建保险产品 (管理员)
   * POST /insurances/products
   */
  @Post('products')
  async createProduct(@Body() dto: CreateInsuranceProductDto) {
    // TODO: 添加管理员权限校验
    return this.insuranceService.createProduct(dto);
  }

  /**
   * 更新保险产品 (管理员)
   * PUT /insurances/products/:id
   */
  @Put('products/:id')
  async updateProduct(
    @Param('id') productId: string,
    @Body() dto: UpdateInsuranceProductDto,
  ) {
    // TODO: 添加管理员权限校验
    return this.insuranceService.updateProduct(productId, dto);
  }

  // ==================== 用户保险记录 ====================

  /**
   * 获取用户保险列表
   * GET /insurances/my
   */
  @Get('my')
  async getMyInsurances(@Req() req: Request) {
    const userId = req['user'].userId;
    return this.insuranceService.getUserInsurances(userId);
  }

  /**
   * 获取保险详情
   * GET /insurances/:id
   */
  @Get(':id')
  async getInsuranceById(@Req() req: Request, @Param('id') insuranceId: string) {
    const userId = req['user'].userId;
    return this.insuranceService.getInsuranceById(userId, insuranceId);
  }

  // ==================== 运营管理 ====================

  /**
   * 获取待投保列表 (运营)
   * GET /insurances/pending
   */
  @Get('admin/pending')
  async getPendingInsurances(@Query() query: ExportInsuranceQuery) {
    // TODO: 添加运营权限校验
    return this.insuranceService.getPendingInsurances(query);
  }

  /**
   * 导出待投保数据 (运营)
   * GET /insurances/admin/export
   */
  @Get('admin/export')
  async exportPendingInsurances(
    @Query() query: ExportInsuranceQuery,
    @Res() res: Response,
  ) {
    // TODO: 添加运营权限校验
    const { headers, rows, total } =
      await this.insuranceService.exportPendingInsurances(query);

    // 生成CSV内容
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((cell) => {
            const str = String(cell);
            // 如果包含逗号或引号，需要用引号包裹并转义
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(','),
      ),
    ].join('\n');

    // 添加BOM以支持Excel正确识别中文
    const bom = '\uFEFF';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="pending-insurances-${new Date().toISOString().split('T')[0]}.csv"`,
    );
    res.send(bom + csvContent);
  }

  /**
   * 回填保单号 (运营)
   * PUT /insurances/:id/policy
   */
  @Put(':id/policy')
  async updatePolicy(
    @Param('id') insuranceId: string,
    @Body() dto: UpdatePolicyDto,
  ) {
    // TODO: 添加运营权限校验
    return this.insuranceService.updatePolicy(insuranceId, dto);
  }

  /**
   * 批量回填保单号 (运营)
   * POST /insurances/admin/batch-policy
   */
  @Post('admin/batch-policy')
  async batchUpdatePolicies(
    @Body()
    updates: Array<{ insuranceId: string; policyNo: string; policyUrl?: string }>,
  ) {
    // TODO: 添加运营权限校验
    return this.insuranceService.batchUpdatePolicies(updates);
  }

  /**
   * 获取保险统计 (管理员)
   * GET /insurances/admin/stats
   */
  @Get('admin/stats')
  async getInsuranceStats() {
    // TODO: 添加管理员权限校验
    return this.insuranceService.getInsuranceStats();
  }
}
