# Setup Testing (Development)

Panduan ini untuk menjalankan aplikasi di **Local Laptop** atau **GitHub Codespaces**.

## 1. Persiapan

Pastikan Anda memiliki:
- Docker & Docker Compose
- Node.js v18+ (Opsional jika pakai Docker)

## 2. Menjalankan Aplikasi

Di root folder `siedu/`:

1.  **Copy Environment File:**
    ```bash
    cp .env.example .env
    ```

2.  **Start Development Server:**
    ```bash
    # Cara 1: Pakai Script (Disarankan)
    npm run dev

    # Cara 2: Manual Docker Compose
    docker compose -f docker-compose.dev.yml up -d
    ```

    Ini akan menjalankan:
    - PostgreSQL (Port 5432)
    - Redis (Port 6379)
    - MinIO (Port 9000 & 9001)
    - API (Port 8080 - Hot Reload)
    - Dashboard (Port 5173 - Hot Reload)

3.  **Akses:**
    - Dashboard: [http://localhost:5173](http://localhost:5173)
    - API: [http://localhost:8080](http://localhost:8080)
    - MinIO Console: [http://localhost:9001](http://localhost:9001) (`minioadmin` / `minioadmin`)

## 3. Menghubungkan n8n Lokal (Tunneling)

Agar API di Codespace/Docker bisa menghubungi n8n yang berjalan di laptop Anda:

1.  **Jalankan n8n di Laptop:**
    ```bash
    n8n start
    ```
    *(Pastikan webhook URL di workflow n8n sudah benar)*

2.  **Buat Tunnel:**
    ```bash
    npx localtunnel --port 5678
    ```
    *(Atau gunakan ngrok: `ngrok http 5678`)*

3.  **Update Config:**
    Ambil URL yang dihasilkan (misal `https://funny-cat-42.loca.lt`), lalu update `.env`:
    ```env
    N8N_WEBHOOK_BASE=https://funny-cat-42.loca.lt/webhook
    ```

4.  **Restart API:**
    Jalankan `npm run dev:reset` atau restart terminal `npm run dev`.

---

## Troubleshooting

- **Database Error?** Coba reset total: `npm run dev:reset`.
- **Port Conflict?** Pastikan tidak ada service lain di port 5432/8080/5173.
- **n8n tidak terpanggil?** Cek URL tunnel, pastikan workflow n8n aktif (Status: Active).
