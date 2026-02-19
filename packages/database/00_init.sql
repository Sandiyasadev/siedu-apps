-- ============================================
-- Dashboard Apps - Database Schema
-- Auto-runs via docker-compose init
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- WORKSPACES
-- ============================================
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USERS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_workspace ON users(workspace_id);

-- Default workspace (untuk register pertama kali)
INSERT INTO workspaces (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Workspace', 'default')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- BOTS
-- ============================================
CREATE TABLE IF NOT EXISTS bots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    system_prompt TEXT DEFAULT '',
    rag_top_k INTEGER DEFAULT 6,
    rag_min_score FLOAT DEFAULT 0.5,
    handoff_enabled BOOLEAN DEFAULT true,
    handoff_min_score FLOAT DEFAULT 0.15,
    llm_provider VARCHAR(50) DEFAULT 'openai',
    llm_model VARCHAR(100) DEFAULT 'gpt-4o-mini',
    embed_provider VARCHAR(50) DEFAULT 'openai',
    embed_model VARCHAR(100) DEFAULT 'text-embedding-3-small',
    booking_link TEXT,
    -- CS hours for handoff
    handoff_cs_hours_start VARCHAR(10) DEFAULT '09:00',
    handoff_cs_hours_end VARCHAR(10) DEFAULT '18:00',
    handoff_cs_days JSONB DEFAULT '["mon","tue","wed","thu","fri"]'::jsonb,
    -- n8n integration config
    n8n_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bots_workspace ON bots(workspace_id);

-- ============================================
-- BOT CHANNELS
-- ============================================
CREATE TABLE IF NOT EXISTS bot_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    channel_type VARCHAR(50) NOT NULL, -- telegram, whatsapp, facebook, instagram, discord
    name VARCHAR(255),
    public_id VARCHAR(100) UNIQUE,
    secret VARCHAR(255),
    config JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'pending_setup',
    status_message TEXT,
    is_enabled BOOLEAN DEFAULT true,
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(bot_id, channel_type)
);

CREATE INDEX IF NOT EXISTS idx_bot_channels_bot ON bot_channels(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_channels_public_id ON bot_channels(public_id);
CREATE INDEX IF NOT EXISTS idx_bot_channels_type ON bot_channels(channel_type);

-- ============================================
-- CONTACTS
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    channel_type VARCHAR(50),
    name VARCHAR(255),
    display_name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    avatar_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    total_conversations INTEGER DEFAULT 0,
    last_conversation_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, external_id, channel_type)
);

CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contacts_external ON contacts(external_id, channel_type);

