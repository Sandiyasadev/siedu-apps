# Siedu — AI Customer Service Platform
deploy
Monorepo untuk API backend dan Dashboard frontend.

## Quick Start (Testing / Codespace)

```bash
# 1. Copy env
cp .env.example .env #ini 

# 2. Jalankan semua (DB + Redis + MinIO + API + Dashboard)
npm run dev jalankan

# 3. Buka browser
# Dashboard: http://localhost:5173
# API:       http://localhost:8080
# MinIO:     http://localhost:9001 (minioadmin/minioadmin)
```

## Connect n8n Lokal

```bash
# Di laptop (terminal terpisah):
npx localtunnel --port 5678

# Copy URL yang muncul (misal: https://xxxxx.loca.lt)
# Paste di .env:
# N8N_WEBHOOK_BASE=https://xxxxx.loca.lt/webhook
```

## Deploy Production (VPS)

```bash
# 1. Edit .env dengan nilai production (Supabase, AWS, dll)
# 2. Jalankan
npm run prod
```

## Scripts

| Command | Fungsi |
|---------|--------|
| `npm run dev` | Start semua (testing) |
| `npm run dev:stop` | Stop semua |
| `npm run dev:reset` | Reset DB + restart |
| `npm run prod` | Start production |
| `npm run prod:stop` | Stop production |

## Struktur

```
siedu/
├── apps/api/         # Express API backend
├── apps/dashboard/   # React (Vite) frontend
├── packages/database # DB migrations
├── docker-compose.dev.yml   # Testing
└── docker-compose.yml       # Production
```
