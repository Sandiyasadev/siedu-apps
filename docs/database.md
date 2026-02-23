# Dokumentasi Database

Database utama menggunakan **PostgreSQL**.

## 1. Tabel Utama: `conversations`

Tabel ini menyimpan state percakapan dan status handoff.

| Kolom | Tipe | Deskripsi |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `status` | ENUM | `'bot'` (default) atau `'human'` |
| `last_agent_reply_at` | TIMESTAMPTZ | Waktu terakhir CS membalas pesan. Digunakan untuk auto-timeout. |
| `unanswered_count` | INTEGER | Jumlah pesan user yang belum dijawab oleh CS saat status `'human'`. |
| `bot_id` | UUID | Relasi ke tabel `bots`. |
| `channel_type` | VARCHAR | `'whatsapp'`, `'telegram'`, `'web'`, dll. |
| `external_thread_id` | VARCHAR | ID chat dari platform luar (No HP / Chat ID). |

## 2. Tabel `messages`

Menyimpan riwayat chat.

| Kolom | Tipe | Deskripsi |
| :--- | :--- | :--- |
| `conversation_id` | UUID | Relasi ke `conversations`. |
| `role` | VARCHAR | `'user'`, `'assistant'` (AI), `'agent'` (CS/Human). |
| `content` | TEXT | Isi pesan. |
| `created_at` | TIMESTAMPTZ | Waktu pesan dibuat. |
| `raw` | JSONB | Metadata raw dari provider (Telegram/WA). |

## 3. Auth & Sessions
Tabel `users` memiliki kolom:
- `last_login_at` (TIMESTAMPTZ): Melacak waktu terakhir user login.
- `last_login_ip` (INET): Melacak IP terakhir.

Autentikasi menggunakan Dual-Token system. Tabel **`refresh_tokens`** menyimpan data token:
- `token_hash` (TEXT): Hash dari token untuk rotasi.
- `expires_at` (TIMESTAMPTZ): Waktu kedaluwarsa (default 7 hari).
- `revoked_at` (TIMESTAMPTZ): Jika berisi tanggal, token sudah hangus.

## 4. Migrasi

Semua script migrasi telah *dikonsolidasi*. Untuk menjalankan struktur database dari awal atau menerapkan perubahan:

**Testing (Lokal/Docker):**
```bash
# Menjalankan script init
psql -h localhost -U postgres -d siedu -f packages/database/00_init.sql
# Atau via npm script jika tersedia: npm run db:migrate
```

**Production (Supabase):**
Jalankan file SQL `packages/database/00_init.sql` melalui Supabase SQL Editor atau CLI.

---

## Catatan Penting

- **Vector Store:** Menggunakan ekstensi `pgvector`. Tabel `n8n_vectors` (n8n API) dan `kb_embeddings` (Backend API) menyimpan vektor konten. Menggunakan dimensi **1024** (`vector(1024)`) disesuaikan untuk Amazon Titan Embed Text v2.
- **Backup:** Production menggunakan fitur backup otomatis Supabase. Testing menggunakan volume Docker (hilang jika volume dihapus).
