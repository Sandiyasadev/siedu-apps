# Arsitektur Sistem Siedu

Sistem ini dirancang dengan pendekatan **Monorepo** yang memfasilitasi dua lingkungan yang sangat berbeda: **Testing (Development)** dan **Production**.

## 1. Konsep "Dua Dunia"

Kami memisahkan environment menjadi dua mode operasi untuk menjaga keamanan data production sambil memaksimalkan kecepatan development.

| Komponen | Testing (Codespace / Lokal) | Production (VPS + Cloud) |
| :--- | :--- | :--- |
| **Repo** | Monorepo (`apps/api` + `apps/dashboard`) | Monorepo Source |
| **Database** | **Docker Postgres** (Lokal, data dummy) | **Supabase** (Managed Cloud DB) |
| **Storage** | **MinIO** (Docker S3-compatible) | **AWS S3** |
| **Frontend** | **Vite Dev Server** (HMR aktif) | **CloudFront + S3** (Static files) |
| **Automation** | **n8n Lokal** (di Laptop) via Tunnel | **n8n Docker** (di VPS) |
| **API** | **Node.js** (Hot Reload) | **Node.js** (PM2 / Docker Optimized) |

---

## 2. Diagram Alur Data

### A. Alur Chat (User ke Bot)

1.  **User** mengirim pesan (WA/Telegram/Web).
2.  **Webhook** diterima oleh `apps/api` (`src/routes/hooks.js`).
3.  **Gatekeeper Check:** API mengecek status percakapan di DB.
    *   Jika `status = 'human'`, pesan **disimpan saja** (tidak diteruskan ke AI).
    *   Jika `status = 'bot'`, pesan diteruskan ke **n8n**.
4.  **n8n Processing:**
    *   n8n menerima webhook dari API.
    *   Melakukan RAG (Retrieval Augmented Generation) ke Vector DB.
    *   Generate jawaban via LLM (OpenAI/Claude/etc).
    *   Kirim balik jawaban ke API endpoint `/ai-response`.
5.  **API Response:**
    *   Menerima jawaban dari n8n.
    *   Cek tag `[HANDOFF]`. Jika ada, ubah status jadi `human`.
    *   Kirim pesan ke User (WA/Telegram).

### B. Alur Handoff (Bot ke Human)

1.  **Trigger Otomatis:** AI merasa tidak bisa menjawab → output tag `[HANDOFF]`.
2.  **API Action:**
    *   Deteksi tag `[HANDOFF]`.
    *   Update DB: `status = 'human'`, `unanswered_count = 0`.
    *   Kirim notifikasi ke Dashboard CS.
3.  **CS Dashboard:**
    *   CS melihat chat di folder "Human Active".
    *   CS membalas chat.
    *   API mencatat `last_agent_reply_at`.

### C. Alur Handoff Balik (Human ke Bot)

1.  **Manual:** CS klik tombol "Serahkan ke Bot".
2.  **Otomatis:** Jika CS tidak membalas > 5 menit ATAU user kirim > 3 pesan tanpa balasan (konfigurasi di `hooks.js`).
3.  **API Action:** Update DB `status = 'bot'`.

---

## 3. Sistem Autentikasi (Dual-Token Mode)

API menggunakan sistem Dual-Token untuk keamanan yang lebih baik dibanding single long-lived JWT:

1.  **Access Token (JWT):** Umur pendek (default 1 jam). Disertakan di header `Authorization: Bearer <token>` untuk setiap request. Disimpan di memory atau `localStorage`.
2.  **Refresh Token:** Opaque string (hash). Umur panjang (default 7 hari). Disimpan di backend DB beserta info IP dan User-Agent.
3.  **Token Rotation:** Saat Access Token expired, frontend (/dashboard `authFetch`) akan menembak endpoint `/v1/auth/refresh`. Refresh token lama dihanguskan (revoked), dan pair Access + Refresh Token baru diterbitkan.

*(Login dilindungi rate limiter ketat: max 5 attempts / 15 menit per kombinasi IP dan Email).*

---

## 4. Struktur Monorepo

```
siedu/
├── apps/
│   ├── api/                  # Backend (Express.js)
│   └── dashboard/            # Frontend (React + Vite)
├── packages/
│   └── database/             # Migration Scripts
├── docker/                   # Config Docker tambahan
├── docker-compose.dev.yml    # Orchestrator Testing
└── docker-compose.yml        # Orchestrator Production
```
