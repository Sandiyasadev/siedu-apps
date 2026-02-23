-- ============================================
-- v6: Preset System Merge
-- Merges taxonomy_presets + template_presets → preset_bundles
-- Merges taxonomy_preset_categories → preset_categories
-- Merges taxonomy_preset_subcategories → preset_subcategories
-- Merges template_preset_items → preset_items
-- ============================================

-- ============================================
-- PHASE 1: Create new unified tables
-- ============================================

CREATE TABLE IF NOT EXISTS preset_bundles (
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
    CONSTRAINT chk_preset_bundles_status
        CHECK (status IN ('draft', 'published', 'archived')),
    CONSTRAINT chk_preset_bundles_version
        CHECK (version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_preset_bundles_scope_key_version
    ON preset_bundles (COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid), key, version);

CREATE INDEX IF NOT EXISTS idx_preset_bundles_scope_status
    ON preset_bundles (workspace_id, status, created_at DESC);

-- ----

CREATE TABLE IF NOT EXISTS preset_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bundle_id UUID NOT NULL REFERENCES preset_bundles(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (bundle_id, key)
);

CREATE INDEX IF NOT EXISTS idx_preset_categories_bundle
    ON preset_categories (bundle_id, sort_order, label);

-- ----

CREATE TABLE IF NOT EXISTS preset_subcategories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bundle_id UUID NOT NULL REFERENCES preset_bundles(id) ON DELETE CASCADE,
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
    UNIQUE (bundle_id, key),
    CONSTRAINT chk_preset_subcategories_reply_mode
        CHECK (reply_mode IN ('opening', 'mixed', 'continuation')),
    CONSTRAINT chk_preset_subcategories_greeting_policy
        CHECK (greeting_policy IN ('required', 'optional_short', 'forbidden')),
    CONSTRAINT chk_preset_subcategories_default_count
        CHECK (default_template_count > 0)
);

CREATE INDEX IF NOT EXISTS idx_preset_subcategories_bundle
    ON preset_subcategories (bundle_id, category_key, sort_order, label);

-- ----

CREATE TABLE IF NOT EXISTS preset_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bundle_id UUID NOT NULL REFERENCES preset_bundles(id) ON DELETE CASCADE,
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
    UNIQUE (bundle_id, sub_category, name)
);

CREATE INDEX IF NOT EXISTS idx_preset_items_bundle
    ON preset_items (bundle_id, category, sub_category, sort_order);


-- ============================================
-- PHASE 2: Migrate data from old tables
-- ============================================

-- 2a: Copy taxonomy_presets → preset_bundles (keep same IDs for FK consistency)
INSERT INTO preset_bundles (id, workspace_id, key, name, version, status, description, metadata, created_by, updated_by, created_at, updated_at)
SELECT id, workspace_id, key, name, version, status, description, metadata, created_by, updated_by, created_at, updated_at
FROM taxonomy_presets
ON CONFLICT (id) DO NOTHING;

-- 2b: Copy taxonomy_preset_categories → preset_categories
INSERT INTO preset_categories (id, bundle_id, key, label, description, sort_order, is_active, metadata, created_at, updated_at)
SELECT id, preset_id, key, label, description, sort_order, is_active, metadata, created_at, updated_at
FROM taxonomy_preset_categories
ON CONFLICT (id) DO NOTHING;

-- 2c: Copy taxonomy_preset_subcategories → preset_subcategories
INSERT INTO preset_subcategories (id, bundle_id, category_key, key, label, description, reply_mode, greeting_policy, default_template_count, strategy_pool, sort_order, is_active, metadata, created_at, updated_at)
SELECT id, preset_id, category_key, key, label, description, reply_mode, greeting_policy, default_template_count, strategy_pool, sort_order, is_active, metadata, created_at, updated_at
FROM taxonomy_preset_subcategories
ON CONFLICT (id) DO NOTHING;

