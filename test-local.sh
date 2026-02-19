#!/bin/bash
# ============================================
# Siedu — Local Pre-Push Verification Script
# Jalankan sebelum push untuk memastikan kode aman.
# Usage: ./test-local.sh
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

passed=0
failed=0

run_check() {
    local label="$1"
    shift
    echo ""
    echo -e "${YELLOW}🔍 [$label]${NC}"
    if "$@" 2>&1; then
        echo -e "${GREEN}   ✅ $label — PASSED${NC}"
        ((passed++))
    else
        echo -e "${RED}   ❌ $label — FAILED${NC}"
        ((failed++))
    fi
}

echo "============================================"
echo "  Siedu — Local Verification"
echo "============================================"

# -------------------------------------------
# Check 1: API — Dependencies
# -------------------------------------------
run_check "API Install" npm install --prefix apps/api --ignore-scripts

# -------------------------------------------
# Check 2: Dashboard — Dependencies
# -------------------------------------------
run_check "Dashboard Install" npm install --prefix apps/dashboard

# -------------------------------------------
# Check 3: Dashboard — Build
# Ini adalah check TERPENTING.
# Jika React build gagal, pasti deploy juga gagal.
# -------------------------------------------
run_check "Dashboard Build" npm run build --prefix apps/dashboard

# -------------------------------------------
# Check 4: API — Docker Build
# Memastikan Dockerfile valid dan bisa di-build.
# -------------------------------------------
run_check "API Docker Build" docker build -t siedu-api-test ./apps/api

# -------------------------------------------
# Check 5: API — Unit Tests (jika ada)
# -------------------------------------------
if [ -f "apps/api/package.json" ] && grep -q '"test"' apps/api/package.json; then
    run_check "API Tests" npm test --prefix apps/api -- --passWithNoTests 2>/dev/null || true
fi

# -------------------------------------------
# Summary
# -------------------------------------------
echo ""
echo "============================================"
echo "  RESULTS"
echo "============================================"
echo -e "  ${GREEN}Passed: $passed${NC}"
echo -e "  ${RED}Failed: $failed${NC}"
echo ""

if [ "$failed" -gt 0 ]; then
    echo -e "${RED}⚠️  ADA CHECK YANG GAGAL. Perbaiki sebelum push!${NC}"
    exit 1
else
    echo -e "${GREEN}🎉 SEMUA CHECK PASSED! Aman untuk push.${NC}"
    exit 0
fi
