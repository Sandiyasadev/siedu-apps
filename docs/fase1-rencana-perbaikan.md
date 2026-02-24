# Rencana Perbaikan Menuju Deploy Fase 1

## Tujuan

Menstabilkan sistem agar siap deploy **Fase 1** dengan fokus pada:

- reliabilitas alur utama (login, inbox, webhook, balas pesan, handoff)
- keamanan operasional (khususnya environment dev vs production)
- konsistensi realtime dan super-admin flow
- kesiapan release (CI minimum, checklist verifikasi)

Dokumen ini **tidak menambah fitur baru**. Fokusnya adalah hardening dan penyelesaian gap implementasi.

## Definisi "Siap Deploy Fase 1"

Sistem dianggap siap deploy Fase 1 jika:

- alur inti berjalan tanpa bug blocker:
  - login / refresh token
  - inbox realtime
  - kirim balasan (text + media dasar)
  - webhook Telegram/WhatsApp
  - handoff bot/human
  - super-admin preset apply/deploy (jalur yang dipakai UI)
- tidak ada konfigurasi default development yang mengarah ke production
- build frontend + build Docker API + smoke test endpoint utama lulus
- ada checklist verifikasi pasca deploy dan rollback sederhana

## Prinsip Eksekusi

- Freeze fitur baru sampai semua item P0 selesai.
- Kerjakan dari blocker tertinggi (auth/realtime/config) ke kualitas release.
- Setiap perubahan wajib diverifikasi minimal dengan skenario manual yang ditulis di PR/commit note.
- Perbaikan yang mengubah endpoint/kontrak harus menyertakan sinkronisasi frontend-backend.

## Prioritas Eksekusi

- `P0` = blocker deploy / berisiko menyebabkan error produksi atau salah target environment
- `P1` = penting untuk stabilitas dan operasional Fase 1
- `P2` = peningkatan maintainability yang bisa bertahap setelah go-live

---

## P0 - Blocker Deploy Fase 1

### 1) Socket realtime gagal autentikasi (JWT claim mismatch)

- Prioritas: `P0`
- Masalah:
  - Access token menyimpan claim `userId`, tetapi Socket.IO auth membaca `decoded.id`.
  - Dampak: koneksi realtime bisa gagal, inbox tidak update realtime, badge unread desync.
- Lokasi:
  - `apps/api/src/middleware/auth.js`
  - `apps/api/src/services/socketService.js`
- Solusi:
  - Samakan claim JWT yang dibaca di Socket.IO (`decoded.userId`), atau dukung fallback `decoded.userId ?? decoded.id`.
  - Tambahkan logging error yang lebih spesifik untuk membedakan "token invalid" vs "user tidak ditemukan".
  - Tambahkan smoke test manual realtime setelah login.
- Definisi Selesai:
  - User login berhasil terhubung ke socket tanpa error auth.
  - Event `message:new` dan `conversation:update` diterima dashboard saat ada pesan/status baru.
  - Tidak ada log `Authentication error` palsu untuk token valid.

### 2) Konfigurasi development mengarah ke API production

- Prioritas: `P0`
- Masalah:
  - `VITE_API_BASE` default dan `docker-compose.dev.yml` mengarah ke domain production.
  - Risiko: testing lokal/codespace bisa menulis ke data production.
- Lokasi:
  - `apps/dashboard/src/config/api.js`
  - `docker-compose.dev.yml`
- Solusi:
  - Ubah default dev ke `http://localhost:8080`.
  - Pastikan `docker-compose.dev.yml` memakai URL lokal untuk dashboard/API publik.
  - Pertahankan URL production hanya via env/secret pada deploy pipeline.
  - Tambahkan catatan eksplisit di docs setup/testing.
- Definisi Selesai:
  - Menjalankan `npm run dev` hanya mengakses service lokal.
  - Tidak ada endpoint production yang menjadi default pada mode development.
  - Dokumentasi setup dev konsisten dengan perilaku aktual.

