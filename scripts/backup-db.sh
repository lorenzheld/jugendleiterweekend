#!/bin/bash
###############################################################################
# Automated Database Backup Script
###############################################################################
# Run this script via cron for regular backups
# Example crontab: 0 2 * * * /opt/jlw2026/scripts/backup-db.sh
###############################################################################

set -e

# Configuration
PROJECT_DIR="/opt/jlw2026"
BACKUP_DIR="${PROJECT_DIR}/backups"
DOCKER_COMPOSE_FILE="docker-compose.production.yml"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-jugendleiter2026}"
RETENTION_DAYS=30  # Keep backups for 30 days

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql.gz"

# Create backup
echo "[$(date)] Starting database backup..."

cd "$PROJECT_DIR"

# Check if postgres container is running
if ! docker compose -f $DOCKER_COMPOSE_FILE ps postgres | grep -q "Up"; then
    echo "[$(date)] ERROR: PostgreSQL container is not running!"
    exit 1
fi

# Create compressed backup
docker compose -f $DOCKER_COMPOSE_FILE exec -T postgres \
    pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_FILE"

# Check if backup was successful
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date)] Backup successful: $BACKUP_FILE (${SIZE})"
    
    # Remove old backups
    find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
    echo "[$(date)] Cleaned up backups older than $RETENTION_DAYS days"
else
    echo "[$(date)] ERROR: Backup failed!"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Optional: Upload to S3
# if command -v aws &> /dev/null; then
#     echo "[$(date)] Uploading backup to S3..."
#     aws s3 cp "$BACKUP_FILE" "s3://your-backup-bucket/jlw2026/"
#     echo "[$(date)] S3 upload complete"
# fi

echo "[$(date)] Backup process complete"
