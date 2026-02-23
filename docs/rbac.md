# RBAC Specification (Admin / Super Admin / User)

Status: Draft (recommended baseline for current Siedu repo)

Tujuan dokumen ini:
- Menjadi source of truth hak akses (`super_admin`, `admin`, `user`)
- Menyamakan backend, frontend, dan UI menu
- Mengurangi kebingungan saat menambah fitur Super Admin

## 1. Definisi Role

### `super_admin` (Platform Level)
- Scope: seluruh platform / semua workspace
- Fokus: tenancy management, preset global, governance
- Boleh override akses lintas workspace

### `admin` (Workspace Admin)
- Scope: 1 workspace (`workspace_id` user)
- Fokus: konfigurasi bot/channel/KB/template + operasional workspace
- Tidak boleh mengakses workspace lain

### `user` (Agent / CS)
- Scope: 1 workspace (`workspace_id` user)
- Fokus: inbox/chat operasional
- Tidak boleh mengubah konfigurasi sistem/bot/workspace

Catatan UI:
- Di dashboard, label `user` sebaiknya ditampilkan sebagai `Agent` atau `CS`

## 2. Prinsip Inti (Wajib)

1. Backend adalah sumber kebenaran permission.
2. Frontend hanya menyembunyikan menu/aksi, bukan enforcement utama.
3. Semua akses non-`super_admin` wajib dibatasi `workspace_id`.
4. Endpoint internal (`/v1/internal`) dan webhook (`/v1/hooks`) bukan role manusia; pakai auth terpisah.
5. Aksi sensitif `super_admin` wajib dicatat ke `audit_log` (minimal create/update/delete/apply preset).

## 3. Scope Akses Object (Aturan Data)

Aturan ini penting agar role check tidak hanya `requireRole(...)` tetapi juga validasi kepemilikan data.

- `workspaces`: hanya `super_admin` yang bisa list/create/update/deactivate
- `users`: `admin` hanya user dalam workspace sendiri; `super_admin` semua workspace
- `bots`: `admin/user` hanya bot dalam workspace sendiri (user biasanya read-only)
- `bot_channels`: mengikuti `bot.workspace_id`
- `conversations` / `messages`: mengikuti `conversation -> bot -> workspace_id`
- `templates` / `template_categories` / `template_subcategories`: mengikuti `bot -> workspace_id`
- `kb_sources` / `kb_embeddings`: mengikuti `bot -> workspace_id`
- `taxonomy_presets` / `template_presets`:
  - `workspace_id IS NULL` = global preset (platform)
  - `workspace_id = <id>` = workspace-scoped preset (opsional, fase lanjut)

## 4. Capability Model (Disarankan)

Gunakan capability sebagai bahasa permission, bukan hardcode role di UI/route.

### Capability List

Auth / profile:
- `auth.login`
- `profile.read_self`

Inbox / conversation:
- `inbox.read`
- `inbox.reply`
- `inbox.mark_read`
- `inbox.update_contact`
- `conversation.status.change`
- `conversation.messages.clear`

Bots / channels:
- `bots.read`
- `bots.manage`
- `channels.read`
- `channels.manage`
- `channels.webhook.manage`

Knowledge base:
- `kb.read`
- `kb.upload`
- `kb.delete`

Templates & taxonomy (workspace):
- `templates.read`
- `templates.use`
- `templates.manage`
- `taxonomy.read`
- `taxonomy.manage`

Workspace administration:
- `workspace.users.read`
- `workspace.users.manage`
- `workspace.settings.read`
- `workspace.settings.manage`
- `workspace.analytics.read`

Super admin / platform:
- `platform.workspaces.read`
- `platform.workspaces.manage`
- `platform.presets.read`
- `platform.presets.manage`
- `platform.presets.assign`
- `platform.presets.apply`
- `platform.audit.read`
- `platform.analytics.read`

## 5. Capability Matrix (Role -> Capability)

### `user` (Agent / CS)
- Ya:
  - `auth.login`
  - `profile.read_self`
  - `inbox.read`
  - `inbox.reply`
  - `inbox.mark_read`
  - `conversation.status.change` (terbatas: `human <-> bot`, tanpa aksi destruktif)
  - `templates.read`
  - `templates.use`
  - `channels.read` (info dasar saja, opsional)
  - `workspace.analytics.read` (opsional, dashboard operasional)
- Tidak:
  - `bots.manage`, `channels.manage`, `kb.*`, `templates.manage`, `taxonomy.manage`, `workspace.users.manage`, semua `platform.*`
- Opsi kebijakan (pilih satu):
  - `Mode A (MVP sederhana)`: `user` bisa lihat semua conversation di workspace
  - `Mode B (lebih ketat)`: `user` hanya conversation yang assigned/queue tertentu

### `admin` (Workspace Admin)
- Semua kemampuan `user`, plus:
  - `bots.read`, `bots.manage`
  - `channels.read`, `channels.manage`, `channels.webhook.manage`
  - `kb.read`, `kb.upload`, `kb.delete`
  - `templates.read`, `templates.use`, `templates.manage`
  - `taxonomy.read`, `taxonomy.manage`
  - `workspace.users.read`, `workspace.users.manage`
  - `workspace.settings.read`, `workspace.settings.manage`
  - `workspace.analytics.read`
