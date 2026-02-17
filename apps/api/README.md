# Siedu API

Backend API untuk platform AI Chatbot Siedu.

## Tech Stack
- **Node.js 20** + **Express**
- **PostgreSQL** + **pgvector** (via Supabase / Self-hosted)
- **Redis** (Cache & Rate Limiting)
- **AWS S3** (File Storage)
- **PM2** (Process Manager)
- **Docker** (Deployment)

## Struktur Folder

```
├── src/                # Source code API
│   ├── config/         # Environment & database config
│   ├── middleware/      # Auth, rate limiter, dll
│   ├── routes/         # API endpoints
│   ├── services/       # Business logic
│   ├── utils/          # Helpers (storage, etc)
│   └── index.js        # Entry point
├── scripts/            # Admin scripts
├── workflow/           # n8n workflow templates
├── db/                 # Database migrations
├── Dockerfile
├── docker-compose.yml
└── ecosystem.config.js # PM2 config
```

## Setup Development

```bash
npm install
npm run dev
```

## Deploy ke Produksi

```bash
cp .env.example .env
# Edit .env lalu:
docker compose up -d
```

## Repositori Terkait
- **Frontend Dashboard**: `siedu-dashboard` (repo terpisah)
