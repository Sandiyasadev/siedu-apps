-- ============================================
-- SETUP SUPABASE (RUN THIS IN SQL EDITOR)
-- ============================================

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create Schema for n8n
CREATE SCHEMA IF NOT EXISTS n8n;

-- 3. Create Tables for Application (Public Schema)
-- ============================================
-- WORKSPACES
-- ============================================
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USERS
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_workspace ON public.users(workspace_id);

-- Default workspace
INSERT INTO public.workspaces (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Workspace', 'default')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- BOTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.bots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
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
    handoff_cs_hours_start VARCHAR(10) DEFAULT '09:00',
    handoff_cs_hours_end VARCHAR(10) DEFAULT '18:00',
    handoff_cs_days JSONB DEFAULT '["mon","tue","wed","thu","fri"]'::jsonb,
    n8n_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bots_workspace ON public.bots(workspace_id);

-- ============================================
-- BOT CHANNELS
-- ============================================
CREATE TABLE IF NOT EXISTS public.bot_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    channel_type VARCHAR(50) NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_bot_channels_bot ON public.bot_channels(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_channels_public_id ON public.bot_channels(public_id);

-- ============================================
-- CONTACTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON public.contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contacts_external ON public.contacts(external_id, channel_type);

-- ============================================
-- CONVERSATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cursor_id BIGSERIAL,
    bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    channel_type VARCHAR(50) NOT NULL,
    external_thread_id VARCHAR(255),
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'open',
    handoff_reason TEXT,
    handoff_at TIMESTAMPTZ,
    handoff_status VARCHAR(50) DEFAULT 'bot_active',
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

CREATE INDEX IF NOT EXISTS idx_conversations_bot ON public.conversations(bot_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_user ON public.conversations(last_user_at DESC);

-- ============================================
-- MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cursor_id BIGSERIAL,
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    raw JSONB,
    status VARCHAR(20) DEFAULT 'sent',
    provider_message_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(conversation_id, created_at DESC);

-- ============================================
-- KB SOURCES
-- ============================================
CREATE TABLE IF NOT EXISTS public.kb_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    source_type VARCHAR(50) DEFAULT 'file',
    filename VARCHAR(500),
    original_filename VARCHAR(500),
    content_type VARCHAR(100),
    object_key VARCHAR(500),
    file_size BIGINT,
    status VARCHAR(50) DEFAULT 'processing',
    error_message TEXT,
    chunk_count INTEGER DEFAULT 0,
    kb_type VARCHAR(50) DEFAULT 'facts',
    category VARCHAR(100) DEFAULT 'general',
    language VARCHAR(10) DEFAULT 'id',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    indexed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_sources_bot ON public.kb_sources(bot_id);

-- ============================================
-- KB EMBEDDINGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.kb_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES public.kb_sources(id) ON DELETE CASCADE,
    bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    chunk_index INTEGER,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_embeddings_source ON public.kb_embeddings(source_id);
CREATE INDEX IF NOT EXISTS idx_kb_embeddings_bot ON public.kb_embeddings(bot_id);

-- ============================================
-- ANALYTICS LOG
-- ============================================
CREATE TABLE IF NOT EXISTS public.analytics_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    conversation_id UUID,
    event_type VARCHAR(100) NOT NULL,
    question TEXT,
    answer TEXT,
    status VARCHAR(50),
    latency_ms INTEGER,
    tokens_in INTEGER,
    tokens_out INTEGER,
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_bot ON public.analytics_log(bot_id);
