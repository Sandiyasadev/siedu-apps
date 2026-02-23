-- ============================================
-- Super Admin Presets (Taxonomy + Templates)
-- ============================================

CREATE TABLE IF NOT EXISTS taxonomy_presets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    description TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_taxonomy_presets_status
        CHECK (status IN ('draft', 'published', 'archived')),
    CONSTRAINT chk_taxonomy_presets_version
        CHECK (version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_taxonomy_presets_scope_key_version
    ON taxonomy_presets (COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid), key, version);

CREATE INDEX IF NOT EXISTS idx_taxonomy_presets_scope_status
    ON taxonomy_presets (workspace_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS taxonomy_preset_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    preset_id UUID NOT NULL REFERENCES taxonomy_presets(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (preset_id, key)
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_preset_categories_preset
    ON taxonomy_preset_categories (preset_id, sort_order, label);

CREATE TABLE IF NOT EXISTS taxonomy_preset_subcategories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    preset_id UUID NOT NULL REFERENCES taxonomy_presets(id) ON DELETE CASCADE,
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
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (preset_id, key),
    CONSTRAINT chk_taxonomy_preset_subcategories_reply_mode
        CHECK (reply_mode IN ('opening', 'mixed', 'continuation')),
    CONSTRAINT chk_taxonomy_preset_subcategories_greeting_policy
        CHECK (greeting_policy IN ('required', 'optional_short', 'forbidden')),
    CONSTRAINT chk_taxonomy_preset_subcategories_default_count
        CHECK (default_template_count > 0)
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_preset_subcategories_preset
    ON taxonomy_preset_subcategories (preset_id, category_key, sort_order, label);

CREATE TABLE IF NOT EXISTS template_presets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    taxonomy_preset_id UUID REFERENCES taxonomy_presets(id) ON DELETE SET NULL,
    key VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    description TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_template_presets_status
        CHECK (status IN ('draft', 'published', 'archived')),
    CONSTRAINT chk_template_presets_version
        CHECK (version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_template_presets_scope_key_version
    ON template_presets (COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid), key, version);

CREATE INDEX IF NOT EXISTS idx_template_presets_scope_status
    ON template_presets (workspace_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS template_preset_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_preset_id UUID NOT NULL REFERENCES template_presets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    sub_category VARCHAR(100),
    shortcut VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    strategy_tag VARCHAR(100),
    requires_rag BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (template_preset_id, sub_category, name)
);

CREATE INDEX IF NOT EXISTS idx_template_preset_items_preset
    ON template_preset_items (template_preset_id, category, sub_category, sort_order);

CREATE TABLE IF NOT EXISTS workspace_preset_assignments (
    workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    taxonomy_preset_id UUID REFERENCES taxonomy_presets(id) ON DELETE SET NULL,
    template_preset_id UUID REFERENCES template_presets(id) ON DELETE SET NULL,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS preset_apply_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
    taxonomy_preset_id UUID REFERENCES taxonomy_presets(id) ON DELETE SET NULL,
    template_preset_id UUID REFERENCES template_presets(id) ON DELETE SET NULL,
    mode VARCHAR(50) NOT NULL DEFAULT 'skip_existing',
    action_scope VARCHAR(20) NOT NULL DEFAULT 'both',
    summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_preset_apply_logs_action_scope
        CHECK (action_scope IN ('taxonomy', 'templates', 'both'))
);

CREATE INDEX IF NOT EXISTS idx_preset_apply_logs_workspace_created
    ON preset_apply_logs (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_preset_apply_logs_bot_created
    ON preset_apply_logs (bot_id, created_at DESC);