-- 2d: Copy template_preset_items → preset_items
-- Link via template_presets.taxonomy_preset_id → bundle_id
INSERT INTO preset_items (id, bundle_id, name, content, category, sub_category, shortcut, is_active, strategy_tag, requires_rag, sort_order, metadata, created_at, updated_at)
SELECT
    tpi.id,
    tp.taxonomy_preset_id,  -- this becomes bundle_id
    tpi.name, tpi.content, tpi.category, tpi.sub_category,
    tpi.shortcut, tpi.is_active, tpi.strategy_tag, tpi.requires_rag,
    tpi.sort_order, tpi.metadata, tpi.created_at, tpi.updated_at
FROM template_preset_items tpi
JOIN template_presets tp ON tp.id = tpi.template_preset_id
WHERE tp.taxonomy_preset_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- 2e: Handle orphan template_presets (no taxonomy_preset_id)
-- Create a bundle for each orphan, then migrate their items
INSERT INTO preset_bundles (id, workspace_id, key, name, version, status, description, metadata, created_by, updated_by, created_at, updated_at)
SELECT id, workspace_id, key, name, version, status, description, metadata, created_by, updated_by, created_at, updated_at
FROM template_presets
WHERE taxonomy_preset_id IS NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO preset_items (id, bundle_id, name, content, category, sub_category, shortcut, is_active, strategy_tag, requires_rag, sort_order, metadata, created_at, updated_at)
SELECT
    tpi.id,
    tp.id,  -- orphan template_preset becomes its own bundle
    tpi.name, tpi.content, tpi.category, tpi.sub_category,
    tpi.shortcut, tpi.is_active, tpi.strategy_tag, tpi.requires_rag,
    tpi.sort_order, tpi.metadata, tpi.created_at, tpi.updated_at
FROM template_preset_items tpi
JOIN template_presets tp ON tp.id = tpi.template_preset_id
WHERE tp.taxonomy_preset_id IS NULL
ON CONFLICT (id) DO NOTHING;


-- ============================================
-- PHASE 3: Add bundle_id to existing tables
-- ============================================

-- 3a: Add bundle_id column to workspace_preset_assignments
ALTER TABLE workspace_preset_assignments
    ADD COLUMN IF NOT EXISTS bundle_id UUID REFERENCES preset_bundles(id) ON DELETE SET NULL;

-- Migrate: use taxonomy_preset_id as bundle_id (since bundle IDs = taxonomy IDs)
UPDATE workspace_preset_assignments
SET bundle_id = taxonomy_preset_id
WHERE bundle_id IS NULL AND taxonomy_preset_id IS NOT NULL;

-- 3b: Add bundle_id column to preset_apply_logs
ALTER TABLE preset_apply_logs
    ADD COLUMN IF NOT EXISTS bundle_id UUID REFERENCES preset_bundles(id) ON DELETE SET NULL;

-- Migrate: use taxonomy_preset_id as bundle_id
UPDATE preset_apply_logs
SET bundle_id = taxonomy_preset_id
WHERE bundle_id IS NULL AND taxonomy_preset_id IS NOT NULL;


-- ============================================
-- PHASE 4: Verification queries (run manually)
-- ============================================
-- SELECT 'preset_bundles' AS tbl, COUNT(*) FROM preset_bundles
-- UNION ALL SELECT 'preset_categories', COUNT(*) FROM preset_categories
-- UNION ALL SELECT 'preset_subcategories', COUNT(*) FROM preset_subcategories
-- UNION ALL SELECT 'preset_items', COUNT(*) FROM preset_items
-- UNION ALL SELECT 'taxonomy_presets (old)', COUNT(*) FROM taxonomy_presets
-- UNION ALL SELECT 'taxonomy_preset_categories (old)', COUNT(*) FROM taxonomy_preset_categories
-- UNION ALL SELECT 'taxonomy_preset_subcategories (old)', COUNT(*) FROM taxonomy_preset_subcategories
-- UNION ALL SELECT 'template_presets (old)', COUNT(*) FROM template_presets
-- UNION ALL SELECT 'template_preset_items (old)', COUNT(*) FROM template_preset_items;

-- Check assignments migrated:
-- SELECT workspace_id, bundle_id, taxonomy_preset_id, template_preset_id
-- FROM workspace_preset_assignments;


-- ============================================
-- NOTE: Old tables are NOT dropped yet.
-- They will be dropped in a separate migration (v7)
-- after the API and frontend have been fully migrated.
-- ============================================