- Tidak:
  - `platform.*` (global presets lintas workspace, list all workspaces, dst)

### `super_admin` (Platform)
- Semua kemampuan `admin` (override lintas workspace), plus:
  - `platform.workspaces.read`
  - `platform.workspaces.manage`
  - `platform.presets.read`
  - `platform.presets.manage`
  - `platform.presets.assign`
  - `platform.presets.apply`
  - `platform.audit.read` (sangat disarankan)
  - `platform.analytics.read`
- Catatan:
  - Boleh masuk operasional inbox sebagai emergency override, tapi UI bisa disembunyikan jika tidak dibutuhkan

## 6. Fitur per Role (Bahasa Produk)

### Fitur `super_admin`
- Lihat semua workspace
- Lihat bot per workspace
- Kelola preset global:
  - taxonomy preset
  - template preset
  - item preset
  - import generator JSON
  - bootstrap default presets
- Assign preset ke workspace
- Preview / apply preset ke workspace / bot
- Lihat log apply preset
- Kelola admin tenant (fase berikutnya)
- Lihat analytics lintas workspace (fase berikutnya)
- Lihat audit log platform (fase berikutnya)

### Fitur `admin`
- Kelola bot di workspace sendiri
- Kelola channel bot (create/update/delete/setup webhook)
- Kelola knowledge base (upload/presigned upload/list/delete)
- Kelola template dan taxonomy bot
- Gunakan template untuk balas chat
- Kelola inbox dan status handoff/bot-human
- Kelola user/agent di workspace sendiri (fase berikutnya jika endpoint belum ada)
- Lihat analytics workspace

### Fitur `user` (Agent/CS)
- Login & lihat profil
- Lihat inbox/conversation (sesuai kebijakan assignment)
- Balas chat (text/media)
- Tandai read
- Ubah status conversation (sesuai policy)
- Gunakan template/snippet yang tersedia
- Lihat kontak dasar

## 7. Mapping Endpoint ke Role (Repo Saat Ini)

Referensi route:
- `apps/api/src/index.js`
- `apps/api/src/routes/*.js`

### A. Public / System Endpoints (bukan role manusia)

Public:
- `POST /v1/auth/login` -> public (`authLimiter`)
- `POST /v1/auth/register` -> disabled (public, selalu 403)
- `GET /healthz`, `/health`, `/api/health` -> public

Internal service:
- `/v1/internal/*` -> `INTERNAL_API_KEY` (bukan `user/admin/super_admin`)

Webhook integrations:
- `/v1/hooks/*` -> channel secret/signature (bukan `user/admin/super_admin`)

### B. Human Auth Endpoints

`/v1/auth`
- `GET /me`
  - `user`, `admin`, `super_admin`
  - scope: self only

### C. Conversation / Inbox Endpoints (`/v1/conversations`)

Current code: route group dipasang dengan `authenticate` di `apps/api/src/index.js`.
Target policy:

- `GET /unread-count` -> `user|admin|super_admin`
- `GET /stats` -> `user|admin|super_admin` (hasil dibatasi workspace / assignment policy)
- `GET /` -> `user|admin|super_admin`
- `GET /:id` -> `user|admin|super_admin` (harus satu workspace)
- `GET /:id/messages` -> `user|admin|super_admin`
- `POST /:id/read` -> `user|admin|super_admin`
- `POST /:id/messages` -> `user|admin|super_admin`
- `PATCH /:id/status` -> `user|admin|super_admin`
  - batasan `user`: hanya transition yang diizinkan (mis. `bot <-> human`)
- `PATCH /:id/contact` -> `admin|super_admin` (disarankan)
  - opsi: `user` boleh edit field ringan (`name`) jika dibutuhkan
- `DELETE /:id/messages` -> `admin|super_admin` (destruktif)

### D. Bots & Channels Endpoints (`/v1/bots`)

Read:
- `GET /`
- `GET /:id`
- `GET /:id/channels/types`
- `GET /:id/channels`
- `GET /:id/channels/:channelId`
  - `user|admin|super_admin` (read-only)
  - jika dirasa terlalu sensitif untuk `user`, batasi ke `admin|super_admin`

Manage (konfigurasi):
- `POST /`
- `PATCH /:id`
- `DELETE /:id`
- `POST /:id/channels`
- `GET /:id/channels/:channelId/config`
- `PATCH /:id/channels/:channelId`
- `POST /:id/channels/:channelId/setup-webhook`
- `GET /:id/channels/:channelId/webhook-info`
- `DELETE /:id/channels/:channelId`
  - `admin|super_admin`

### E. Knowledge Base Endpoints (`/v1/kb`)

- `GET /sources` -> `user|admin|super_admin` (opsional; jika metadata sensitif, `admin+`)
- `GET /upload/presigned` -> `admin|super_admin`
- `POST /upload` -> `admin|super_admin`
- `DELETE /sources/:id` -> `admin|super_admin`

Rekomendasi:
- Untuk MVP lebih aman, semua `/v1/kb/*` = `admin|super_admin`

