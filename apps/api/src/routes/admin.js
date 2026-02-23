const express = require('express');
const { query, transaction } = require('../utils/db');
const asyncHandler = require('../middleware/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const { bootstrapBundleFromDefaults } = require('../services/adminPresetService');
const { applyBundleToWorkspace, previewBundleToWorkspace } = require('../services/presetApplyService');

const router = express.Router();

const parseBool = (value, defaultValue = false) => {
    if (value === undefined) return defaultValue;
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return defaultValue;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return defaultValue;
};

const normalizeOptionalText = (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = String(value).trim();
    return trimmed === '' ? null : trimmed;
};

const normalizeKey = (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = String(value).trim().toLowerCase();
    return trimmed === '' ? null : trimmed;
};

const normalizeOptionalJsonArray = (value) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return [];
    if (Array.isArray(value)) return value;
    return undefined;
};

const isValidReplyMode = (value) => ['opening', 'mixed', 'continuation'].includes(value);
const isValidGreetingPolicy = (value) => ['required', 'optional_short', 'forbidden'].includes(value);

const normalizeTemplatePresetItemImport = (raw) => {
    const name = normalizeOptionalText(raw?.name);
    const content = normalizeOptionalText(raw?.content);
    const category = normalizeKey(raw?.category) || 'general';
    const sub_category = raw?.sub_category === undefined ? null : normalizeKey(raw?.sub_category);
    const shortcut = raw?.shortcut === undefined ? undefined : (normalizeOptionalText(raw?.shortcut) || null);
    const strategy_tag = raw?.strategy_tag === undefined ? undefined : (normalizeOptionalText(raw?.strategy_tag) || null);
    const requires_rag = parseBool(raw?.requires_rag, false);
    const is_active = raw?.is_active === undefined ? true : parseBool(raw?.is_active, true);
    const sort_order = Number.isInteger(raw?.sort_order) ? raw.sort_order : (parseInt(raw?.sort_order, 10) || 0);

    return {
        name,
        content,
        category,
        sub_category,
        shortcut,
        strategy_tag,
        requires_rag,
        is_active,
        sort_order,
    };
};

const parseGeneratorImportPayload = (body) => {
    let source = body?.source_json ?? body?.generator_json ?? null;
    if (!source && Array.isArray(body?.templates)) {
        source = body;
    }
    if (typeof source === 'string') {
        try {
            source = JSON.parse(source);
        } catch (error) {
            return { error: `Invalid JSON string: ${error.message}` };
        }
    }
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        return { error: 'source_json (generator JSON object) is required' };
    }
    if (!Array.isArray(source.templates)) {
        return { error: 'source_json.templates must be an array' };
    }
    return { source };
};

const assertWorkspaceExists = async (workspaceId) => {
    const result = await query('SELECT id, name, slug FROM workspaces WHERE id = $1', [workspaceId]);
    return result.rows[0] || null;
};

const assertBundleAccessible = async (bundleId, workspaceId) => {
    if (!bundleId) return null;
    const result = await query(
        `SELECT * FROM preset_bundles
         WHERE id = $1 AND (workspace_id IS NULL OR workspace_id = $2)
         LIMIT 1`,
        [bundleId, workspaceId]
    );
    return result.rows[0] || null;
};

router.use(authenticate);
router.use(requireRole('super_admin'));

// ============================================
// WORKSPACES
// ============================================
router.get('/workspaces', asyncHandler(async (req, res) => {
    const result = await query(
        `
        SELECT
            w.*,
            COALESCE(b.bot_count, 0)::int AS bot_count,
            COALESCE(u.user_count, 0)::int AS user_count
        FROM workspaces w
        LEFT JOIN (
            SELECT workspace_id, COUNT(*) AS bot_count
            FROM bots
            GROUP BY workspace_id
        ) b ON b.workspace_id = w.id
        LEFT JOIN (
            SELECT workspace_id, COUNT(*) AS user_count
            FROM users
            GROUP BY workspace_id
        ) u ON u.workspace_id = w.id
        ORDER BY w.created_at DESC, w.name ASC
        `
    );

    res.json({ workspaces: result.rows });
}));

