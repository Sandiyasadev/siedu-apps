# Siedu Project Documentation

Selamat datang di dokumentasi proyek Siedu — Platform AI Customer Service.

## Daftar Isi

### 1. Arsitektur & Konsep
- [Arsitektur Sistem](architecture.md) — Penjelasan "Dua Dunia" (Testing vs Production), Alur Data, dan Komponen Utama via Monorepo.
- [Handoff V1 Logic](handoff-v1.md) — Penjelasan detail mekanisme Bot ↔ Human, Gatekeeper, dan Auto-Timeout.
- [Database Schema](database.md) — Struktur tabel, relasi, dan panduan migrasi.

### 2. Panduan Setup
- [Setup Testing (Codespace/Lokal)](setup-testing.md) — Cara menjalankan project di mode development dengan Docker & Tunnel n8n.
- [Setup Production (VPS)](setup-production.md) — Panduan deploy ke VPS (API+n8n) dan S3 (Frontend).

### 3. API & Referensi
- [API Reference](api-reference.md) — Daftar endpoint API backend.
