# Handoff V1 Logic

Dokumen ini menjelaskan logika Handoff (perpindahan kendali antara Bot AI dan Agen Manusia) versi 1 yang disederhanakan.

## 1. Model Status

Hanya ada **2 Status** utama dalam percakapan:

| Status | Deskripsi | Siapa yang Menjawab? |
| :--- | :--- | :--- |
| **`bot`** | Default. Bot aktif menjawab semua pesan user. | **AI (n8n)** |
| **`human`** | Eskalasi. Bot "tutup mulut". Pesan user masuk inbox Agen. | **Manusia (CS)** |

*(Status lama seperti `open`, `handoff`, `closed` sudah dihapus/dikonversi)*

---

## 2. Mekanisme Perpindahan

### A. Bot → Human (Eskalasi)

Terjadi jika:
1.  **AI Menyerah:** AI memberikan respons yang mengandung tag `[HANDOFF]`.
    *   *Contoh:* User tanya harga spesial → AI jawab: "Saya akan sambungkan ke sales. [HANDOFF]"
    *   API mendeteksi tag ini, menghapusnya dari pesan yang dikirim ke user, dan mengubah status DB menjadi `human`.
2.  **Manual Takeover:** Agen menekan tombol **"Ambil Alih"** di dashboard.

### B. Human → Bot (De-eskalasi)

Terjadi jika:
1.  **Manual Handover:** Agen menekan tombol **"Serahkan ke Bot"** di dashboard.
2.  **Auto-Timeout (Gatekeeper):**
    *   Jika status `human`, API akan mengecek setiap pesan baru dari user.
    *   Jika sudah **> 5 menit** sejak balasan terakhir agen, status otomatis kembali ke `bot`.
    *   Jika user mengirim **> 3 pesan berturut-turut** tanpa balasan agen, status otomatis kembali ke `bot`.

---

## 3. Implementasi Kode

### Gatekeeper (`src/routes/hooks.js`)

Fungsi `shouldForwardToN8n(conversationId)`:
```javascript
// Pseudo-code
if (status === 'bot') return TRUE; // Forward ke AI

if (status === 'human') {
    if (time_since_last_agent_reply > 5_minutes OR unanswered_count >= 3) {
        set_status('bot');
        return TRUE; // Timeout! Balik ke AI
    }
    increment_unanswered_count();
    return FALSE; // Jangan forward, biarkan di inbox CS
}
```

### AI Response Handler (`src/routes/internal.js`)

Logic deteksi tag:
```javascript
// Pseudo-code
if (content.includes('[HANDOFF]')) {
    clean_content = content.remove('[HANDOFF]');
    set_status('human');
    send_to_user(clean_content);
}
```

### Dashboard UI (`src/pages/Inbox.jsx`)

*   **Indikator:** Badge "Bot Active" (Hijau) vs "CS Active" (Biru).
*   **Tombol:** Tombol aksi berubah sesuai status aktif.
*   **Input:** Selalu aktif (tidak ada status `closed` yang mengunci input).
