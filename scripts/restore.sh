#!/usr/bin/env bash
set -e

BACKUP_FILE=$1
DB_NAME=${DB_NAME:-"business_suite"}
DB_USER=${DB_USER:-"postgres"}
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"5432"}

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./restore.sh <path-to-backup.sql.gz>"
  exit 1
fi

echo "==> Restoring database $DB_NAME from $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | PGPASSWORD="${DB_PASSWORD:-postgres}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"

echo "==> Database restore completed successfully."
