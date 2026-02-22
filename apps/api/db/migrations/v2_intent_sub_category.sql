-- ============================================
-- V2: 2-Level Intent Sub-Category Migration
-- Adds sub_category column to templates table
-- Run: psql $DATABASE_URL -f db/migrations/v2_intent_sub_category.sql
-- ============================================

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS sub_category VARCHAR(100);

-- Backfill: existing templates get sub_category mirroring their category
UPDATE templates
  SET sub_category = category
  WHERE sub_category IS NULL;

-- Composite index for fast intent routing queries
CREATE INDEX IF NOT EXISTS idx_templates_sub_cat
  ON templates(bot_id, sub_category)
  WHERE is_active = true;

-- Seed comment: valid sub_category values
-- engagement.greeting_new | engagement.greeting_return | engagement.time_inquiry
-- discovery.program_detail | discovery.schedule_location | discovery.tutor_profile | discovery.curriculum
-- evaluation.pricing_inquiry | evaluation.objection_price | evaluation.objection_compare
-- evaluation.objection_risk | evaluation.objection_authority | evaluation.objection_urgency
-- conversion.soft | conversion.transaction | conversion.confirm
-- retention.complaint_service | retention.complaint_refund | retention.progress_inquiry | retention.reschedule