### F. Templates Endpoints (`/v1/templates`)

Read/use:
- `GET /` -> `user|admin|super_admin`
- `GET /:id` -> `user|admin|super_admin`
- `POST /:id/send` -> `user|admin|super_admin`

Manage:
- `POST /apply-default` -> `admin|super_admin`
- `POST /` -> `admin|super_admin`
- `PATCH /:id` -> `admin|super_admin`
- `DELETE /:id` -> `admin|super_admin`

### G. Template Taxonomy Endpoints (`/v1/template-taxonomy`)

Read:
- `GET /` -> `user|admin|super_admin`

Manage:
- `POST /apply-default`
- `POST /categories`
- `PATCH /categories/:id`
- `DELETE /categories/:id`
- `POST /subcategories`
- `PATCH /subcategories/:id`
- `DELETE /subcategories/:id`
  - `admin|super_admin`

### H. Media Endpoints (`/v1/media`)

Gunakan aturan paling konservatif karena file bisa sensitif:
- `GET /resolve` -> `user|admin|super_admin` (harus validasi workspace ownership)
- `GET /:year/:month/:filename` -> `user|admin|super_admin` (harus validasi workspace ownership / signed resolution path)

Catatan:
- Jangan andalkan obscurity path filename; tetap cek hak akses.

### I. Super Admin Endpoints (`/v1/admin`)

Semua endpoint `/v1/admin/*`:
- `super_admin` only
- current code sudah sesuai lewat `router.use(authenticate)` + `router.use(requireRole('super_admin'))`

Cakupan fitur yang sekarang terlihat di route:
- workspace listing + bots by workspace
- preset assignment per workspace
- apply/preview apply presets
- CRUD taxonomy presets + categories + subcategories
- CRUD template presets + items
- import generator JSON
- bootstrap defaults
- preset apply logs

## 8. Mapping UI Menu (Dashboard)

Referensi:
- `apps/dashboard/src/App.jsx`
- `apps/dashboard/src/components/Layout.jsx`

### Menu `user`
- `Dashboard`
- `Inbox`
- (Opsional) `Bots` read-only / hidden
- (Opsional) `Knowledge Base` hidden

### Menu `admin`
- `Dashboard`
- `Inbox`
- `AI Bots`
- `Knowledge Base`
- Bot detail tabs (channels, templates, settings, knowledge)

### Menu `super_admin`
- Semua menu `admin`
- `Super Admin` (`/admin`)

Catatan implementasi UI saat ini:
- `Layout.jsx` sudah hanya menampilkan menu Super Admin jika `user.role === 'super_admin'`
- Menu `Bots` dan `Knowledge Base` masih tampil untuk semua authenticated user, jadi jika ingin `user` lebih terbatas perlu penyesuaian UI + backend

## 9. Aturan Status Conversation (Agar Role Tidak Bentrok)

Disarankan tetapkan policy berikut:

- `user`:
  - boleh `mark_read`
  - boleh reply
  - boleh ubah status `bot -> human` dan `human -> bot` (jika kebijakan tim mengizinkan)
  - tidak boleh clear seluruh messages

- `admin`:
  - semua aksi `user`
  - boleh clear messages
  - boleh edit contact
  - boleh force status transition

- `super_admin`:
  - override semua (untuk troubleshooting)

## 10. Implementasi Backend yang Disarankan (Tahap Berikutnya)

Minimal perubahan agar rapi:

1. Pertahankan `requireRole`, tambahkan policy helper per domain
- contoh:
  - `requireConversationAccess(action)`
  - `requireBotAccess(action)`
  - `requireKbAccess(action)`

2. Tambahkan capability resolver
- `getCapabilitiesForRole(role)`
- dipakai di backend (enforcement) dan frontend (menu/aksi)

3. Pisahkan validasi:
- `role check` (boleh aksi apa)
- `scope check` (resource milik workspace mana)

4. Tambahkan audit log untuk aksi sensitif
- `super_admin` preset CRUD/apply/assign
- admin config changes (bots/channels/webhook)

## 11. Keputusan Produk yang Perlu Kamu Tetapkan (Supaya Implementasi Tidak Maju-Mundur)

Pilih dan tetapkan sekarang:

1. `user` bisa lihat semua inbox workspace atau hanya assigned?
2. `user` boleh ubah status `return to bot` atau hanya `admin`?
3. `user` boleh lihat menu `Bots/KB` read-only atau disembunyikan penuh?
4. `admin` boleh apply preset workspace-assigned sendiri atau hanya `super_admin`?

Rekomendasi MVP:
- `user` = semua inbox workspace (lebih sederhana)
- `user` boleh `return to bot`
- `user` tidak lihat `Bots/KB`
- `admin` boleh apply preset yang sudah diassign (tidak boleh CRUD global preset)

## 12. Ringkasan Final (Rule of Thumb)

- `super_admin` = kelola platform & tenant
- `admin` = kelola konfigurasi dan operasional 1 workspace
- `user` = operasional inbox/chat saja
- Semua non-super-admin dibatasi `workspace_id`
- Endpoint internal/webhook pakai auth terpisah, bukan role user
