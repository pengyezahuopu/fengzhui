#!/bin/bash
#
# 风追数据库备份脚本
# 功能: 使用 pg_dump 备份 PostgreSQL 数据库，支持本地存储和 S3/OSS 上传
#
# 使用方法:
#   ./backup-database.sh                    # 完整备份
#   ./backup-database.sh --schema-only      # 仅备份结构
#   ./backup-database.sh --data-only        # 仅备份数据
#   ./backup-database.sh --upload           # 备份并上传到云存储
#
# 环境变量:
#   DATABASE_URL       - PostgreSQL 连接字符串 (必需)
#   BACKUP_DIR         - 备份目录 (默认: ./backups)
#   BACKUP_RETENTION   - 保留天数 (默认: 30)
#   S3_BUCKET          - S3/OSS bucket 名称
#   S3_ENDPOINT        - S3 端点 (用于阿里云 OSS 等)
#   AWS_ACCESS_KEY_ID  - AWS/OSS Access Key
#   AWS_SECRET_ACCESS_KEY - AWS/OSS Secret Key

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"; }

# 默认配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/../backups}"
BACKUP_RETENTION="${BACKUP_RETENTION:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_TYPE="full"
UPLOAD_TO_CLOUD=false

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --schema-only)
            BACKUP_TYPE="schema"
            shift
            ;;
        --data-only)
            BACKUP_TYPE="data"
            shift
            ;;
        --upload)
            UPLOAD_TO_CLOUD=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --schema-only    Backup schema only (no data)"
            echo "  --data-only      Backup data only (no schema)"
            echo "  --upload         Upload backup to S3/OSS after completion"
            echo "  --help, -h       Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# 检查必需的环境变量
if [[ -z "${DATABASE_URL:-}" ]]; then
    # 尝试从 .env 文件加载
    if [[ -f "$SCRIPT_DIR/../.env" ]]; then
        log_info "Loading environment from .env file..."
        export $(grep -v '^#' "$SCRIPT_DIR/../.env" | xargs)
    fi

    if [[ -z "${DATABASE_URL:-}" ]]; then
        log_error "DATABASE_URL environment variable is required"
        exit 1
    fi
fi

# 解析 DATABASE_URL
# 格式: postgresql://user:password@host:port/database?schema=public
parse_database_url() {
    local url="$1"
    # 移除 postgresql:// 前缀
    url="${url#postgresql://}"
    url="${url#postgres://}"

    # 提取用户名和密码
    local userpass="${url%%@*}"
    PGUSER="${userpass%%:*}"
    PGPASSWORD="${userpass#*:}"

    # 提取主机和端口
    local hostport="${url#*@}"
    hostport="${hostport%%/*}"
    PGHOST="${hostport%%:*}"
    PGPORT="${hostport#*:}"
    PGPORT="${PGPORT%%\?*}"

    # 提取数据库名
    local dbname="${url#*/}"
    PGDATABASE="${dbname%%\?*}"

    export PGUSER PGPASSWORD PGHOST PGPORT PGDATABASE
}

parse_database_url "$DATABASE_URL"

log_info "Database: $PGDATABASE @ $PGHOST:$PGPORT"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 生成备份文件名
BACKUP_FILE="fengzhui_${BACKUP_TYPE}_${TIMESTAMP}.sql"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"
COMPRESSED_PATH="${BACKUP_PATH}.gz"

# 构建 pg_dump 命令参数
PGDUMP_OPTS="-h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE"
PGDUMP_OPTS="$PGDUMP_OPTS --no-owner --no-acl"  # 便于恢复到不同用户

case $BACKUP_TYPE in
    schema)
        PGDUMP_OPTS="$PGDUMP_OPTS --schema-only"
        ;;
    data)
        PGDUMP_OPTS="$PGDUMP_OPTS --data-only"
        ;;
    full)
        # 默认完整备份
        ;;
esac

# 执行备份
log_info "Starting $BACKUP_TYPE backup..."
log_info "Output: $COMPRESSED_PATH"

START_TIME=$(date +%s)

# 执行 pg_dump 并压缩
PGPASSWORD="$PGPASSWORD" pg_dump $PGDUMP_OPTS | gzip > "$COMPRESSED_PATH"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
FILE_SIZE=$(du -h "$COMPRESSED_PATH" | cut -f1)

log_info "Backup completed in ${DURATION}s"
log_info "Backup size: $FILE_SIZE"

# 生成校验和
CHECKSUM=$(sha256sum "$COMPRESSED_PATH" | cut -d' ' -f1)
echo "$CHECKSUM  $BACKUP_FILE.gz" > "${COMPRESSED_PATH}.sha256"
log_info "Checksum: $CHECKSUM"

# 上传到云存储
if [[ "$UPLOAD_TO_CLOUD" == true ]]; then
    if [[ -z "${S3_BUCKET:-}" ]]; then
        log_warn "S3_BUCKET not set, skipping upload"
    else
        log_info "Uploading to cloud storage..."

        S3_PATH="s3://${S3_BUCKET}/backups/database/${BACKUP_FILE}.gz"

        # 构建 AWS CLI 命令
        AWS_OPTS=""
        if [[ -n "${S3_ENDPOINT:-}" ]]; then
            AWS_OPTS="--endpoint-url $S3_ENDPOINT"
        fi

        # 上传备份文件
        aws s3 cp $AWS_OPTS "$COMPRESSED_PATH" "$S3_PATH"
        aws s3 cp $AWS_OPTS "${COMPRESSED_PATH}.sha256" "${S3_PATH}.sha256"

        log_info "Uploaded to $S3_PATH"
    fi
fi

# 清理旧备份
log_info "Cleaning up backups older than $BACKUP_RETENTION days..."
DELETED_COUNT=$(find "$BACKUP_DIR" -name "fengzhui_*.sql.gz" -mtime +$BACKUP_RETENTION -delete -print | wc -l)
find "$BACKUP_DIR" -name "fengzhui_*.sql.gz.sha256" -mtime +$BACKUP_RETENTION -delete

if [[ $DELETED_COUNT -gt 0 ]]; then
    log_info "Deleted $DELETED_COUNT old backup(s)"
fi

# 列出现有备份
log_info "Current backups:"
ls -lh "$BACKUP_DIR"/*.gz 2>/dev/null | tail -5 || log_warn "No backups found"

log_info "Backup process completed successfully!"

# 输出恢复命令提示
echo ""
echo "To restore this backup, run:"
echo "  gunzip -c $COMPRESSED_PATH | psql -h <host> -U <user> -d <database>"