### 3) Endpoint super-admin frontend-backend tidak sinkron (apply preset)

- Prioritas: `P0`
- Masalah:
  - Sebagian frontend masih memanggil endpoint lama (`apply-presets`, `preview-apply-presets`) sementara backend sudah menggunakan endpoint `*-bundle`.
  - Dampak: fitur deploy/apply preset gagal (404) di jalur UI tertentu.
- Lokasi:
  - `apps/dashboard/src/pages/super-admin/hooks/useSuperAdminCore.js`
  - `apps/api/src/routes/admin.js`
- Solusi:
  - Sinkronkan frontend ke endpoint backend yang aktif (`apply-bundle`, `preview-apply-bundle`).
  - Audit semua halaman super-admin untuk endpoint legacy yang tersisa.
  - Tambahkan error message yang jelas jika response non-200.
- Definisi Selesai:
  - Preview apply preset berhasil dari UI super-admin.
  - Apply preset berhasil dari UI super-admin.
  - Tidak ada request ke endpoint legacy yang sudah tidak tersedia.

### 4) Event socket tidak konsisten ke room workspace (inbox/list bisa desync)

- Prioritas: `P0`
- Masalah:
  - `emitNewMessage` / `emitStatusChange` membutuhkan `workspaceId` agar event dikirim ke room workspace.
  - Beberapa route memanggil emit tanpa `workspaceId`, sehingga agent lain/inbox list tidak selalu update.
- Lokasi:
  - `apps/api/src/services/socketService.js`
  - `apps/api/src/routes/conversations.js`
  - (audit route lain yang emit socket)
- Solusi:
  - Standarisasi semua emit dari route agar menyertakan `workspaceId`.
  - Alternatif lebih aman: buat helper untuk resolve `workspaceId` internal sebelum emit.
  - Tambahkan checklist uji dua tab/browser untuk validasi sinkronisasi.
- Definisi Selesai:
  - Status conversation berubah di tab A langsung terlihat di tab B (workspace sama).
  - Balasan agent dan pesan masuk memperbarui list inbox tanpa refresh manual.
  - Unread badge tetap konsisten setelah aksi baca/kirim/status update.

### 5) Refresh token flow ada, tapi belum dipakai konsisten di frontend

- Prioritas: `P0`
- Masalah:
  - `authFetch` tersedia tetapi mayoritas halaman masih memakai `fetch` langsung.
  - Dampak: saat access token expired, UI gagal sporadis dan pengalaman operator buruk.
- Lokasi:
  - `apps/dashboard/src/App.jsx`
  - Banyak file di `apps/dashboard/src/pages/*` dan `apps/dashboard/src/contexts/*`
- Solusi:
  - Buat satu API client/helper terpusat (gunakan `authFetch`) dan migrasikan request bertahap.
  - Prioritaskan halaman inti Fase 1: Login/Auth, Dashboard, Inbox, Bots, Channels, KB, Super-admin preset/deploy.
  - Pastikan request multipart (`FormData`) tetap didukung.
- Definisi Selesai:
  - Access token expired tidak memaksa reload/manual login selama refresh token masih valid.
  - Halaman inti Fase 1 pulih otomatis setelah refresh token sukses.
  - Logout tetap menghapus token dan memutus sesi dengan benar.

### 6) Mismatch nama env JWT expiry (config tidak bekerja sesuai ekspektasi)

- Prioritas: `P0`
- Masalah:
  - Kode backend membaca `JWT_ACCESS_EXPIRES_IN`, sedangkan `.env.example` dan compose menggunakan `JWT_EXPIRES_IN`.
  - Dampak: konfigurasi umur token tidak sesuai yang diharapkan operator.
- Lokasi:
  - `apps/api/src/middleware/auth.js`
  - `.env.example`
  - `docker-compose.dev.yml`
  - `docker-compose.yml`