router.get('/workspaces/:id/bots', asyncHandler(async (req, res) => {
    const workspace = await assertWorkspaceExists(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const result = await query(
        `
        SELECT id, name, created_at, updated_at, llm_provider, llm_model
        FROM bots
        WHERE workspace_id = $1
        ORDER BY created_at DESC
        `,
        [req.params.id]
    );

    res.json({ workspace, bots: result.rows });
}));

router.get('/workspaces/:id/preset-assignment', asyncHandler(async (req, res) => {
    const workspace = await assertWorkspaceExists(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const result = await query(
        `SELECT a.*, pb.key AS bundle_key, pb.name AS bundle_name, pb.version AS bundle_version
         FROM workspace_preset_assignments a
         LEFT JOIN preset_bundles pb ON pb.id = a.bundle_id
         WHERE a.workspace_id = $1`,
        [req.params.id]
    );

    res.json({ workspace, assignment: result.rows[0] || null });
}));

router.put('/workspaces/:id/preset-assignment', asyncHandler(async (req, res) => {
    const workspace = await assertWorkspaceExists(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const bundleId = normalizeOptionalText(req.body.bundle_id) || null;

    if (bundleId) {
        const bundle = await assertBundleAccessible(bundleId, workspace.id);
        if (!bundle) return res.status(404).json({ error: 'bundle_id not found or inaccessible for this workspace' });
    }

    const result = await query(
        `INSERT INTO workspace_preset_assignments (workspace_id, bundle_id, assigned_by, assigned_at, updated_at)
         VALUES ($1,$2,$3,NOW(),NOW())
         ON CONFLICT (workspace_id)
         DO UPDATE SET bundle_id = EXCLUDED.bundle_id, assigned_by = EXCLUDED.assigned_by,
                       assigned_at = NOW(), updated_at = NOW()
         RETURNING *`,
        [workspace.id, bundleId, req.user.id]
    );

    res.json({ workspace, assignment: result.rows[0] });
}));

router.post('/workspaces/:id/apply-bundle', asyncHandler(async (req, res) => {
    const workspace = await assertWorkspaceExists(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const mode = ['skip_existing', 'reactivate_existing'].includes(req.body.mode) ? req.body.mode : 'skip_existing';
    let bundleId = normalizeOptionalText(req.body.bundle_id) || null;

    if (!bundleId) {
        const assignRes = await query('SELECT bundle_id FROM workspace_preset_assignments WHERE workspace_id = $1', [workspace.id]);
        bundleId = assignRes.rows[0]?.bundle_id || null;
    }
    if (!bundleId) return res.status(400).json({ error: 'No preset bundle assigned/provided for this workspace' });

    const bundle = await assertBundleAccessible(bundleId, workspace.id);
    if (!bundle) return res.status(404).json({ error: 'bundle_id not found or inaccessible for this workspace' });

    const summary = await applyBundleToWorkspace(workspace.id, bundleId, { mode, createdBy: req.user.id });

    res.json({ success: true, workspace, summary });
}));

router.post('/workspaces/:id/preview-apply-bundle', asyncHandler(async (req, res) => {
    const workspace = await assertWorkspaceExists(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const mode = ['skip_existing', 'reactivate_existing'].includes(req.body.mode) ? req.body.mode : 'skip_existing';
    let bundleId = normalizeOptionalText(req.body.bundle_id) || null;

    if (!bundleId) {
        const assignRes = await query('SELECT bundle_id FROM workspace_preset_assignments WHERE workspace_id = $1', [workspace.id]);
        bundleId = assignRes.rows[0]?.bundle_id || null;
    }
    if (!bundleId) return res.status(400).json({ error: 'No preset bundle assigned/provided for this workspace' });

    const bundle = await assertBundleAccessible(bundleId, workspace.id);
    if (!bundle) return res.status(404).json({ error: 'bundle_id not found or inaccessible for this workspace' });

    const summary = await previewBundleToWorkspace(workspace.id, bundleId, { mode });

    res.json({ success: true, workspace, summary });
}));


// ============================================
// PRESET BUNDLES (unified)
// ============================================
router.get('/preset-bundles', asyncHandler(async (req, res) => {
    const workspaceId = normalizeOptionalText(req.query.workspace_id);
    const includeGlobal = parseBool(req.query.include_global, true);

    if (workspaceId) {
        const workspace = await assertWorkspaceExists(workspaceId);
        if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    }

    const result = await query(
        `SELECT p.*,
            COALESCE(c.cnt, 0)::int AS categories_count,
            COALESCE(s.cnt, 0)::int AS subcategories_count,
            COALESCE(i.cnt, 0)::int AS items_count
         FROM preset_bundles p
         LEFT JOIN (SELECT bundle_id, COUNT(*) AS cnt FROM preset_categories GROUP BY bundle_id) c ON c.bundle_id = p.id
         LEFT JOIN (SELECT bundle_id, COUNT(*) AS cnt FROM preset_subcategories GROUP BY bundle_id) s ON s.bundle_id = p.id
         LEFT JOIN (SELECT bundle_id, COUNT(*) AS cnt FROM preset_items GROUP BY bundle_id) i ON i.bundle_id = p.id
         WHERE ($1::uuid IS NULL OR p.workspace_id = $1 OR ($2::boolean = true AND p.workspace_id IS NULL))
         ORDER BY p.workspace_id NULLS FIRST, p.key ASC, p.version DESC`,
        [workspaceId, includeGlobal]
    );

    res.json({ bundles: result.rows, filters: { workspace_id: workspaceId, include_global: includeGlobal } });
}));

router.get('/preset-bundles/:id', asyncHandler(async (req, res) => {
    const bundleResult = await query('SELECT * FROM preset_bundles WHERE id = $1', [req.params.id]);
    if (bundleResult.rows.length === 0) return res.status(404).json({ error: 'Preset bundle not found' });

    const [catRes, subRes, itemRes] = await Promise.all([
        query('SELECT * FROM preset_categories WHERE bundle_id = $1 ORDER BY sort_order ASC, label ASC', [req.params.id]),
        query('SELECT * FROM preset_subcategories WHERE bundle_id = $1 ORDER BY category_key ASC, sort_order ASC, label ASC', [req.params.id]),
        query('SELECT * FROM preset_items WHERE bundle_id = $1 ORDER BY category ASC, sub_category ASC NULLS LAST, sort_order ASC, name ASC', [req.params.id]),
    ]);

    res.json({
        bundle: bundleResult.rows[0],
        categories: catRes.rows,
        subcategories: subRes.rows,
        items: itemRes.rows,
    });
}));

router.post('/preset-bundles', asyncHandler(async (req, res) => {
    const workspaceId = normalizeOptionalText(req.body.workspace_id);
    const key = normalizeOptionalText(req.body.key);
    const name = normalizeOptionalText(req.body.name);
    const description = normalizeOptionalText(req.body.description) || null;
    const status = ['draft', 'published', 'archived'].includes(req.body.status) ? req.body.status : 'draft';
    const version = Number.isInteger(req.body.version) ? req.body.version : parseInt(req.body.version || '1', 10);
    const metadata = req.body.metadata && typeof req.body.metadata === 'object' && !Array.isArray(req.body.metadata) ? req.body.metadata : {};

    if (!key || !name) return res.status(400).json({ error: 'key and name are required' });
    if (!Number.isInteger(version) || version <= 0) return res.status(400).json({ error: 'version must be a positive integer' });
    if (workspaceId) {
        const ws = await assertWorkspaceExists(workspaceId);
        if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    }

    const result = await query(
        `INSERT INTO preset_bundles (workspace_id, key, name, version, status, description, metadata, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9) RETURNING *`,
        [workspaceId, key, name, version, status, description, JSON.stringify(metadata), req.user.id, req.user.id]
    );

    res.status(201).json({ bundle: result.rows[0] });
}));

router.patch('/preset-bundles/:id', asyncHandler(async (req, res) => {
    const existing = await query('SELECT * FROM preset_bundles WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Preset bundle not found' });

    const updates = []; const params = []; let idx = 1;

    if (req.body.name !== undefined) {
        const name = normalizeOptionalText(req.body.name);
        if (!name) return res.status(400).json({ error: 'name cannot be empty' });
        updates.push(`name = $${idx++}`); params.push(name);
    }
    if (req.body.description !== undefined) { updates.push(`description = $${idx++}`); params.push(normalizeOptionalText(req.body.description)); }
    if (req.body.status !== undefined) {
        if (!['draft', 'published', 'archived'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
        updates.push(`status = $${idx++}`); params.push(req.body.status);
    }
    if (req.body.metadata !== undefined) {
        if (!req.body.metadata || typeof req.body.metadata !== 'object' || Array.isArray(req.body.metadata))
            return res.status(400).json({ error: 'metadata must be an object' });
        updates.push(`metadata = $${idx++}::jsonb`); params.push(JSON.stringify(req.body.metadata));
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push(`updated_by = $${idx++}`); params.push(req.user.id);
    updates.push('updated_at = NOW()');
    params.push(req.params.id);

    const result = await query(`UPDATE preset_bundles SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    res.json({ bundle: result.rows[0] });
}));

// ============================================
// PRESET CATEGORIES
// ============================================
router.post('/preset-bundles/:id/categories', asyncHandler(async (req, res) => {
    const bundleId = req.params.id;
    const bundleCheck = await query('SELECT id FROM preset_bundles WHERE id = $1', [bundleId]);
    if (bundleCheck.rows.length === 0) return res.status(404).json({ error: 'Preset bundle not found' });

    const key = normalizeKey(req.body.key);
    const label = normalizeOptionalText(req.body.label);
    if (!key || !label) return res.status(400).json({ error: 'key and label are required' });

    const active = parseBool(req.body.is_active, true);
    const sortOrder = Number.isInteger(req.body.sort_order) ? req.body.sort_order : (parseInt(req.body.sort_order, 10) || 0);

    const result = await query(
        `INSERT INTO preset_categories (bundle_id, key, label, description, sort_order, is_active, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING *`,
        [bundleId, key, label, normalizeOptionalText(req.body.description) ?? null, sortOrder, active,
            JSON.stringify(req.body.metadata && typeof req.body.metadata === 'object' && !Array.isArray(req.body.metadata) ? req.body.metadata : {})]
    );
    res.status(201).json({ category: result.rows[0] });
}));

router.patch('/preset-bundles/categories/:id', asyncHandler(async (req, res) => {
    const check = await query('SELECT * FROM preset_categories WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Preset category not found' });

    const updates = []; const params = []; let idx = 1;

    if (req.body.label !== undefined) {
        const label = normalizeOptionalText(req.body.label);
        if (!label) return res.status(400).json({ error: 'label cannot be empty' });
        updates.push(`label = $${idx++}`); params.push(label);
    }
    if (req.body.description !== undefined) { updates.push(`description = $${idx++}`); params.push(normalizeOptionalText(req.body.description)); }
    if (req.body.sort_order !== undefined) { updates.push(`sort_order = $${idx++}`); params.push(parseInt(req.body.sort_order, 10) || 0); }
    if (req.body.is_active !== undefined) {
        const active = parseBool(req.body.is_active, undefined);
        if (active === undefined) return res.status(400).json({ error: 'is_active must be boolean' });
        updates.push(`is_active = $${idx++}`); params.push(active);
    }
    if (req.body.metadata !== undefined) {
        if (!req.body.metadata || typeof req.body.metadata !== 'object' || Array.isArray(req.body.metadata))
            return res.status(400).json({ error: 'metadata must be an object' });
        updates.push(`metadata = $${idx++}::jsonb`); params.push(JSON.stringify(req.body.metadata));
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push('updated_at = NOW()');
    params.push(req.params.id);

    const result = await query(`UPDATE preset_categories SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    res.json({ category: result.rows[0] });
}));

router.delete('/preset-bundles/categories/:id', asyncHandler(async (req, res) => {
    const check = await query('SELECT * FROM preset_categories WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Preset category not found' });
    const category = check.rows[0];

    const subCount = await query(
        'SELECT COUNT(*)::int AS count FROM preset_subcategories WHERE bundle_id = $1 AND category_key = $2',
        [category.bundle_id, category.key]
    );
    if ((subCount.rows[0]?.count || 0) > 0) {
        return res.status(409).json({ error: 'Category still has subcategories. Delete or move subcategories first.', references: { subcategories: subCount.rows[0].count } });
    }

    await query('DELETE FROM preset_categories WHERE id = $1', [req.params.id]);
    res.json({ success: true });
}));

// ============================================
// PRESET SUBCATEGORIES (INTENTS)
// ============================================
router.post('/preset-bundles/:id/subcategories', asyncHandler(async (req, res) => {
    const bundleId = req.params.id;
    const bundleCheck = await query('SELECT id FROM preset_bundles WHERE id = $1', [bundleId]);
    if (bundleCheck.rows.length === 0) return res.status(404).json({ error: 'Preset bundle not found' });

    const categoryKey = normalizeKey(req.body.category_key);
    const key = normalizeKey(req.body.key);
    const label = normalizeOptionalText(req.body.label);
    const replyMode = req.body.reply_mode || 'continuation';
    const greetingPolicy = req.body.greeting_policy || 'forbidden';
    const strategyPool = normalizeOptionalJsonArray(req.body.strategy_pool);

    if (!categoryKey || !key || !label) return res.status(400).json({ error: 'category_key, key, and label are required' });
    if (!isValidReplyMode(replyMode)) return res.status(400).json({ error: 'Invalid reply_mode' });
    if (!isValidGreetingPolicy(greetingPolicy)) return res.status(400).json({ error: 'Invalid greeting_policy' });
    if (req.body.strategy_pool !== undefined && strategyPool === undefined) return res.status(400).json({ error: 'strategy_pool must be an array when provided' });

    const categoryCheck = await query('SELECT id FROM preset_categories WHERE bundle_id = $1 AND key = $2', [bundleId, categoryKey]);
    if (categoryCheck.rows.length === 0) return res.status(400).json({ error: 'category_key not found in this bundle' });

    const active = parseBool(req.body.is_active, true);
    const sortOrder = Number.isInteger(req.body.sort_order) ? req.body.sort_order : (parseInt(req.body.sort_order, 10) || 0);
    const defaultCount = parseInt(req.body.default_template_count, 10);

    const result = await query(
        `INSERT INTO preset_subcategories (
            bundle_id, category_key, key, label, description,
            reply_mode, greeting_policy, default_template_count,
            strategy_pool, sort_order, is_active, metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12::jsonb) RETURNING *`,
        [bundleId, categoryKey, key, label, normalizeOptionalText(req.body.description) ?? null,
            replyMode, greetingPolicy, Number.isFinite(defaultCount) && defaultCount > 0 ? defaultCount : 3,
            JSON.stringify(strategyPool ?? []), sortOrder, active,
            JSON.stringify(req.body.metadata && typeof req.body.metadata === 'object' && !Array.isArray(req.body.metadata) ? req.body.metadata : {})]
    );
    res.status(201).json({ subcategory: result.rows[0] });
}));

router.patch('/preset-bundles/subcategories/:id', asyncHandler(async (req, res) => {
    const check = await query('SELECT * FROM preset_subcategories WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Preset subcategory not found' });
    const existing = check.rows[0];

    const updates = []; const params = []; let idx = 1;

    if (req.body.label !== undefined) {
        const label = normalizeOptionalText(req.body.label);
        if (!label) return res.status(400).json({ error: 'label cannot be empty' });
        updates.push(`label = $${idx++}`); params.push(label);
    }
    if (req.body.description !== undefined) { updates.push(`description = $${idx++}`); params.push(normalizeOptionalText(req.body.description)); }
    if (req.body.sort_order !== undefined) { updates.push(`sort_order = $${idx++}`); params.push(parseInt(req.body.sort_order, 10) || 0); }
    if (req.body.is_active !== undefined) {
        const active = parseBool(req.body.is_active, undefined);
        if (active === undefined) return res.status(400).json({ error: 'is_active must be boolean' });
        updates.push(`is_active = $${idx++}`); params.push(active);
    }
    if (req.body.reply_mode !== undefined) {
        if (!isValidReplyMode(req.body.reply_mode)) return res.status(400).json({ error: 'Invalid reply_mode' });
        updates.push(`reply_mode = $${idx++}`); params.push(req.body.reply_mode);
    }
    if (req.body.greeting_policy !== undefined) {
        if (!isValidGreetingPolicy(req.body.greeting_policy)) return res.status(400).json({ error: 'Invalid greeting_policy' });
        updates.push(`greeting_policy = $${idx++}`); params.push(req.body.greeting_policy);
    }
    if (req.body.default_template_count !== undefined) {
        const count = parseInt(req.body.default_template_count, 10);
        if (!Number.isFinite(count) || count <= 0) return res.status(400).json({ error: 'default_template_count must be a positive integer' });
        updates.push(`default_template_count = $${idx++}`); params.push(count);
    }
    if (req.body.strategy_pool !== undefined) {
        const sp = normalizeOptionalJsonArray(req.body.strategy_pool);
        if (sp === undefined) return res.status(400).json({ error: 'strategy_pool must be an array' });
        updates.push(`strategy_pool = $${idx++}::jsonb`); params.push(JSON.stringify(sp));
    }
    if (req.body.category_key !== undefined) {
        const ck = normalizeKey(req.body.category_key);
        if (!ck) return res.status(400).json({ error: 'category_key cannot be empty' });
        const catCheck = await query('SELECT id FROM preset_categories WHERE bundle_id = $1 AND key = $2', [existing.bundle_id, ck]);
        if (catCheck.rows.length === 0) return res.status(400).json({ error: 'category_key not found in this bundle' });
        updates.push(`category_key = $${idx++}`); params.push(ck);
    }
    if (req.body.metadata !== undefined) {
        if (!req.body.metadata || typeof req.body.metadata !== 'object' || Array.isArray(req.body.metadata))
            return res.status(400).json({ error: 'metadata must be an object' });
        updates.push(`metadata = $${idx++}::jsonb`); params.push(JSON.stringify(req.body.metadata));
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push('updated_at = NOW()');
    params.push(req.params.id);

    const result = await query(`UPDATE preset_subcategories SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    res.json({ subcategory: result.rows[0] });
}));

router.delete('/preset-bundles/subcategories/:id', asyncHandler(async (req, res) => {
    const check = await query('SELECT * FROM preset_subcategories WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Preset subcategory not found' });
    const sub = check.rows[0];

    const refCount = await query('SELECT COUNT(*)::int AS count FROM preset_items WHERE bundle_id = $1 AND sub_category = $2', [sub.bundle_id, sub.key]);
    if ((refCount.rows[0]?.count || 0) > 0) {
        return res.status(409).json({ error: 'Subcategory still has template items. Delete or move items first.', references: { items: refCount.rows[0].count } });
    }

    await query('DELETE FROM preset_subcategories WHERE id = $1', [req.params.id]);
    res.json({ success: true });
}));

// ============================================
// PRESET ITEMS (templates)
// ============================================
router.post('/preset-bundles/:id/items', asyncHandler(async (req, res) => {
    const bundleId = req.params.id;
    const bundleCheck = await query('SELECT * FROM preset_bundles WHERE id = $1', [bundleId]);
    if (bundleCheck.rows.length === 0) return res.status(404).json({ error: 'Preset bundle not found' });

    const name = normalizeOptionalText(req.body.name);
    const content = normalizeOptionalText(req.body.content);
    const category = normalizeKey(req.body.category);
    const subCategory = normalizeKey(req.body.sub_category);
    const shortcut = normalizeOptionalText(req.body.shortcut) || null;
    const strategyTag = normalizeOptionalText(req.body.strategy_tag) || null;
    const requiresRag = parseBool(req.body.requires_rag, false);
    const isActive = parseBool(req.body.is_active, true);
    const sortOrder = Number.isInteger(req.body.sort_order) ? req.body.sort_order : (parseInt(req.body.sort_order, 10) || 0);
    const metadata = req.body.metadata && typeof req.body.metadata === 'object' && !Array.isArray(req.body.metadata) ? req.body.metadata : {};

    if (!name || !content || !category) return res.status(400).json({ error: 'name, content, and category are required' });

    if (subCategory) {
        const subCheck = await query('SELECT key, category_key FROM preset_subcategories WHERE bundle_id = $1 AND key = $2', [bundleId, subCategory]);
        if (subCheck.rows.length === 0) return res.status(400).json({ error: 'sub_category not found in this bundle' });
        if (subCheck.rows[0].category_key !== category) return res.status(400).json({ error: 'category does not match subcategory category_key' });
    }

    const result = await query(
        `INSERT INTO preset_items (bundle_id, name, content, category, sub_category, shortcut, is_active, strategy_tag, requires_rag, sort_order, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) RETURNING *`,
        [bundleId, name, content, category, subCategory, shortcut, isActive, strategyTag, requiresRag, sortOrder, JSON.stringify(metadata)]
    );
    res.status(201).json({ item: result.rows[0] });
}));

router.patch('/preset-bundles/items/:id', asyncHandler(async (req, res) => {
    const check = await query('SELECT * FROM preset_items WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Preset item not found' });
    const existing = check.rows[0];

    const updates = []; const params = []; let idx = 1;
    let nextCategory = existing.category;
    let nextSubCategory = existing.sub_category;

    if (req.body.name !== undefined) {
        const name = normalizeOptionalText(req.body.name);
        if (!name) return res.status(400).json({ error: 'name cannot be empty' });
        updates.push(`name = $${idx++}`); params.push(name);
    }
    if (req.body.content !== undefined) {
        const content = normalizeOptionalText(req.body.content);
        if (!content) return res.status(400).json({ error: 'content cannot be empty' });
        updates.push(`content = $${idx++}`); params.push(content);
    }
    if (req.body.category !== undefined) {
        const cat = normalizeKey(req.body.category);
        if (!cat) return res.status(400).json({ error: 'category cannot be empty' });
        nextCategory = cat; updates.push(`category = $${idx++}`); params.push(cat);
    }
    if (req.body.sub_category !== undefined) {
        nextSubCategory = normalizeKey(req.body.sub_category);
        updates.push(`sub_category = $${idx++}`); params.push(nextSubCategory);
    }
    if (req.body.shortcut !== undefined) { updates.push(`shortcut = $${idx++}`); params.push(normalizeOptionalText(req.body.shortcut)); }
    if (req.body.is_active !== undefined) {
        const active = parseBool(req.body.is_active, undefined);
        if (active === undefined) return res.status(400).json({ error: 'is_active must be boolean' });
        updates.push(`is_active = $${idx++}`); params.push(active);
    }
    if (req.body.strategy_tag !== undefined) { updates.push(`strategy_tag = $${idx++}`); params.push(normalizeOptionalText(req.body.strategy_tag)); }
    if (req.body.requires_rag !== undefined) {
        const rr = parseBool(req.body.requires_rag, undefined);
        if (rr === undefined) return res.status(400).json({ error: 'requires_rag must be boolean' });
        updates.push(`requires_rag = $${idx++}`); params.push(rr);
    }
    if (req.body.sort_order !== undefined) { updates.push(`sort_order = $${idx++}`); params.push(parseInt(req.body.sort_order, 10) || 0); }
    if (req.body.metadata !== undefined) {
        if (!req.body.metadata || typeof req.body.metadata !== 'object' || Array.isArray(req.body.metadata))
            return res.status(400).json({ error: 'metadata must be an object' });
        updates.push(`metadata = $${idx++}::jsonb`); params.push(JSON.stringify(req.body.metadata));
    }

    if (nextSubCategory) {
        const subCheck = await query('SELECT key, category_key FROM preset_subcategories WHERE bundle_id = $1 AND key = $2', [existing.bundle_id, nextSubCategory]);
        if (subCheck.rows.length === 0) return res.status(400).json({ error: 'sub_category not found in this bundle' });
        if (subCheck.rows[0].category_key !== nextCategory) return res.status(400).json({ error: 'category does not match subcategory category_key' });
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push('updated_at = NOW()'); params.push(req.params.id);

    const result = await query(`UPDATE preset_items SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    res.json({ item: result.rows[0] });
}));

router.delete('/preset-bundles/items/:id', asyncHandler(async (req, res) => {
    const check = await query('SELECT id FROM preset_items WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Preset item not found' });
    await query('DELETE FROM preset_items WHERE id = $1', [req.params.id]);
    res.json({ success: true });
}));

// ============================================
// IMPORT GENERATOR JSON INTO BUNDLE
// ============================================
router.post('/preset-bundles/:id/import-items', asyncHandler(async (req, res) => {
    const bundleResult = await query('SELECT * FROM preset_bundles WHERE id = $1', [req.params.id]);
    if (bundleResult.rows.length === 0) return res.status(404).json({ error: 'Preset bundle not found' });
    const bundle = bundleResult.rows[0];

    const mode = ['replace_all', 'append_skip_existing'].includes(req.body.mode) ? req.body.mode : 'replace_all';
    const parsed = parseGeneratorImportPayload(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const source = parsed.source;
    const templatesInput = source.templates;

    const summary = {
        bundle_id: bundle.id, mode,
        total_input_templates: templatesInput.length,
        quality_report_entries: Array.isArray(source.quality_report) ? source.quality_report.length : 0,
        created: 0, replaced_deleted: 0, skipped_invalid: 0,
        skipped_duplicate_input: 0, skipped_existing: 0,
        skipped_missing_taxonomy: 0, skipped_taxonomy_mismatch: 0,
        by_intent: {},
    };

    const incIntent = (intent, key) => {
        const k = intent || '__no_intent__';
        if (!summary.by_intent[k]) {
            summary.by_intent[k] = { created: 0, skipped_invalid: 0, skipped_duplicate_input: 0, skipped_existing: 0, skipped_missing_taxonomy: 0, skipped_taxonomy_mismatch: 0 };
        }
        summary.by_intent[k][key] += 1;
    };

    await transaction(async (client) => {
        const taxRows = await client.query('SELECT key, category_key FROM preset_subcategories WHERE bundle_id = $1', [bundle.id]);
        const taxonomySubMap = taxRows.rows.length > 0 ? new Map(taxRows.rows.map(r => [r.key, r.category_key])) : null;

        let existingKeys = new Set();
        if (mode === 'append_skip_existing') {
            const existing = await client.query('SELECT id, sub_category, name FROM preset_items WHERE bundle_id = $1', [bundle.id]);
            existingKeys = new Set(existing.rows.map(r => `${String(r.sub_category || '').toLowerCase()}::${String(r.name || '').toLowerCase()}`));
        } else {
            const count = await client.query('SELECT COUNT(*)::int AS count FROM preset_items WHERE bundle_id = $1', [bundle.id]);
            summary.replaced_deleted = count.rows[0]?.count || 0;
            await client.query('DELETE FROM preset_items WHERE bundle_id = $1', [bundle.id]);
        }

        const seenInput = new Set();
        for (let i = 0; i < templatesInput.length; i += 1) {
            const t = normalizeTemplatePresetItemImport(templatesInput[i] || {});
            const intentKey = t.sub_category;

            if (!t.name || !t.content) { summary.skipped_invalid += 1; incIntent(intentKey, 'skipped_invalid'); continue; }

            const dedupeKey = `${String(t.sub_category || '').toLowerCase()}::${String(t.name || '').toLowerCase()}`;
            if (seenInput.has(dedupeKey)) { summary.skipped_duplicate_input += 1; incIntent(intentKey, 'skipped_duplicate_input'); continue; }
            seenInput.add(dedupeKey);

            if (taxonomySubMap && t.sub_category) {
                if (!taxonomySubMap.has(t.sub_category)) { summary.skipped_missing_taxonomy += 1; incIntent(intentKey, 'skipped_missing_taxonomy'); continue; }
                const expectedCat = taxonomySubMap.get(t.sub_category);
                if (expectedCat && expectedCat !== t.category) { summary.skipped_taxonomy_mismatch += 1; incIntent(intentKey, 'skipped_taxonomy_mismatch'); continue; }
            }

            if (mode === 'append_skip_existing' && existingKeys.has(dedupeKey)) { summary.skipped_existing += 1; incIntent(intentKey, 'skipped_existing'); continue; }

            await client.query(
                `INSERT INTO preset_items (bundle_id, name, content, category, sub_category, shortcut, is_active, strategy_tag, requires_rag, sort_order, metadata)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
                [bundle.id, t.name, t.content, t.category, t.sub_category, t.shortcut === undefined ? null : t.shortcut,
                t.is_active !== false, t.strategy_tag === undefined ? null : t.strategy_tag, t.requires_rag === true, t.sort_order || 0,
                JSON.stringify({ source: 'generator-json-import' })]
            );

            if (mode === 'append_skip_existing') existingKeys.add(dedupeKey);
            summary.created += 1; incIntent(intentKey, 'created');
        }

        const mergedMeta = {
            ...(bundle.metadata || {}),
            last_generator_import: {
                imported_at: new Date().toISOString(), imported_by: req.user.id, mode,
                total_input_templates: summary.total_input_templates, created: summary.created,
                replaced_deleted: summary.replaced_deleted, quality_report_entries: summary.quality_report_entries,
                source_meta: source.meta && typeof source.meta === 'object' ? source.meta : {},
            },
            generator_quality_report: Array.isArray(source.quality_report) ? source.quality_report : [],
        };

        await client.query('UPDATE preset_bundles SET metadata = $1::jsonb, updated_by = $2, updated_at = NOW() WHERE id = $3',
            [JSON.stringify(mergedMeta), req.user.id, bundle.id]);
    });

    const updatedBundle = await query('SELECT * FROM preset_bundles WHERE id = $1', [bundle.id]);
    res.json({ success: true, bundle: updatedBundle.rows[0], summary });
}));

// ============================================
// EXPORT BUNDLE (full JSON download)
// ============================================
router.get('/preset-bundles/:id/export', asyncHandler(async (req, res) => {
    const bundleResult = await query('SELECT * FROM preset_bundles WHERE id = $1', [req.params.id]);
    if (bundleResult.rows.length === 0) return res.status(404).json({ error: 'Preset bundle not found' });
    const bundle = bundleResult.rows[0];

    const [catRes, subRes, itemRes] = await Promise.all([
        query('SELECT key, label, description, sort_order, is_active FROM preset_categories WHERE bundle_id = $1 ORDER BY sort_order, key', [bundle.id]),
        query('SELECT key, label, category_key, description, reply_mode, greeting_policy, default_template_count, strategy_pool, sort_order, is_active FROM preset_subcategories WHERE bundle_id = $1 ORDER BY sort_order, key', [bundle.id]),
        query('SELECT name, content, category, sub_category, shortcut, strategy_tag, requires_rag, sort_order, is_active FROM preset_items WHERE bundle_id = $1 ORDER BY sort_order, name', [bundle.id]),
    ]);

    const output = {
        bundle: {
            name: bundle.name,
            key: bundle.key,
            version: bundle.version,
            description: bundle.description || null,
        },
        categories: catRes.rows,
        subcategories: subRes.rows.map(s => ({
            ...s,
            strategy_pool: Array.isArray(s.strategy_pool) ? s.strategy_pool : [],
        })),
        items: itemRes.rows,
        meta: {
            exported_at: new Date().toISOString(),
            source_bundle_id: bundle.id,
            exported_by: req.user.id,
        },
    };

    res.json(output);
}));

// ============================================
// IMPORT FULL BUNDLE (from JSON)
// ============================================
router.post('/preset-bundles/import', asyncHandler(async (req, res) => {
    const payload = req.body;

    // Validate structure
    if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'Request body must be a JSON object' });
    if (!payload.bundle || typeof payload.bundle !== 'object') return res.status(400).json({ error: 'Missing or invalid "bundle" object' });
    if (!payload.bundle.name || !payload.bundle.key) return res.status(400).json({ error: '"bundle.name" and "bundle.key" are required' });
    if (!Array.isArray(payload.categories)) return res.status(400).json({ error: '"categories" must be an array' });
    if (!Array.isArray(payload.subcategories)) return res.status(400).json({ error: '"subcategories" must be an array' });
    if (!Array.isArray(payload.items)) return res.status(400).json({ error: '"items" must be an array' });

    const bundleKey = normalizeKey(payload.bundle.key);
    const bundleName = normalizeOptionalText(payload.bundle.name);
    const bundleVersion = Number.isInteger(payload.bundle.version) && payload.bundle.version > 0 ? payload.bundle.version : 1;
    const bundleDescription = normalizeOptionalText(payload.bundle.description) || null;

    if (!bundleKey || !bundleName) return res.status(400).json({ error: 'bundle key and name are required' });

    const summary = { categories_created: 0, subcategories_created: 0, items_created: 0, items_skipped: 0 };

    const result = await transaction(async (client) => {
        // Check for key collision — if exists, make key unique
        let finalKey = bundleKey;
        const existing = await client.query(
            'SELECT id FROM preset_bundles WHERE key = $1 AND version = $2 AND workspace_id IS NULL LIMIT 1',
            [bundleKey, bundleVersion]
        );
        if (existing.rows.length > 0) {
            finalKey = `${bundleKey}-import-${Date.now()}`;
        }

        // 1. Create bundle
        const bundleRow = await client.query(
            `INSERT INTO preset_bundles (workspace_id, key, name, version, status, description, metadata, created_by, updated_by)
             VALUES (NULL, $1, $2, $3, 'draft', $4, $5::jsonb, $6, $7) RETURNING *`,
            [finalKey, bundleName, bundleVersion, bundleDescription,
                JSON.stringify({ source: 'json-import', imported_at: new Date().toISOString(), original_key: bundleKey }),
                req.user.id, req.user.id]
        );
        const bundleId = bundleRow.rows[0].id;

        // 2. Insert categories
        const categoryKeys = new Set();
        for (let i = 0; i < payload.categories.length; i++) {
            const cat = payload.categories[i];
            const key = normalizeKey(cat.key);
            const label = normalizeOptionalText(cat.label);
            if (!key || !label) continue;
            categoryKeys.add(key);

            await client.query(
                `INSERT INTO preset_categories (bundle_id, key, label, description, sort_order, is_active, metadata)
                 VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
                [bundleId, key, label, normalizeOptionalText(cat.description) || null,
                    parseInt(cat.sort_order, 10) || i, cat.is_active !== false,
                    JSON.stringify({ source: 'json-import' })]
            );
            summary.categories_created++;
        }

        // 3. Insert subcategories
        const subcategoryKeys = new Set();
        for (let i = 0; i < payload.subcategories.length; i++) {
            const sub = payload.subcategories[i];
            const key = normalizeKey(sub.key);
            const label = normalizeOptionalText(sub.label);
            const categoryKey = normalizeKey(sub.category_key);
            if (!key || !label || !categoryKey) continue;

            // Auto-create missing category if not already present
            if (!categoryKeys.has(categoryKey)) {
                await client.query(
                    `INSERT INTO preset_categories (bundle_id, key, label, description, sort_order, is_active, metadata)
                     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
                    [bundleId, categoryKey, categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1),
                        null, categoryKeys.size, true, JSON.stringify({ source: 'json-import-auto' })]
                );
                categoryKeys.add(categoryKey);
                summary.categories_created++;
            }

            subcategoryKeys.add(key);
            const replyMode = isValidReplyMode(sub.reply_mode) ? sub.reply_mode : 'continuation';
            const greetingPolicy = isValidGreetingPolicy(sub.greeting_policy) ? sub.greeting_policy : 'forbidden';
            const defaultCount = parseInt(sub.default_template_count, 10);
            const strategyPool = Array.isArray(sub.strategy_pool) ? sub.strategy_pool : [];

            await client.query(
                `INSERT INTO preset_subcategories (bundle_id, category_key, key, label, description,
                    reply_mode, greeting_policy, default_template_count, strategy_pool, sort_order, is_active, metadata)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12::jsonb)`,
                [bundleId, categoryKey, key, label, normalizeOptionalText(sub.description) || null,
                    replyMode, greetingPolicy, Number.isFinite(defaultCount) && defaultCount > 0 ? defaultCount : 3,
                    JSON.stringify(strategyPool), parseInt(sub.sort_order, 10) || i,
                    sub.is_active !== false, JSON.stringify({ source: 'json-import' })]
            );
            summary.subcategories_created++;
        }

        // 4. Insert items
        for (let i = 0; i < payload.items.length; i++) {
            const item = payload.items[i];
            const name = normalizeOptionalText(item.name);
            const content = normalizeOptionalText(item.content);
            const category = normalizeKey(item.category);
            const subCategory = normalizeKey(item.sub_category);
            if (!name || !content || !category) { summary.items_skipped++; continue; }

            await client.query(
                `INSERT INTO preset_items (bundle_id, name, content, category, sub_category, shortcut,
                    is_active, strategy_tag, requires_rag, sort_order, metadata)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
                [bundleId, name, content, category, subCategory || null,
                    item.shortcut ? String(item.shortcut).trim() : null,
                    item.is_active !== false,
                    item.strategy_tag ? String(item.strategy_tag).trim() : null,
                    item.requires_rag === true, parseInt(item.sort_order, 10) || i,
                    JSON.stringify({ source: 'json-import' })]
            );
            summary.items_created++;
        }

        return { bundle: bundleRow.rows[0], finalKey };
    });

    res.status(201).json({ success: true, bundle: result.bundle, summary });
}));

// ============================================
// BOOTSTRAP DEFAULTS FROM LOCAL SOURCES
// ============================================
router.post('/presets/bootstrap-defaults', asyncHandler(async (req, res) => {
    const workspaceId = normalizeOptionalText(req.body.workspace_id) || null;
    if (workspaceId) {
        const workspace = await assertWorkspaceExists(workspaceId);
        if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    }

    try {
        const summary = await bootstrapBundleFromDefaults({ workspaceId, actorUserId: req.user.id });
        return res.json({ success: true, summary });
    } catch (error) {
        if (['PRESET_EMPTY', 'PRESET_NOT_FOUND', 'PRESET_READ_FAILED', 'PRESET_INVALID_JSON'].includes(error.code)) {
            return res.status(400).json({ error: error.message, code: error.code });
        }
        throw error;
    }
}));

// ============================================
// APPLY LOGS (read-only)
// ============================================
router.get('/preset-apply-logs', asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10) || 50, 1), 200);
    const result = await query('SELECT * FROM preset_apply_logs ORDER BY created_at DESC LIMIT $1', [limit]);
    res.json({ logs: result.rows, limit });
}));

// ============================================
// DASHBOARD STATS
// ============================================
router.get('/dashboard/stats', asyncHandler(async (req, res) => {
    const [
        wsRes, usersRes, botsRes, convRes, msgRes, kbRes, bundlesRes, handoffRes
    ] = await Promise.all([
        query('SELECT COUNT(*)::int AS total FROM workspaces'),
        query(`
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE is_active = true)::int AS active,
                COUNT(*) FILTER (WHERE is_active = false)::int AS inactive
            FROM users
        `),
        query(`
            SELECT
                COUNT(*)::int AS total,
                jsonb_object_agg(COALESCE(llm_provider, 'unknown'), cnt) AS by_provider
            FROM (
                SELECT llm_provider, COUNT(*)::int AS cnt FROM bots GROUP BY llm_provider
            ) sub
        `),
        query(`
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE last_message_at > NOW() - INTERVAL '24 hours')::int AS active
            FROM conversations
        `),
        query(`
            SELECT
                COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int AS today,
                COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS week
            FROM messages
        `),
        query(`
            SELECT
                COUNT(*)::int AS sources,
                COALESCE(SUM(chunk_count), 0)::int AS chunks,
                COUNT(*) FILTER (WHERE status = 'error')::int AS errors
            FROM kb_sources
        `),
        query(`
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'published')::int AS published
            FROM preset_bundles
        `),
        query(`
            SELECT COUNT(*)::int AS pending
            FROM handoff_queue
            WHERE status IN ('waiting', 'assigned')
        `),
    ]);

    res.json({
        workspaces: wsRes.rows[0],
        users: usersRes.rows[0],
        bots: {
            total: botsRes.rows[0]?.total || 0,
            by_provider: botsRes.rows[0]?.by_provider || {}
        },
        conversations: {
            ...convRes.rows[0],
            handoff_pending: handoffRes.rows[0]?.pending || 0
        },
        messages: msgRes.rows[0],
        kb: kbRes.rows[0],
        presets: bundlesRes.rows[0]
    });
}));

// ============================================
// USER MANAGEMENT
// ============================================
router.get('/users', asyncHandler(async (req, res) => {
    const workspaceId = normalizeOptionalText(req.query.workspace_id);
    const role = normalizeOptionalText(req.query.role);
    const isActive = req.query.is_active !== undefined ? parseBool(req.query.is_active, true) : null;
    const search = normalizeOptionalText(req.query.search);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);

    const conditions = [];
    const params = [];
    let idx = 1;

    if (workspaceId) {
        conditions.push(`u.workspace_id = $${idx++}`);
        params.push(workspaceId);
    }
    if (role) {
        conditions.push(`u.role = $${idx++}`);
        params.push(role);
    }
    if (isActive !== null) {
        conditions.push(`u.is_active = $${idx++}`);
        params.push(isActive);
    }
    if (search) {
        conditions.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx})`);
        params.push(`%${search}%`);
        idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataRes, countRes] = await Promise.all([
        query(
            `
            SELECT u.id, u.email, u.name, u.role, u.is_active, u.workspace_id,
                   u.created_at, u.updated_at,
                   w.name AS workspace_name
            FROM users u
            LEFT JOIN workspaces w ON w.id = u.workspace_id
            ${where}
            ORDER BY u.created_at DESC
            LIMIT $${idx++} OFFSET $${idx++}
            `,
            [...params, limit, offset]
        ),
        query(`SELECT COUNT(*)::int AS total FROM users u ${where}`, params)
    ]);

    res.json({ users: dataRes.rows, total: countRes.rows[0]?.total || 0 });
}));

router.post('/users', asyncHandler(async (req, res) => {
    const bcrypt = require('bcryptjs');
    const email = normalizeOptionalText(req.body.email)?.toLowerCase();
    const name = normalizeOptionalText(req.body.name);
    const password = req.body.password;
    const role = ['admin', 'super_admin', 'agent'].includes(req.body.role) ? req.body.role : 'admin';
    const workspaceId = normalizeOptionalText(req.body.workspace_id);

    if (!email || !name || !password) {
        return res.status(400).json({ error: 'email, name, and password are required' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check duplicate email
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
    }

    // Validate workspace exists
    if (workspaceId) {
        const ws = await assertWorkspaceExists(workspaceId);
        if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    }

    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await query(
        `
        INSERT INTO users (email, password_hash, name, role, workspace_id, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id, email, name, role, workspace_id, is_active, created_at, updated_at
        `,
        [email, password_hash, name, role, workspaceId || '00000000-0000-0000-0000-000000000001']
    );

    res.status(201).json({ user: result.rows[0] });
}));

router.patch('/users/:id', asyncHandler(async (req, res) => {
    const check = await query('SELECT id FROM users WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (req.body.name !== undefined) {
        const name = normalizeOptionalText(req.body.name);
        if (!name) return res.status(400).json({ error: 'name cannot be empty' });
        updates.push(`name = $${idx++}`);
        params.push(name);
    }
    if (req.body.role !== undefined) {
        if (!['admin', 'super_admin', 'agent'].includes(req.body.role)) {
            return res.status(400).json({ error: 'Invalid role. Must be admin, super_admin, or agent' });
        }
        updates.push(`role = $${idx++}`);
        params.push(req.body.role);
    }
    if (req.body.is_active !== undefined) {
        const active = parseBool(req.body.is_active, undefined);
        if (active === undefined) return res.status(400).json({ error: 'is_active must be boolean' });
        updates.push(`is_active = $${idx++}`);
        params.push(active);
    }
    if (req.body.workspace_id !== undefined) {
        const wsId = normalizeOptionalText(req.body.workspace_id);
        if (wsId) {
            const ws = await assertWorkspaceExists(wsId);
            if (!ws) return res.status(404).json({ error: 'Workspace not found' });
        }
        updates.push(`workspace_id = $${idx++}`);
        params.push(wsId || '00000000-0000-0000-0000-000000000001');
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(req.params.id);

    const result = await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, email, name, role, workspace_id, is_active, created_at, updated_at`,
        params
    );

    res.json({ user: result.rows[0] });
}));

router.post('/users/:id/reset-password', asyncHandler(async (req, res) => {
    const bcrypt = require('bcryptjs');
    const check = await query('SELECT id, email FROM users WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }

    const newPassword = req.body.new_password;
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'new_password must be at least 6 characters' });
    }

    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(newPassword, salt);

    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [password_hash, req.params.id]);

    res.json({ success: true, message: `Password reset for ${check.rows[0].email}` });
}));

