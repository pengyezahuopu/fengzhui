import {
  Controller,
  Post,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { BackupService } from './backup.service';
import { SkipThrottle } from '../common/throttler';

// TODO: 添加管理员守卫
// import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('系统管理')
@Controller('admin/backup')
@ApiBearerAuth('JWT')
// @UseGuards(AdminGuard) // 生产环境需要启用
@SkipThrottle()
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '创建数据库备份' })
  @ApiQuery({
    name: 'type',
    enum: ['full', 'schema', 'data'],
    required: false,
    description: '备份类型',
  })
  @ApiQuery({
    name: 'upload',
    type: Boolean,
    required: false,
    description: '是否上传到云存储',
  })
  @ApiResponse({
    status: 200,
    description: '备份创建成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        filename: { type: 'string' },
        size: { type: 'string' },
        duration: { type: 'number' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 500, description: '备份失败' })
  async createBackup(
    @Query('type') type: 'full' | 'schema' | 'data' = 'full',
    @Query('upload') upload = false,
  ) {
    return this.backupService.createBackup(type, upload);
  }

  @Get('list')
  @ApiOperation({ summary: '获取备份列表' })
  @ApiResponse({
    status: 200,
    description: '备份列表',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          filename: { type: 'string' },
          size: { type: 'number' },
          sizeFormatted: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          type: { type: 'string', enum: ['full', 'schema', 'data'] },
        },
      },
    },
  })
  listBackups() {
    return this.backupService.listBackups();
  }

  @Get('stats')
  @ApiOperation({ summary: '获取备份统计信息' })
  @ApiResponse({
    status: 200,
    description: '备份统计',
    schema: {
      type: 'object',
      properties: {
        totalBackups: { type: 'number' },
        totalSize: { type: 'string' },
        latestBackup: {
          type: 'object',
          nullable: true,
          properties: {
            filename: { type: 'string' },
            sizeFormatted: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        retentionDays: { type: 'number' },
      },
    },
  })
  getStats() {
    return this.backupService.getBackupStats();
  }

  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '清理过期备份' })
  @ApiResponse({
    status: 200,
    description: '清理结果',
    schema: {
      type: 'object',
      properties: {
        deletedCount: { type: 'number' },
      },
    },
  })
  async cleanup() {
    const deletedCount = await this.backupService.cleanupOldBackups();
    return { deletedCount };
  }
}
