-- ============================================
-- V3 KB Metadata Standard Migration
-- Renames 'category' to 'topic' in kb_sources
-- to align with RAG metadata classification standard.
-- Run: psql $DATABASE_URL -f packages/database/v3_kb_metadata_standard.sql
-- ============================================

ALTER TABLE kb_sources RENAME COLUMN category TO topic;
