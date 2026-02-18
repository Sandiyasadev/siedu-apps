# API Reference

Base URL Testing: `http://localhost:8080/v1`
Base URL Production: `https://api.yourdomain.com/v1`

## Authentication

Menggunakan Bearer Token (JWT).
Header: `Authorization: Bearer <token>`

Internal API menggunakan: `x-internal-key: <INTERNAL_API_KEY>` atau `Authorization: Bearer <INTERNAL_API_KEY>`

---

## 1. Auth

### Login
`POST /auth/login`

**Body:**
```json
{
  "email": "admin@example.com",
  "password": "password"
}
```

**Response:** `{ token, user }`

### Get Current User
`GET /auth/me` *(Auth required)*

**Response:** `{ user }`

---

## 2. Conversations

### Dashboard Stats
`GET /conversations/stats` *(Auth required)*

**Response:** `{ stats: { totalConversations, conversationsByStatus: { bot, human }, ... } }`
*Cached 60 detik.*

### List Conversations
`GET /conversations` *(Auth required)*

**Query Params:**
- `bot_id`: Filter by bot
- `status`: `'bot'`, `'human'`, `'all'` (default)
- `channel_type`: `'telegram'`, `'whatsapp'`, `'all'` (default)
- `limit`: max `100` (default `50`)
- `cursor`: cursor_id untuk pagination
- `direction`: `'next'` (default) atau `'prev'`

### Get Conversation Detail
`GET /conversations/:id` *(Auth required)*

### Get Messages
`GET /conversations/:id/messages` *(Auth required)*

**Query Params:**
- `limit`: max `100` (default `50`)
- `cursor`: cursor_id untuk pagination
- `direction`: `'older'` (default) atau `'newer'`

### Send Message (Agent Reply)
`POST /conversations/:id/messages` *(Auth required)*

Mendukung text dan media (multipart/form-data).

**Body (text):**
```json
{ "content": "Halo, ada yang bisa dibantu?" }
```

**Body (media):** `form-data` dengan field `file` dan opsional `content` (caption).
*Max file size: 20MB. Otomatis set `last_agent_reply_at` dan reset `unanswered_count`.*

### Update Status (Handoff Toggle)
`PATCH /conversations/:id/status` *(Auth required)*

**Body:**
```json
{ "status": "human" }
```
*V1 hanya: `bot` atau `human`.*

### Mark as Read
`POST /conversations/:id/read` *(Auth required)*

Reset `unread_count` ke 0 dan set `agent_read_at`.

### Update Contact Name
`PATCH /conversations/:id/contact` *(Auth required)*

**Body:**
```json
{ "name": "John Doe" }
```

### Clear Message History
`DELETE /conversations/:id/messages` *(Auth required)*

Hapus semua pesan di conversation.

---

## 3. Bots

### List Bots
`GET /bots` *(Auth required)*

### Get Bot Detail
`GET /bots/:id` *(Auth required)*

### Create Bot
`POST /bots` *(Auth required)*

### Update Bot
`PATCH /bots/:id` *(Auth required)*

### Delete Bot
`DELETE /bots/:id` *(Auth required)*

### Get Bot Channels
`GET /bots/:id/channels` *(Auth required)*

### Create Channel
`POST /bots/:id/channels` *(Auth required)*

### Update Channel
`PATCH /bots/:id/channels/:channelId` *(Auth required)*

### Delete Channel
`DELETE /bots/:id/channels/:channelId` *(Auth required)*

---

## 4. Templates

### List Templates
`GET /templates?bot_id=<uuid>` *(Auth required)*

### Get Template
`GET /templates/:id` *(Auth required)*

### Create Template
`POST /templates` *(Admin only)*

**Body:**
```json
{
  "bot_id": "uuid",
  "name": "Template Salam",
  "content": "Halo {name}, ada yang bisa dibantu?",
  "category": "greeting",
  "shortcut": "/salam"
}
```

### Update Template
`PATCH /templates/:id` *(Admin only)*

### Delete Template
`DELETE /templates/:id` *(Admin only)*

### Send Template
`POST /templates/:id/send` *(Auth required)*

**Body:**
```json
{
  "conversation_id": "uuid",
  "variables": { "name": "John" }
}
```

---

## 5. Knowledge Base

### List KB Sources
`GET /kb/sources?bot_id=<uuid>` *(Auth required)*

### Upload KB File
`POST /kb/upload` *(Auth required, rate limited)*

Multipart/form-data: field `file`, `bot_id`, opsional `kb_type`, `category`, `language`.

### Get Presigned Upload URL
`GET /kb/upload/presigned?filename=<name>&contentType=<mime>&botId=<uuid>` *(Auth required)*

### Delete KB Source
`DELETE /kb/sources/:id` *(Auth required)*

---

## 6. Webhooks (Public)

Tidak perlu Authentication (dilindungi oleh validasi provider).

### Telegram Webhook
`POST /hooks/telegram/:bot_public_id`

### Telegram Verification (Meta)
`GET /hooks/whatsapp/:bot_public_id`

### WhatsApp Webhook
`POST /hooks/whatsapp/:bot_public_id`

---

## 7. Internal (n8n Integration)

Dilindungi oleh `x-internal-key` atau `Authorization: Bearer <INTERNAL_API_KEY>`.

### AI Response
`POST /internal/ai-response`

Digunakan oleh n8n untuk mengirim balasan balik ke user.

**Body:**
```json
{
  "conversation_id": "uuid",
  "content": "Jawaban dari AI... [HANDOFF]",
  "handoff": true,
  "handoff_reason": "Customer needs human help"
}
```
*Tag `[HANDOFF]` otomatis dideteksi dan di-strip dari content.*

### Update Conversation State
`POST /internal/update-state`

**Body:**
```json
{
  "conversation_id": "uuid",
  "status": "human",
  "handoff_reason": "Manual escalation"
}
```
*V1 hanya: `bot` atau `human`.*

### Get Conversation State
`GET /internal/conversation-state/:id`

**Response:** `{ status, handoff_reason, handoff_at, assigned_agent, ai_active }`

### Get Bot Config
`GET /internal/bot-config/:botId`

**Response:** `{ bot_id, name, system_prompt, rag_top_k, rag_min_score, llm_provider, llm_model, ... }`

### Log Analytics Event
`POST /internal/log-event`

**Body:**
```json
{
  "bot_id": "uuid",
  "event_type": "msg_received",
  "conversation_id": "uuid",
  "latency_ms": 250
}
```

### Get Analytics
`GET /internal/analytics/:botId?days=7`

---

## 8. Health Check

### Basic Health
`GET /healthz`

**Response:** `{ status: "ok" }`

### API Root
`GET /v1`

**Response:** `{ status: "ok", version: "1.0.0" }`
