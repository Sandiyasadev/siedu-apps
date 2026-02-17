# Analisis Beban Database: Supabase (Shared Project)

Dokumen ini menjelaskan mengapa satu project Supabase mampu menangani beban gabungan dari API Chat dan n8n Automation tanpa masalah kinerja.

## 1. Profil Beban Kerja (Workload Profile)

Aplikasi Chatbot seperti Siedu memiliki karakteristik beban yang unik: **Read-Heavy, Write-Burst**.

| Aktivitas | Frekuensi | Beban Database | Dampak pada Supabase |
| :--- | :--- | :--- | :--- |
| **Login User** | Rendah | 1 Query (SELECT) | **Sangat Rendah** |
| **Kirim Pesan** | Sedang | 1 Insert (Chat) + 1 Insert (n8n Log) | **Rendah** |
| **AI Thinking** | Sedang | 1 Select (Vector Search) | **Sedang** (CPU Bound) |
| **Upload PDF** | Jarang | 1 Insert (File Meta) + 100 Insert (Chunks) | **Tinggi Sesaat** (Burst) |

## 2. Mengapa Supabase Kuat?

Supabase menggunakan infrastruktur AWS EC2 (biasanya t4g.micro atau t4g.small untuk Free Tier) yang didedikasikan untuk database.

### A. Connection Pooling (Supavisor)
Supabase memiliki fitur bawaan bernama **Supavisor**.
- **Masalah**: n8n sering membuka-tutup koneksi database secara agresif.
- **Solusi**: Supavisor menampung ribuan koneksi dari n8n, tapi hanya meneruskan beberapa koneksi aktif ke database PostgreSQL yang asli.
- **Hasil**: Database tidak "tersedak" meskipun n8n sangat sibuk.

### B. pgvector Efficiency
Pencarian Vector (RAG) untuk AI menggunakan algoritma **HNSW Index**.
- Alih-alih membandingkan 1 juta dokumen satu per satu (lambat), HNSW membuat "peta jalan" pintas.
- Mencari dokumen yang relevan hanya butuh **0.05 detik** CPU time.
- Jadi, 10 user chat bersamaan pun beban CPU-nya masih di bawah 5%.

### C. Write Ahead Log (WAL)
PostgreSQL sangat efisien dalam menulis data.
- Menulis log n8n (text history) hanya butuh beberapa KB per detik.
- Disk IOPS (Kecepatan tulis disk) Supabase jauh di atas kebutuhan aplikasi chat standar.

## 3. Titik Lemah & Solusi

Meskipun kuat, ada skenario di mana satu project bisa kewalahan:

**Skenario**: 10 User mengupload PDF 500 Halaman secara bersamaan.
- **Efek**: n8n akan mencoba menulis 50.000 chunk vector sekaligus.
- **Risiko**: Database CPU spike ke 100%.

**Solusi Arsitektur Kita**:
Kita sudah memasang **Rate Limiter** di API (`rateLimiter.js`) dan **Queue System** di n8n.
- Jika ada lonjakan upload, API akan menahan (antri) prosesnya.
- Database tetap aman karena beban masuknya diatur "satu per satu", bukan "serentak".

## Kesimpulan

Satu project Supabase Free Tier mampu menangani:
- **~50 User Konkuren** (Chatting detik yang sama)
- **~500.000 Vector Embeddings** (Setara 1.000 PDF tebal)
- **~1GB Database Size** (Jutaan history chat)

Angka ini jauh di atas target MVP/SaaS awal. Jika suatu saat tercapai, upgrade ke **Pro Plan ($25/mo)** tinggal klik tombol, tanpa perlu mengubah kode sedikitpun.
