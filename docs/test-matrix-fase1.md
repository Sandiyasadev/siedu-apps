# Test Matrix — Fase 1

Matriks uji manual per role dan channel untuk verifikasi Fase 1.

## Legend

- ✅ Harus diuji
- ➖ Tidak relevan untuk role ini
- 🔶 Nice to have (jika waktu cukup)

## Per Role

| Test Case | super_admin | admin | agent |
|-----------|:-----------:|:-----:|:-----:|
| Login | ✅ | ✅ | ✅ |
| Logout | ✅ | ✅ | ✅ |
| Dashboard utama | ✅ | ✅ | ➖ |
| Buat bot | ➖ | ✅ | ➖ |
| Kelola channel | ➖ | ✅ | ➖ |
| Knowledge base | ➖ | ✅ | ➖ |
| Bot templates | ➖ | ✅ | ➖ |
| Inbox: lihat conversation | ✅ (workspace mode) | ✅ | ✅ |
| Inbox: kirim pesan teks | ✅ (workspace mode) | ✅ | ✅ |
| Inbox: kirim attachment | 🔶 | ✅ | ✅ |
| Inbox: ambil alih (handoff) | 🔶 | ✅ | ✅ |
| Inbox: kembalikan ke bot | 🔶 | ✅ | ✅ |
| Inbox: quick reply template | 🔶 | ✅ | ✅ |
| SA Dashboard | ✅ | ➖ | ➖ |
| SA Apply Bundle | ✅ | ➖ | ➖ |
| SA Preview Apply Bundle | ✅ | ➖ | ➖ |
| SA Workspace mode | ✅ | ➖ | ➖ |

## Per Channel

| Test Case | Telegram | WhatsApp | Web Widget |
|-----------|:--------:|:--------:|:----------:|
| Pesan masuk → muncul di Inbox | ✅ | ✅ | 🔶 |
| Bot balas otomatis | ✅ | ✅ | 🔶 |
| Agent balas manual | ✅ | ✅ | 🔶 |
| Handoff bot → human | ✅ | ✅ | 🔶 |
| Return human → bot | ✅ | ✅ | 🔶 |
| Media/attachment inbound | ✅ | ✅ | ➖ |
| Media/attachment outbound | 🔶 | 🔶 | ➖ |

## Alur Kritis (Harus Lulus Semua)

1. **Login → Inbox → Terima pesan → Balas → Handoff → Return to bot**
2. **Login super_admin → SA Dashboard → Apply Bundle → Workspace mode → Inbox**
3. **Token expire → Auto refresh → Tidak ada forced reload**
4. **Buka 2 tab → Aksi di Tab A → Tab B update realtime**
