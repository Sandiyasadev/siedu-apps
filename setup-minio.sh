#!/bin/bash

echo "🚀 Setting up MinIO Bucket..."

# Set alias
docker compose -f docker-compose.dev.yml exec minio mc alias set local http://localhost:9000 minioadmin minioadmin

# Buat bucket (ignore error kalau sudah ada)
docker compose -f docker-compose.dev.yml exec minio mc mb local/chat-backend-storage || true

# Set public policy
docker compose -f docker-compose.dev.yml exec minio mc policy set public local/chat-backend-storage

# Restart API supaya deteksi bucket
echo "🔄 Restarting API to detect bucket..."
docker compose -f docker-compose.dev.yml restart api

echo "✅ MinIO setup complete!"
