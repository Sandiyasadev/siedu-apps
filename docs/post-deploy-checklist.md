# Post-Deploy Checklist — Fase 1

Checklist verifikasi setelah deploy ke production/staging.

## 1. Health Check

- [ ] API health: `curl https://<API_URL>/healthz` → `200 OK`
- [ ] Dashboard: buka `https://<DASHBOARD_URL>` → halaman login tampil

## 2. Autentikasi

- [ ] Login sebagai `admin` → berhasil masuk dashboard
- [ ] Login sebagai `agent` → redirect ke Inbox
- [ ] Login sebagai `super_admin` → redirect ke SA Dashboard
- [ ] Logout → token dihapus, redirect ke login

## 3. Realtime (Socket.IO)

- [ ] Buka Inbox → cek console browser: **tidak ada** error `Authentication error` / `Invalid token`
- [ ] Buka 2 tab → kirim pesan dari channel → kedua tab menerima pesan baru

## 4. Inbox Core Flow

- [ ] Pilih conversation → pesan dimuat
- [ ] Ketik & kirim pesan teks → pesan muncul + terkirim ke channel
- [ ] Kirim pesan dengan attachment → file terupload + pesan terkirim
- [ ] Klik "Ambil Alih" → status berubah ke `human`
- [ ] Klik "Kembalikan ke Bot" → status berubah ke `bot`
- [ ] Kirim quick reply template → pesan template terkirim + chat panel ter-refresh

## 5. Webhook (n8n)

- [ ] Kirim pesan dari Telegram → pesan masuk di Inbox
- [ ] Kirim pesan dari WhatsApp → pesan masuk di Inbox
- [ ] Bot membalas otomatis (status `bot`) → pesan terkirim ke channel

## 6. Super Admin

- [ ] Buka SA Dashboard → data workspace & bot tampil
- [ ] Preview Apply Bundle → response 200 (bukan 404)
- [ ] Apply Bundle → berhasil tanpa error
- [ ] Masuk workspace mode (`/w/:id/inbox`) → Inbox berfungsi normal

## 7. Token Refresh

- [ ] Biarkan access token expire → lakukan aksi di Inbox → **tidak ada** forced reload
- [ ] Verifikasi di Network tab: refresh request terjadi 1x, bukan berkali-kali

## Rollback

Jika terjadi masalah kritis setelah deploy:

```bash
# 1. Rollback ke commit sebelumnya
git log --oneline -5       # cari commit hash sebelum deploy
git revert <commit-hash>   # atau git reset --hard <commit-hash>

# 2. Redeploy
npm run prod

# 3. Verifikasi health
curl https://<API_URL>/healthz
```
