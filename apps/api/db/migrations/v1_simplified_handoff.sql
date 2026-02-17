-- ============================================
-- V1 Simplified Handoff Migration
-- Adds tracking fields and converts status values
-- Run: psql $DATABASE_URL -f db/migrations/v1_simplified_handoff.sql
-- ============================================

-- Add new tracking fields for handoff timeout
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS last_agent_reply_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unanswered_count INTEGER DEFAULT 0;

-- Convert existing status values to new V1 model
UPDATE conversations SET status = 'bot' WHERE status = 'open';
UPDATE conversations SET status = 'human' WHERE status IN ('handoff', 'closed');

-- Change default for new conversations
ALTER TABLE conversations ALTER COLUMN status SET DEFAULT 'bot';

-- Index for efficient gatekeeper queries
CREATE INDEX IF NOT EXISTS idx_conversations_status_handoff 
  ON conversations(status, last_agent_reply_at) 
  WHERE status = 'human';