- Solusi:
  - Pilih satu nama resmi (disarankan `JWT_ACCESS_EXPIRES_IN`) dan dukung alias lama sementara untuk backward compatibility.
  - Perbarui docs + `.env.example` + compose agar konsisten.
- Definisi Selesai:
  - Konfigurasi expiry token access bekerja sesuai env yang didokumentasikan.
  - Tidak ada ambiguitas nama env di docs/compose/kode.

### 7) Bug quick reply di Inbox (refresh messages memanggil fungsi tanpa `conversationId`)

- Prioritas: `P0`
- Masalah:
  - Setelah kirim template quick reply, `fetchMessages()` dipanggil tanpa argumen yang dibutuhkan.
  - Dampak: daftar pesan bisa gagal refresh / error diam-diam.
- Lokasi:
  - `apps/dashboard/src/pages/Inbox.jsx`
- Solusi:
  - Panggil `fetchMessages(selectedConv.id)` atau update state optimistik dari response.
  - Tambahkan handling error UI (toast) jika kirim template gagal.
- Definisi Selesai:
  - Quick reply muncul di panel chat segera setelah dikirim.
  - Tidak ada error console terkait request messages setelah quick reply.

---

## P1 - Stabilitas & Kesiapan Operasional Fase 1

### 8) Perbaikan implementasi dedup refresh token di frontend (`useRef`)

- Prioritas: `P1`
- Masalah:
  - `refreshPromiseRef` dibuat sebagai object biasa, bukan `useRef`, sehingga tidak stabil antar render.
- Lokasi:
  - `apps/dashboard/src/App.jsx`
- Solusi:
  - Ganti ke `useRef(null)`.
  - Pastikan race condition refresh tetap tertangani.
- Definisi Selesai:
  - Banyak request paralel saat token expired hanya memicu satu request refresh.
  - Tidak ada loop refresh atau overwrite token karena race condition.

### 9) CI minimum belum memeriksa kualitas (lint/test smoke)

- Prioritas: `P1`
- Masalah:
  - CI saat ini hanya build dashboard dan build Docker API.
  - Tidak ada lint/check konsistensi frontend-backend atau smoke test endpoint.
- Lokasi:
  - `.github/workflows/ci.yml`
  - `apps/api/package.json`
  - `apps/dashboard/package.json`
- Solusi:
  - Tambahkan script `lint` (minimal) untuk API dan dashboard.
  - Tambahkan smoke check sederhana (contoh: start API test mode / health endpoint parseable) jika feasible.
  - Jika test belum siap, tambahkan "no-test-yet" guard yang eksplisit, bukan implicit.
- Definisi Selesai:
  - CI gagal jika ada error sintaks/lint pada perubahan umum.
  - CI memberi sinyal lebih awal untuk regresi dasar sebelum merge.

### 10) Checklist release & verifikasi pasca deploy belum dibakukan

- Prioritas: `P1`
- Masalah:
  - Workflow deploy sudah ada, tetapi acceptance pasca deploy belum terdokumentasi sebagai checklist operasional.
- Lokasi:
  - `docs/` (dokumen baru atau tambahan)
  - `.github/workflows/deploy.yml`
- Solusi:
  - Buat checklist pasca deploy:
    - health endpoint
    - login dashboard
    - realtime socket
    - webhook test (dummy/manual)
    - kirim pesan outbound
    - super-admin apply preset
  - Tambahkan langkah rollback minimal.
- Definisi Selesai:
  - Ada checklist yang bisa dijalankan operator setelah deploy.
  - Ada prosedur rollback singkat dan jelas.

### 11) Validasi manual Fase 1 belum terstruktur (test matrix)

- Prioritas: `P1`
- Masalah:
  - Banyak fitur sudah ada, tetapi belum ada matriks skenario uji manual terfokus untuk Fase 1.
