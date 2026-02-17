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

## 3. Migrasi

Untuk menjalankan perubahan struktur database:

**Testing (Lokal/Docker):**
```bash
npm run db:migrate
# Atau manual: psql -h localhost -U postgres -d siedu -f packages/database/v1_simplified_handoff.sql
```

**Production (Supabase):**
Jalankan file SQL di `packages/database/` melalui Supabase SQL Editor atau CLI.

---

## Catatan Penting

- **Vector Store:** Menggunakan ekstensi `pgvector`. Tabel `embeddings` menyimpan vektor dari Knowledge Base.
- **Backup:** Production menggunakan fitur backup otomatis Supabase. Testing menggunakan volume Docker (hilang jika volume dihapus).