-- ============================================
-- CONVERSATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cursor_id BIGSERIAL,
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    channel_type VARCHAR(50) NOT NULL,
    external_thread_id VARCHAR(255),
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'bot', -- V1: bot, human
    -- Handoff fields
    handoff_reason TEXT,
    handoff_at TIMESTAMPTZ,
    handoff_status VARCHAR(50) DEFAULT 'bot_active', -- bot_active, handoff_pending, human_active, resolved
    handoff_score INTEGER DEFAULT 0,
    handoff_signals JSONB DEFAULT '[]'::jsonb,
    handoff_summary TEXT,
    handoff_detected_facts JSONB DEFAULT '[]'::jsonb,
    handoff_suggested_actions JSONB DEFAULT '[]'::jsonb,
    handoff_requested_at TIMESTAMPTZ,
    handoff_accepted_at TIMESTAMPTZ,
    handoff_resolved_at TIMESTAMPTZ,
    pending_handoff_offer BOOLEAN DEFAULT false,
    assigned_agent VARCHAR(255),
    -- Message tracking
    last_user_at TIMESTAMPTZ,
    last_message_preview TEXT,
    last_message_at TIMESTAMPTZ,
    last_message_role VARCHAR(20),
    message_count INTEGER DEFAULT 0,
    unread_count INTEGER DEFAULT 0,
    agent_read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(bot_id, channel_type, external_thread_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_bot ON conversations(bot_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_cursor ON conversations(cursor_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_thread ON conversations(external_thread_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_user ON conversations(last_user_at DESC);

-- ============================================
-- MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cursor_id BIGSERIAL,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- user, assistant, system, agent
    content TEXT NOT NULL,
    raw JSONB,
    status VARCHAR(20) DEFAULT 'sent', -- sent, delivered, read, failed
    provider_message_id VARCHAR(255), -- external message ID (e.g. wamid.xxx for WhatsApp)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_cursor ON messages(cursor_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_provider_id ON messages(provider_message_id);

-- ============================================
-- TEMPLATES
-- ============================================
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    shortcut VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    use_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_bot ON templates(bot_id);

-- ============================================
-- KB SOURCES
-- ============================================
CREATE TABLE IF NOT EXISTS kb_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    source_type VARCHAR(50) DEFAULT 'file',
    filename VARCHAR(500),
    original_filename VARCHAR(500),
    content_type VARCHAR(100),
    object_key VARCHAR(500), -- MinIO object key
    file_size BIGINT,
    status VARCHAR(50) DEFAULT 'processing', -- processing, indexed, error, deleted
    error_message TEXT,
    chunk_count INTEGER DEFAULT 0,
    kb_type VARCHAR(50) DEFAULT 'facts',
    category VARCHAR(100) DEFAULT 'general',
    language VARCHAR(10) DEFAULT 'id',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    indexed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_sources_bot ON kb_sources(bot_id);
CREATE INDEX IF NOT EXISTS idx_kb_sources_status ON kb_sources(status);

-- ============================================
-- KB EMBEDDINGS
-- ============================================
CREATE TABLE IF NOT EXISTS kb_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES kb_sources(id) ON DELETE CASCADE,
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    chunk_index INTEGER,
    content TEXT NOT NULL,
    embedding vector(1536), -- OpenAI text-embedding-3-small dimension
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_embeddings_source ON kb_embeddings(source_id);
CREATE INDEX IF NOT EXISTS idx_kb_embeddings_bot ON kb_embeddings(bot_id);

-- ============================================
-- N8N VECTORS (used by n8n PGVector node)
-- ============================================
CREATE TABLE IF NOT EXISTS n8n_vectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_n8n_vectors_metadata ON n8n_vectors USING gin(metadata);

-- ============================================
-- HANDOFF QUEUE
-- ============================================
CREATE TABLE IF NOT EXISTS handoff_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 50,
    handoff_score INTEGER DEFAULT 0,
    trigger_type VARCHAR(50) DEFAULT 'scoring', -- explicit, scoring, manual
    trigger_signal VARCHAR(100),
    customer_name VARCHAR(255),
    customer_contact VARCHAR(255),
    channel_type VARCHAR(50),
    summary TEXT,
    detected_facts JSONB DEFAULT '[]'::jsonb,
    suggested_actions JSONB DEFAULT '[]'::jsonb,
    recent_messages JSONB DEFAULT '[]'::jsonb,
    message_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'waiting', -- waiting, assigned, resolved, cancelled, abandoned
    assigned_agent_id UUID,
    assigned_agent_name VARCHAR(255),
    assigned_at TIMESTAMPTZ,
    resolution_notes TEXT,
    csat_score INTEGER,
    csat_feedback TEXT,
    resolved_at TIMESTAMPTZ,
    queue_position INTEGER DEFAULT 1,
    estimated_wait_minutes INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handoff_queue_bot ON handoff_queue(bot_id);
CREATE INDEX IF NOT EXISTS idx_handoff_queue_status ON handoff_queue(status);
CREATE INDEX IF NOT EXISTS idx_handoff_queue_conv ON handoff_queue(conversation_id);

-- ============================================
-- HANDOFF HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS handoff_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- requested, assigned, resolved, returned_to_bot
    from_status VARCHAR(50),
    to_status VARCHAR(50),
    actor_type VARCHAR(50), -- bot, agent, system
    actor_id UUID,
    actor_name VARCHAR(255),
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handoff_history_conv ON handoff_history(conversation_id);

-- ============================================
-- ANALYTICS LOG
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    conversation_id UUID,
    event_type VARCHAR(100) NOT NULL, -- msg_received, answer_sent, handoff, etc.
    question TEXT,
    answer TEXT,
    status VARCHAR(50),
    latency_ms INTEGER,
    tokens_in INTEGER,
    tokens_out INTEGER,
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_bot ON analytics_log(bot_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_log(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_log(created_at);

-- ============================================
-- AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    actor VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_log(workspace_id);

-- ============================================
-- VIEW: Active Handoff Queue
-- ============================================
CREATE OR REPLACE VIEW v_active_handoff_queue AS
SELECT
    hq.*,
    c.external_thread_id,
    c.channel_type as conv_channel_type,
    c.last_user_at,
    b.name as bot_name
FROM handoff_queue hq
JOIN conversations c ON c.id = hq.conversation_id
JOIN bots b ON b.id = hq.bot_id
WHERE hq.status IN ('waiting', 'assigned');

-- ============================================
-- FUNCTION: Check CS Availability
-- ============================================
CREATE OR REPLACE FUNCTION is_cs_available(p_bot_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_start VARCHAR;
    v_end VARCHAR;
    v_days JSONB;
    v_now TIME;
    v_today VARCHAR;
    v_day_names TEXT[] := ARRAY['sun','mon','tue','wed','thu','fri','sat'];
BEGIN
    -- Get bot CS hours config
    SELECT handoff_cs_hours_start, handoff_cs_hours_end, handoff_cs_days
    INTO v_start, v_end, v_days
    FROM bots WHERE id = p_bot_id;

    IF v_start IS NULL OR v_end IS NULL THEN
        RETURN true; -- Default available if not configured
    END IF;

    -- Current time in WIB (UTC+7)
    v_now := (NOW() AT TIME ZONE 'Asia/Jakarta')::TIME;
    v_today := v_day_names[EXTRACT(DOW FROM NOW() AT TIME ZONE 'Asia/Jakarta')::INT + 1];

    -- Check if today is a working day
    IF NOT v_days ? v_today THEN
        RETURN false;
    END IF;

    -- Check if current time is within CS hours
    RETURN v_now BETWEEN v_start::TIME AND v_end::TIME;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Trigger: Auto-update conversation summary fields
-- ============================================
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations SET
        last_message_preview = LEFT(NEW.content, 200),
        last_message_at = NEW.created_at,
        last_message_role = NEW.role,
        message_count = message_count + 1,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_conversation_on_message ON messages;
CREATE TRIGGER trg_update_conversation_on_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_on_message();

-- ============================================
-- Trigger: Auto-set queue_position on handoff insert
-- ============================================
CREATE OR REPLACE FUNCTION set_queue_position()
RETURNS TRIGGER AS $$
BEGIN
    SELECT COALESCE(MAX(queue_position), 0) + 1
    INTO NEW.queue_position
    FROM handoff_queue
    WHERE bot_id = NEW.bot_id AND status = 'waiting';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_queue_position ON handoff_queue;
CREATE TRIGGER trg_set_queue_position
    BEFORE INSERT ON handoff_queue
    FOR EACH ROW
    EXECUTE FUNCTION set_queue_position();
