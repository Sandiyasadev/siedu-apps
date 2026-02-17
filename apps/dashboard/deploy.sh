#!/bin/bash
# ============================================
# Deploy Frontend ke AWS CloudFront + S3
# ============================================
set -e

if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

API_URL="${VITE_API_BASE:-http://localhost:8080}"
S3_BUCKET="${S3_FRONTEND_BUCKET}"
CF_DIST_ID="${CLOUDFRONT_DISTRIBUTION_ID}"

if [ -z "$S3_BUCKET" ]; then
    echo "❌ Error: S3_FRONTEND_BUCKET belum diisi di .env"
    exit 1
fi

echo "🔨 Building frontend..."
echo "   API URL: $API_URL"
VITE_API_BASE="$API_URL" npm run build

echo ""
echo "📤 Uploading ke S3: $S3_BUCKET ..."
aws s3 sync dist/ "s3://$S3_BUCKET/" --delete

if [ -n "$CF_DIST_ID" ]; then
    echo ""
    echo "🔄 Invalidating CloudFront cache..."
    aws cloudfront create-invalidation \
        --distribution-id "$CF_DIST_ID" \
        --paths "/index.html" \
        --no-cli-pager
    echo "✅ CloudFront invalidation created"
else
    echo ""
    echo "⚠️  CLOUDFRONT_DISTRIBUTION_ID tidak diset, skip invalidation"
fi

echo ""
echo "✅ Deploy selesai!"