// ============================================
// WORKSPACE CREATE / UPDATE / DETAIL
// ============================================
router.post('/workspaces', asyncHandler(async (req, res) => {
    const name = normalizeOptionalText(req.body.name);
    const slug = normalizeKey(req.body.slug);

    if (!name) {
        return res.status(400).json({ error: 'name is required' });
    }

    if (slug) {
        const existing = await query('SELECT id FROM workspaces WHERE slug = $1', [slug]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Slug already exists' });
        }
    }

    const result = await query(
        `INSERT INTO workspaces (name, slug) VALUES ($1, $2) RETURNING *`,
        [name, slug || null]
    );

    res.status(201).json({ workspace: result.rows[0] });
}));

router.patch('/workspaces/:id', asyncHandler(async (req, res) => {
    const workspace = await assertWorkspaceExists(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const updates = [];
    const params = [];
    let idx = 1;

    if (req.body.name !== undefined) {
        const name = normalizeOptionalText(req.body.name);
        if (!name) return res.status(400).json({ error: 'name cannot be empty' });
        updates.push(`name = $${idx++}`);
        params.push(name);
    }
    if (req.body.slug !== undefined) {
        const slug = normalizeKey(req.body.slug);
        if (slug) {
            const existing = await query('SELECT id FROM workspaces WHERE slug = $1 AND id != $2', [slug, req.params.id]);
            if (existing.rows.length > 0) {
                return res.status(409).json({ error: 'Slug already exists' });
            }
        }
        updates.push(`slug = $${idx++}`);
        params.push(slug || null);
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(req.params.id);

    const result = await query(
        `UPDATE workspaces SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
    );

    res.json({ workspace: result.rows[0] });
}));

router.get('/workspaces/:id/detail', asyncHandler(async (req, res) => {
    const workspace = await assertWorkspaceExists(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const [usersRes, botsRes, assignRes] = await Promise.all([
        query(
            `SELECT id, email, name, role, is_active, created_at FROM users WHERE workspace_id = $1 ORDER BY created_at DESC`,
            [req.params.id]
        ),
        query(
            `SELECT id, name, llm_provider, llm_model, handoff_enabled, created_at FROM bots WHERE workspace_id = $1 ORDER BY created_at DESC`,
            [req.params.id]
        ),
        query(
            `SELECT a.*, pb.name AS bundle_name
             FROM workspace_preset_assignments a
             LEFT JOIN preset_bundles pb ON pb.id = a.bundle_id
             WHERE a.workspace_id = $1`,
            [req.params.id]
        )
    ]);

    res.json({
        workspace,
        users: usersRes.rows,
        bots: botsRes.rows,
        assignment: assignRes.rows[0] || null
    });
}));

// ============================================
// BOT OVERVIEW (cross-workspace)
// ============================================
router.get('/bots', asyncHandler(async (req, res) => {
    const workspaceId = normalizeOptionalText(req.query.workspace_id);
    const search = normalizeOptionalText(req.query.search);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);

    const conditions = [];
    const params = [];
    let idx = 1;

    if (workspaceId) {
        conditions.push(`b.workspace_id = $${idx++}`);
        params.push(workspaceId);
    }
    if (search) {
        conditions.push(`b.name ILIKE $${idx++}`);
        params.push(`%${search}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataRes, countRes] = await Promise.all([
        query(
            `
            SELECT
                b.id, b.name, b.workspace_id, b.llm_provider, b.llm_model,
                b.handoff_enabled, b.created_at, b.updated_at,
                w.name AS workspace_name,
                COALESCE(ch.channel_count, 0)::int AS channel_count,
                COALESCE(cv.conversation_count, 0)::int AS conversation_count,
                COALESCE(t.template_count, 0)::int AS template_count,
                COALESCE(kb.kb_source_count, 0)::int AS kb_source_count
            FROM bots b
            LEFT JOIN workspaces w ON w.id = b.workspace_id
            LEFT JOIN (
                SELECT bot_id, COUNT(*)::int AS channel_count FROM bot_channels GROUP BY bot_id
            ) ch ON ch.bot_id = b.id
            LEFT JOIN (
                SELECT bot_id, COUNT(*)::int AS conversation_count FROM conversations GROUP BY bot_id
            ) cv ON cv.bot_id = b.id
            LEFT JOIN (
                SELECT bot_id, COUNT(*)::int AS template_count FROM templates GROUP BY bot_id
            ) t ON t.bot_id = b.id
            LEFT JOIN (
                SELECT bot_id, COUNT(*)::int AS kb_source_count FROM kb_sources GROUP BY bot_id
            ) kb ON kb.bot_id = b.id
            ${where}
            ORDER BY b.created_at DESC
            LIMIT $${idx++} OFFSET $${idx++}
            `,
            [...params, limit, offset]
        ),
        query(`SELECT COUNT(*)::int AS total FROM bots b ${where}`, params)
    ]);

    res.json({ bots: dataRes.rows, total: countRes.rows[0]?.total || 0 });
}));

// ============================================
// AUDIT LOGS
// ============================================
router.get('/audit-logs', asyncHandler(async (req, res) => {
    const workspaceId = normalizeOptionalText(req.query.workspace_id);
    const actor = normalizeOptionalText(req.query.actor);
    const action = normalizeOptionalText(req.query.action);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);

    const conditions = [];
    const params = [];
    let idx = 1;

    if (workspaceId) {
        conditions.push(`a.workspace_id = $${idx++}`);
        params.push(workspaceId);
    }
    if (actor) {
        conditions.push(`a.actor ILIKE $${idx++}`);
        params.push(`%${actor}%`);
    }
    if (action) {
        conditions.push(`a.action = $${idx++}`);
        params.push(action);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataRes, countRes] = await Promise.all([
        query(
            `
            SELECT a.*, w.name AS workspace_name
            FROM audit_log a
            LEFT JOIN workspaces w ON w.id = a.workspace_id
            ${where}
            ORDER BY a.created_at DESC
            LIMIT $${idx++} OFFSET $${idx++}
            `,
            [...params, limit, offset]
        ),
        query(`SELECT COUNT(*)::int AS total FROM audit_log a ${where}`, params)
    ]);

    res.json({ logs: dataRes.rows, total: countRes.rows[0]?.total || 0 });
}));

module.exports = router;
