#!/bin/bash
# Tägliches PostgreSQL-Backup für CC Extension
# Wird per Cron ausgeführt: täglich um 3:00 Uhr

BACKUP_DIR="/home/timo_hahn/Timos_CC_Projekte/backups"
DB_NAME="ccextension"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y-%m-%d_%H%M)

# Backup erstellen (Auth über ~/.pgpass)
pg_dump -h localhost -U ccextension "$DB_NAME" | gzip > "$BACKUP_DIR/db_${DB_NAME}_${TIMESTAMP}.sql.gz"

# Alte Backups löschen (älter als $RETENTION_DAYS Tage)
find "$BACKUP_DIR" -name "db_${DB_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "$(date): Backup erstellt: db_${DB_NAME}_${TIMESTAMP}.sql.gz"
