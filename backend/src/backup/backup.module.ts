import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';

/**
 * 数据库备份模块
 *
 * 功能:
 * - 定时自动备份 (每日凌晨 3:00)
 * - 云存储上传 (每周日凌晨 4:00)
 * - REST API 手动触发备份
 * - 备份清理 (默认保留 30 天)
 *
 * 环境变量配置:
 * - DATABASE_URL: PostgreSQL 连接字符串 (必需)
 * - BACKUP_DIR: 备份存储目录 (默认: ./backups)
 * - BACKUP_RETENTION: 备份保留天数 (默认: 30)
 * - S3_BUCKET: S3/OSS bucket 名称 (可选，用于云备份)
 * - S3_ENDPOINT: S3 端点 (可选，用于阿里云 OSS 等)
 * - AWS_ACCESS_KEY_ID: AWS/OSS Access Key (云备份需要)
 * - AWS_SECRET_ACCESS_KEY: AWS/OSS Secret Key (云备份需要)
 */
@Module({
  controllers: [BackupController],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}
