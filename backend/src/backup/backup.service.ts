import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

export interface BackupResult {
  success: boolean;
  filename?: string;
  size?: string;
  duration?: number;
  error?: string;
  timestamp: Date;
}

export interface BackupInfo {
  filename: string;
  size: number;
  sizeFormatted: string;
  createdAt: Date;
  type: 'full' | 'schema' | 'data';
}

@Injectable()
export class BackupService implements OnModuleInit {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir: string;
  private readonly retentionDays: number;

  constructor() {
    this.backupDir = process.env.BACKUP_DIR || join(process.cwd(), 'backups');
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION || '30', 10);
  }

  onModuleInit() {
    // 确保备份目录存在
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
      this.logger.log(`Created backup directory: ${this.backupDir}`);
    }
  }

  /**
   * 每日凌晨 3:00 执行自动备份
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledBackup(): Promise<void> {
    this.logger.log('Starting scheduled daily backup...');
    const result = await this.createBackup('full');

    if (result.success) {
      this.logger.log(
        `Scheduled backup completed: ${result.filename} (${result.size})`,
      );
    } else {
      this.logger.error(`Scheduled backup failed: ${result.error}`);
    }

    // 执行清理
    await this.cleanupOldBackups();
  }

  /**
   * 每周日凌晨 4:00 执行完整备份并上传到云存储
   */
  @Cron('0 4 * * 0')
  async weeklyCloudBackup(): Promise<void> {
    if (!process.env.S3_BUCKET) {
      this.logger.debug('S3_BUCKET not configured, skipping cloud backup');
      return;
    }

    this.logger.log('Starting weekly cloud backup...');
    const result = await this.createBackup('full', true);

    if (result.success) {
      this.logger.log(
        `Weekly cloud backup completed: ${result.filename} (${result.size})`,
      );
    } else {
      this.logger.error(`Weekly cloud backup failed: ${result.error}`);
    }
  }

  /**
   * 创建数据库备份
   */
  async createBackup(
    type: 'full' | 'schema' | 'data' = 'full',
    uploadToCloud = false,
  ): Promise<BackupResult> {
    const startTime = Date.now();
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '_')
      .slice(0, 15);
    const filename = `fengzhui_${type}_${timestamp}.sql.gz`;
    const filepath = join(this.backupDir, filename);

    try {
      // 解析数据库连接信息
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new Error('DATABASE_URL environment variable is required');
      }

      const dbConfig = this.parseDatabaseUrl(dbUrl);

      // 构建 pg_dump 命令
      let pgDumpOpts = `--no-owner --no-acl`;
      if (type === 'schema') {
        pgDumpOpts += ' --schema-only';
      } else if (type === 'data') {
        pgDumpOpts += ' --data-only';
      }

      const command = `PGPASSWORD="${dbConfig.password}" pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} ${pgDumpOpts} | gzip > "${filepath}"`;

      this.logger.debug(`Executing backup command for ${type} backup...`);
      await execAsync(command, {
        env: { ...process.env, PGPASSWORD: dbConfig.password },
        timeout: 30 * 60 * 1000, // 30 分钟超时
      });

      // 获取文件大小
      const stats = statSync(filepath);
      const sizeFormatted = this.formatBytes(stats.size);

      // 上传到云存储
      if (uploadToCloud && process.env.S3_BUCKET) {
        await this.uploadToCloud(filepath, filename);
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        filename,
        size: sizeFormatted,
        duration,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Backup failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date(),
      };
    }
  }

  /**
   * 上传备份到云存储
   */
  private async uploadToCloud(
    filepath: string,
    filename: string,
  ): Promise<void> {
    const bucket = process.env.S3_BUCKET;
    const endpoint = process.env.S3_ENDPOINT;

    let awsOpts = '';
    if (endpoint) {
      awsOpts = `--endpoint-url ${endpoint}`;
    }

    const s3Path = `s3://${bucket}/backups/database/${filename}`;
    const command = `aws s3 cp ${awsOpts} "${filepath}" "${s3Path}"`;

    this.logger.debug(`Uploading to ${s3Path}...`);
    await execAsync(command, { timeout: 10 * 60 * 1000 });
    this.logger.log(`Uploaded backup to ${s3Path}`);
  }

  /**
   * 清理过期备份
   */
  async cleanupOldBackups(): Promise<number> {
    const cutoffTime = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    try {
      const files = readdirSync(this.backupDir);

      for (const file of files) {
        if (!file.startsWith('fengzhui_') || !file.endsWith('.gz')) {
          continue;
        }

        const filepath = join(this.backupDir, file);
        const stats = statSync(filepath);

        if (stats.mtimeMs < cutoffTime) {
          unlinkSync(filepath);
          // 同时删除校验和文件
          const checksumPath = `${filepath}.sha256`;
          if (existsSync(checksumPath)) {
            unlinkSync(checksumPath);
          }
          deletedCount++;
          this.logger.debug(`Deleted old backup: ${file}`);
        }
      }

      if (deletedCount > 0) {
        this.logger.log(`Cleaned up ${deletedCount} old backup(s)`);
      }
    } catch (error) {
      this.logger.error(`Cleanup failed: ${error}`);
    }

    return deletedCount;
  }

  /**
   * 列出所有备份
   */
  listBackups(): BackupInfo[] {
    const backups: BackupInfo[] = [];

    try {
      const files = readdirSync(this.backupDir);

      for (const file of files) {
        if (!file.startsWith('fengzhui_') || !file.endsWith('.gz')) {
          continue;
        }

        const filepath = join(this.backupDir, file);
        const stats = statSync(filepath);

        // 解析备份类型
        let type: 'full' | 'schema' | 'data' = 'full';
        if (file.includes('_schema_')) {
          type = 'schema';
        } else if (file.includes('_data_')) {
          type = 'data';
        }

        backups.push({
          filename: file,
          size: stats.size,
          sizeFormatted: this.formatBytes(stats.size),
          createdAt: stats.mtime,
          type,
        });
      }

      // 按时间倒序排列
      backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      this.logger.error(`Failed to list backups: ${error}`);
    }

    return backups;
  }

  /**
   * 获取备份统计信息
   */
  getBackupStats(): {
    totalBackups: number;
    totalSize: string;
    latestBackup: BackupInfo | null;
    retentionDays: number;
  } {
    const backups = this.listBackups();
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

    return {
      totalBackups: backups.length,
      totalSize: this.formatBytes(totalSize),
      latestBackup: backups[0] || null,
      retentionDays: this.retentionDays,
    };
  }

  /**
   * 解析 DATABASE_URL
   */
  private parseDatabaseUrl(url: string): {
    host: string;
    port: string;
    user: string;
    password: string;
    database: string;
  } {
    // postgresql://user:password@host:port/database?schema=public
    const match = url.match(
      /postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/,
    );

    if (!match) {
      throw new Error('Invalid DATABASE_URL format');
    }

    return {
      user: match[1],
      password: match[2],
      host: match[3],
      port: match[4],
      database: match[5],
    };
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