- Solusi:
  - Buat test matrix manual untuk role:
    - `super_admin`
    - `admin`
    - `agent`
  - Buat skenario channel:
    - Telegram
    - WhatsApp
  - Fokus pada alur kritis dan edge case token expiry/reconnect.
- Definisi Selesai:
  - Semua skenario P0/P1 ditandai pass sebelum deploy Fase 1.
  - Hasil uji terdokumentasi (tanggal + siapa yang menguji).

---

## P2 - Maintainability Setelah Fase 1 (Boleh Bertahap)

### 12) Pecah file besar (backend routes dan Inbox page)

- Prioritas: `P2`
- Masalah:
  - Beberapa file sangat besar (admin/internal/hooks/inbox) sehingga sulit dirawat dan rawan regresi.
- Solusi:
  - Refactor bertahap:
    - route -> controller/service validator modules
    - `Inbox.jsx` -> komponen presentasional + hooks data layer
  - Jangan lakukan refactor besar bersamaan dengan fix P0 jika deadline deploy dekat.
- Definisi Selesai:
  - File kritis dipisah menjadi modul yang lebih kecil tanpa perubahan perilaku.
  - Terdapat boundary jelas antara UI, API calls, dan state logic.

### 13) Observability terstruktur (request ID / log level / error taxonomy)

- Prioritas: `P2`
- Masalah:
  - Logging cukup banyak, tetapi belum terstandar untuk tracing issue produksi.
- Solusi:
  - Tambahkan request ID (middleware), log levels, dan format konsisten untuk error penting.
  - Prioritaskan webhook, internal API, auth, conversations.
- Definisi Selesai:
  - Insiden umum bisa ditelusuri dari log tanpa grep manual yang berat.

---

## Rencana Eksekusi Disarankan (Urutan Kerja)

### Wave 1 - Hard Blocker (sebelum uji regresi)

1. Fix socket JWT claim mismatch.
2. Fix dev config agar tidak mengarah ke production.
3. Sinkronkan endpoint super-admin preset.
4. Fix quick reply Inbox.
5. Samakan env JWT expiry (kode + docs + compose).

Output wave 1:

- build tetap hijau
- login + socket + super-admin preset basic flow bisa diuji

### Wave 2 - Konsistensi Runtime

1. Standarisasi emit socket dengan `workspaceId`.
2. Perbaiki `authFetch` adoption untuk halaman inti Fase 1.
3. Perbaiki `refreshPromiseRef` ke `useRef`.

Output wave 2:

- inbox/status/unread lebih konsisten
- token expiry tidak mengganggu operator

### Wave 3 - Release Readiness

1. Tambah CI minimum (lint/smoke checks).
2. Buat checklist deploy + post-deploy verification.
3. Jalankan test matrix manual Fase 1.

Output wave 3:

- siap deploy dengan proses verifikasi yang repeatable

---

## Checklist Gate Sebelum Tag/Deploy Fase 1

- [ ] Semua item `P0` selesai dan diverifikasi
- [ ] Tidak ada default config dev yang mengarah ke production
- [ ] Login + refresh token + logout lulus
- [ ] Inbox realtime lulus (2 tab/browser test)
- [ ] WhatsApp webhook (verify + receive + status update) lulus
- [ ] Telegram webhook (secret verify + receive) lulus
- [ ] Agent reply text lulus
- [ ] Agent reply media dasar lulus
- [ ] Handoff bot/human manual lulus
- [ ] Super-admin preset preview/apply lulus
- [ ] CI lulus
- [ ] Post-deploy checklist tersedia dan dipahami operator

## Catatan Implementasi

- Jika deadline deploy ketat, fokus pada `P0 + Wave 3 checklist minimum`.
- Refactor besar (`P2`) sebaiknya setelah Fase 1 live stabil.
- Setiap fix yang menyentuh auth/socket/webhook wajib dites manual end-to-end, bukan hanya build sukses.

