# API Reference

Base URL Testing: `http://localhost:8080/v1`
Base URL Production: `https://api.yourdomain.com/v1`

## Authentication

Menggunakan Bearer Token (JWT).
Header: `Authorization: Bearer <token>`

---

## 1. Conversations

### Get All Conversations
`GET /conversations`

**Query Params:**
- `status`: `'bot'`, `'human'`, `'all'` (default)
- `limit`: `20`
- `cursor`: Pagination cursor

### Get Messages
`GET /conversations/:id/messages`

**Query Params:**
- `limit`: `50`
- `cursor`: Pagination cursor

### Update Status (Handoff)
`PATCH /conversations/:id/status`

**Body:**
```json
{
  "status": "human" // atau "bot"
}
```

### Send Message (Agent Reply)
`POST /conversations/:id/messages`

**Body:**
```json
{
  "content": "Halo, ada yang bisa dibantu?"
}
```
*(Otomatis set `last_agent_reply_at` dan reset `unanswered_count`)*

---

## 2. Webhooks (Public)

Tidak perlu Authentication (dilindungi oleh validasi provider).

### Telegram Webhook
`POST /hooks/telegram/:bot_id`

### WhatsApp Webhook
`POST /hooks/whatsapp/:bot_id`

---

## 3. Internal (n8n Integration)

Dilindungi oleh `x-api-key`.

### AI Response
`POST /internal/ai-response`

Digunakan oleh n8n untuk mengirim balasan balik ke user.

**Body:**
```json
{
  "conversation_id": "uuid",
  "content": "Jawaban dari AI... [HANDOFF]",
  "handoff": true // Opsional, atau deteksi tag
}
```
