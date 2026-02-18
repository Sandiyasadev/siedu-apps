#!/bin/bash
# ============================================
# Database Migration Runner
# Runs SQL migrations in order, skips already applied
# Usage: bash packages/database/migrate.sh
# ============================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load .env if exists (for local usage)
if [ -f "$SCRIPT_DIR/../../.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/../../.env" | grep DATABASE_URL | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set. Export it or add to .env"
    exit 1
fi

echo "🗄️  Running database migrations..."
echo "   Target: ${DATABASE_URL%%@*}@***"

# Create migrations tracking table if not exists
psql "$DATABASE_URL" -q <<'SQL'
CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);
SQL

# Find and run migrations in order
MIGRATION_DIR="$SCRIPT_DIR"
APPLIED=0
SKIPPED=0

for file in $(ls "$MIGRATION_DIR"/*.sql 2>/dev/null | sort); do
    filename=$(basename "$file")

    # Skip if already applied
    already=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM _migrations WHERE filename = '$filename'")
    if [ "$already" -gt 0 ]; then
        SKIPPED=$((SKIPPED + 1))
        continue
    fi

    echo "   📄 Applying: $filename"
    psql "$DATABASE_URL" -q -f "$file"

    # Record migration
    psql "$DATABASE_URL" -q -c "INSERT INTO _migrations (filename) VALUES ('$filename')"
    APPLIED=$((APPLIED + 1))
done

echo ""
echo "✅ Migrations complete: $APPLIED applied, $SKIPPED skipped"
