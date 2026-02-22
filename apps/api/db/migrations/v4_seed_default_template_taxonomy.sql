-- ============================================
-- V4: Seed default template taxonomy (legacy intent map)
-- ============================================
-- Restores the original default categories + subcategories/intents
-- for all existing bots. Safe to run multiple times.
--
-- Run:
--   psql $DATABASE_URL -f apps/api/db/migrations/v4_seed_default_template_taxonomy.sql

WITH default_categories AS (
  SELECT * FROM (VALUES
    ('engagement', 'Engagement', 'Sapaan awal dan re-engagement pelanggan'),
    ('discovery',  'Discovery',  'Eksplorasi kebutuhan dan informasi layanan'),
    ('evaluation', 'Evaluation', 'Harga, keberatan, dan pembandingan'),
    ('conversion', 'Conversion', 'Ajakan transaksi dan konfirmasi'),
    ('retention',  'Retention',  'Layanan purna jual, komplain, dan reschedule')
  ) AS c(key, label, description)
)
INSERT INTO template_categories (bot_id, key, label, description, is_active, sort_order)
SELECT
  b.id AS bot_id,
  c.key,
  c.label,
  c.description,
  true,
  CASE c.key
    WHEN 'engagement' THEN 10
    WHEN 'discovery' THEN 20
    WHEN 'evaluation' THEN 30
    WHEN 'conversion' THEN 40
    WHEN 'retention' THEN 50
    ELSE 999
  END
FROM bots b
CROSS JOIN default_categories c
ON CONFLICT (bot_id, key) DO UPDATE
SET
  is_active = true,
  updated_at = NOW();

WITH default_subcategories AS (
  SELECT * FROM (VALUES
    ('engagement','engagement.greeting_new','Greeting New','Sapaan untuk kontak baru pertama kali chat','opening','required',3,10),
    ('engagement','engagement.greeting_return','Greeting Return','Sapaan untuk pelanggan lama yang kembali','opening','required',3,20),
    ('engagement','engagement.time_inquiry','Time Inquiry','Pertanyaan jam operasional dan ketersediaan','mixed','optional_short',3,30),

    ('discovery','discovery.program_detail','Program Detail','Penjelasan ringkas program/jasa','continuation','forbidden',4,10),
    ('discovery','discovery.schedule_location','Schedule Location','Jadwal dan lokasi layanan','continuation','forbidden',3,20),
    ('discovery','discovery.tutor_profile','Tutor Profile','Profil tim/pengajar/tenaga ahli','continuation','forbidden',3,30),
    ('discovery','discovery.curriculum','Curriculum','Materi, metode, dan tahapan layanan','continuation','forbidden',3,40),

    ('evaluation','evaluation.pricing_inquiry','Pricing Inquiry','Pertanyaan harga tanpa keberatan','continuation','forbidden',4,10),
    ('evaluation','evaluation.objection_price','Objection Price','Keberatan harga mahal','continuation','forbidden',4,20),
    ('evaluation','evaluation.objection_compare','Objection Compare','Perbandingan dengan kompetitor','continuation','forbidden',3,30),
    ('evaluation','evaluation.objection_risk','Objection Risk','Keberatan risiko / takut tidak cocok','continuation','forbidden',4,40),
    ('evaluation','evaluation.objection_authority','Objection Authority','Keraguan kredibilitas','continuation','forbidden',3,50),
    ('evaluation','evaluation.objection_urgency','Objection Urgency','Nanti dulu / pikir-pikir','continuation','forbidden',3,60),

    ('conversion','conversion.soft','Conversion Soft','Ajakan lanjut secara lembut','continuation','forbidden',3,10),
    ('conversion','conversion.transaction','Conversion Transaction','Instruksi pembayaran/pendaftaran','continuation','forbidden',3,20),
    ('conversion','conversion.confirm','Conversion Confirm','Konfirmasi pendaftaran/pembayaran','continuation','forbidden',3,30),

    ('retention','retention.complaint_service','Complaint Service','Keluhan layanan dan solusi','continuation','forbidden',4,10),
    ('retention','retention.complaint_refund','Complaint Refund','Permintaan refund dan prosedur','continuation','forbidden',3,20),
    ('retention','retention.progress_inquiry','Progress Inquiry','Pertanyaan progres layanan','continuation','forbidden',3,30),
    ('retention','retention.reschedule','Reschedule','Permintaan ganti jadwal','continuation','forbidden',3,40)
  ) AS s(
    category_key,
    key,
    label,
    description,
    reply_mode,
    greeting_policy,
    default_template_count,
    sort_order
  )
)
INSERT INTO template_subcategories (
  bot_id,
  category_key,
  key,
  label,
  description,
  reply_mode,
  greeting_policy,
  default_template_count,
  strategy_pool,
  sort_order,
  is_active
)
SELECT
  b.id AS bot_id,
  s.category_key,
  s.key,
  s.label,
  s.description,
  s.reply_mode,
  s.greeting_policy,
  s.default_template_count,
  '[]'::jsonb,
  s.sort_order,
  true
FROM bots b
CROSS JOIN default_subcategories s
ON CONFLICT (bot_id, key) DO UPDATE
SET
  is_active = true,
  updated_at = NOW();
