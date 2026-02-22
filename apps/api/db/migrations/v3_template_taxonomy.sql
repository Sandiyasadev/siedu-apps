-- ============================================
-- V3: Dynamic template taxonomy (category + sub_category metadata)
-- ============================================
-- Run: psql $DATABASE_URL -f apps/api/db/migrations/v3_template_taxonomy.sql

CREATE TABLE IF NOT EXISTS template_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bot_id, key)
);

CREATE INDEX IF NOT EXISTS idx_template_categories_bot
  ON template_categories(bot_id, is_active, sort_order);

CREATE TABLE IF NOT EXISTS template_subcategories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  category_key VARCHAR(100) NOT NULL,
  key VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT,
  reply_mode VARCHAR(20) NOT NULL DEFAULT 'continuation',
  greeting_policy VARCHAR(20) NOT NULL DEFAULT 'forbidden',
  default_template_count INTEGER NOT NULL DEFAULT 3,
  strategy_pool JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bot_id, key),
  CONSTRAINT chk_template_subcategories_reply_mode
    CHECK (reply_mode IN ('opening', 'mixed', 'continuation')),
  CONSTRAINT chk_template_subcategories_greeting_policy
    CHECK (greeting_policy IN ('required', 'optional_short', 'forbidden')),
  CONSTRAINT chk_template_subcategories_default_count
    CHECK (default_template_count > 0)
);

CREATE INDEX IF NOT EXISTS idx_template_subcategories_bot
  ON template_subcategories(bot_id, is_active, category_key, sort_order);

-- Seed categories from existing templates (safe to rerun)
INSERT INTO template_categories (bot_id, key, label)
SELECT DISTINCT
  t.bot_id,
  t.category,
  INITCAP(REPLACE(t.category, '_', ' '))
FROM templates t
WHERE t.category IS NOT NULL
  AND NULLIF(TRIM(t.category), '') IS NOT NULL
ON CONFLICT (bot_id, key) DO NOTHING;

-- Seed subcategories/intents from existing templates (safe to rerun)
INSERT INTO template_subcategories (
  bot_id,
  category_key,
  key,
  label,
  reply_mode,
  greeting_policy,
  default_template_count
)
SELECT DISTINCT
  t.bot_id,
  COALESCE(NULLIF(SPLIT_PART(t.sub_category, '.', 1), ''), t.category) AS category_key,
  t.sub_category AS key,
  INITCAP(REPLACE(COALESCE(NULLIF(SPLIT_PART(t.sub_category, '.', 2), ''), t.sub_category), '_', ' ')) AS label,
  CASE
    WHEN t.sub_category IN ('engagement.greeting_new', 'engagement.greeting_return') THEN 'opening'
    WHEN t.sub_category = 'engagement.time_inquiry' THEN 'mixed'
    ELSE 'continuation'
  END AS reply_mode,
  CASE
    WHEN t.sub_category IN ('engagement.greeting_new', 'engagement.greeting_return') THEN 'required'
    WHEN t.sub_category = 'engagement.time_inquiry' THEN 'optional_short'
    ELSE 'forbidden'
  END AS greeting_policy,
  3 AS default_template_count
FROM templates t
WHERE t.sub_category IS NOT NULL
  AND NULLIF(TRIM(t.sub_category), '') IS NOT NULL
ON CONFLICT (bot_id, key) DO NOTHING;
