-- v2_idempotency_indexes.sql
-- Unique partial indexes to prevent duplicate messages from webhook retries
-- These make the idempotency guards in hooks.js race-safe (atomic at DB level)

-- WhatsApp: prevent duplicate wa_message_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_wa_message_id
  ON messages ((raw->>'wa_message_id'))
  WHERE raw->>'wa_message_id' IS NOT NULL;

-- Telegram: prevent duplicate telegram_update_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_telegram_update_id
  ON messages ((raw->>'telegram_update_id'))
  WHERE raw->>'telegram_update_id' IS NOT NULL;
