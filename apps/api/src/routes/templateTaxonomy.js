const express = require('express');
const router = express.Router();
const { query } = require('../utils/db');
const { delByPattern } = require('../utils/cache');
const asyncHandler = require('../middleware/asyncHandler');
const { requireRole } = require('../middleware/auth');

const parseBool = (value) => {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return undefined;
};

const normalizeOptionalText = (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
};

const normalizeKey = (value) => {
    if (value === undefined) return undefined;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim().toLowerCase();
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

const assertBotInWorkspace = async (botId, workspaceId) => {
    const result = await query(
        'SELECT id FROM bots WHERE id = $1 AND workspace_id = $2',
        [botId, workspaceId]
    );
    return result.rows[0] || null;
};

const invalidateTaxonomyCaches = async (botId) => {
    if (!botId) return;
    await delByPattern(`internal:template-taxonomy:${botId}:*`);
    await delByPattern(`internal:bot-templates:${botId}:*`);
};

// ============================================
// GET /v1/template-taxonomy?bot_id=...
// ============================================
router.get('/', asyncHandler(async (req, res) => {
    const { bot_id } = req.query;
    const includeInactive = parseBool(req.query.include_inactive) === true;

    if (!bot_id) {
        return res.status(400).json({ error: 'bot_id is required' });
    }

    const bot = await assertBotInWorkspace(bot_id, req.user.workspace_id);
    if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    const categoriesResult = await query(
        `
        SELECT
            c.*,
            COALESCE(tc.template_count, 0)::int AS template_count,
            COALESCE(sc.subcategory_count, 0)::int AS subcategory_count
        FROM template_categories c
        LEFT JOIN (
            SELECT bot_id, category AS category_key, COUNT(*) AS template_count
            FROM templates
            GROUP BY bot_id, category
        ) tc ON tc.bot_id = c.bot_id AND tc.category_key = c.key
        LEFT JOIN (
            SELECT bot_id, category_key, COUNT(*) AS subcategory_count
            FROM template_subcategories
            GROUP BY bot_id, category_key
        ) sc ON sc.bot_id = c.bot_id AND sc.category_key = c.key
        WHERE c.bot_id = $1
          AND ($2::boolean = true OR c.is_active = true)
        ORDER BY c.sort_order ASC, c.label ASC, c.key ASC
        `,
        [bot_id, includeInactive]
    );

    const subcategoriesResult = await query(
        `
        SELECT
            s.*,
            COALESCE(tc.template_count, 0)::int AS template_count,
            COALESCE(c.is_active, true) AS parent_category_is_active
        FROM template_subcategories s
        LEFT JOIN template_categories c
          ON c.bot_id = s.bot_id AND c.key = s.category_key
        LEFT JOIN (
            SELECT bot_id, sub_category AS subcategory_key, COUNT(*) AS template_count
            FROM templates
            WHERE sub_category IS NOT NULL
            GROUP BY bot_id, sub_category
        ) tc ON tc.bot_id = s.bot_id AND tc.subcategory_key = s.key
        WHERE s.bot_id = $1
          AND ($2::boolean = true OR (s.is_active = true AND COALESCE(c.is_active, true) = true))
        ORDER BY s.category_key ASC, s.sort_order ASC, s.label ASC, s.key ASC
        `,
        [bot_id, includeInactive]
    );

    const categories = categoriesResult.rows;
    const subcategories = subcategoriesResult.rows.map((row) => ({
        ...row,
        effective_is_active: !!(row.is_active && row.parent_category_is_active)
    }));
    const groupedMap = new Map(categories.map((c) => [c.key, { ...c, subcategories: [] }]));
    const uncategorized = [];

    for (const sub of subcategories) {
        const bucket = groupedMap.get(sub.category_key);
        if (bucket) bucket.subcategories.push(sub);
        else uncategorized.push(sub);
    }

    res.json({
        bot_id,
        include_inactive: includeInactive,
        categories,
        subcategories,
        grouped: Array.from(groupedMap.values()),
        uncategorized_subcategories: uncategorized
    });
}));

// ============================================
// POST /v1/template-taxonomy/categories
// ============================================
router.post('/categories', requireRole('admin'), asyncHandler(async (req, res) => {
    const { bot_id, label, description, sort_order, is_active } = req.body;
    const key = normalizeKey(req.body.key);

    if (!bot_id || !key || !label) {
        return res.status(400).json({ error: 'bot_id, key, and label are required' });
    }

    const bot = await assertBotInWorkspace(bot_id, req.user.workspace_id);
    if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    const active = parseBool(is_active);
    const result = await query(
        `
        INSERT INTO template_categories (bot_id, key, label, description, sort_order, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
            bot_id,
            key,
            String(label).trim(),
            normalizeOptionalText(description) ?? null,
            Number.isInteger(sort_order) ? sort_order : (parseInt(sort_order, 10) || 0),
            active === undefined ? true : active
        ]
    );

    await invalidateTaxonomyCaches(bot_id);
    res.status(201).json({ category: result.rows[0] });
}));

// ============================================
// PATCH /v1/template-taxonomy/categories/:id
// ============================================
router.patch('/categories/:id', requireRole('admin'), asyncHandler(async (req, res) => {
    const check = await query(
        `
        SELECT c.id, c.bot_id
        FROM template_categories c
        JOIN bots b ON b.id = c.bot_id
        WHERE c.id = $1 AND b.workspace_id = $2
        `,
        [req.params.id, req.user.workspace_id]
    );

    if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (req.body.label !== undefined) {
        updates.push(`label = $${idx++}`);
        params.push(String(req.body.label).trim());
    }
    if (req.body.description !== undefined) {
        updates.push(`description = $${idx++}`);
        params.push(normalizeOptionalText(req.body.description));
    }
    if (req.body.sort_order !== undefined) {
        updates.push(`sort_order = $${idx++}`);
        params.push(parseInt(req.body.sort_order, 10) || 0);
    }
    if (req.body.is_active !== undefined) {
        const active = parseBool(req.body.is_active);
        if (active === undefined) {
            return res.status(400).json({ error: 'is_active must be boolean' });
        }
        updates.push(`is_active = $${idx++}`);
        params.push(active);
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(req.params.id);

    const result = await query(
        `UPDATE template_categories SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
    );

    await invalidateTaxonomyCaches(check.rows[0].bot_id);
    res.json({ category: result.rows[0] });
}));

// ============================================
// DELETE /v1/template-taxonomy/categories/:id
// Hard delete only when not referenced (use disable otherwise)
// ============================================
router.delete('/categories/:id', requireRole('admin'), asyncHandler(async (req, res) => {
    const check = await query(
        `
        SELECT c.id, c.bot_id, c.key
        FROM template_categories c
        JOIN bots b ON b.id = c.bot_id
        WHERE c.id = $1 AND b.workspace_id = $2
        `,
        [req.params.id, req.user.workspace_id]
    );

    if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
    }

    const { bot_id, key } = check.rows[0];
    const subCount = await query(
        'SELECT COUNT(*)::int AS count FROM template_subcategories WHERE bot_id = $1 AND category_key = $2',
        [bot_id, key]
    );
    const templateCount = await query(
        'SELECT COUNT(*)::int AS count FROM templates WHERE bot_id = $1 AND category = $2',
        [bot_id, key]
    );

    const refs = {
        subcategories: subCount.rows[0].count,
        templates: templateCount.rows[0].count
    };

    if (refs.subcategories > 0 || refs.templates > 0) {
        return res.status(409).json({
            error: 'Category still in use. Disable it first or clear dependent subcategories/templates.',
            references: refs
        });
    }

    await query('DELETE FROM template_categories WHERE id = $1', [req.params.id]);
    await invalidateTaxonomyCaches(bot_id);
    res.json({ success: true });
}));

// ============================================
// POST /v1/template-taxonomy/subcategories
// ============================================
router.post('/subcategories', requireRole('admin'), asyncHandler(async (req, res) => {
    const { bot_id, category_key, label, description, sort_order, is_active, default_template_count } = req.body;
    const key = normalizeKey(req.body.key);
    const normalizedCategoryKey = normalizeKey(category_key);
    const replyMode = req.body.reply_mode || 'continuation';
    const greetingPolicy = req.body.greeting_policy || 'forbidden';
    const strategyPool = normalizeOptionalJsonArray(req.body.strategy_pool);

    if (!bot_id || !normalizedCategoryKey || !key || !label) {
        return res.status(400).json({ error: 'bot_id, category_key, key, and label are required' });
    }
    if (!isValidReplyMode(replyMode)) {
        return res.status(400).json({ error: 'Invalid reply_mode' });
    }
    if (!isValidGreetingPolicy(greetingPolicy)) {
        return res.status(400).json({ error: 'Invalid greeting_policy' });
    }
    if (strategyPool === undefined) {
        return res.status(400).json({ error: 'strategy_pool must be an array when provided' });
    }

    const bot = await assertBotInWorkspace(bot_id, req.user.workspace_id);
    if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    const categoryCheck = await query(
        'SELECT id FROM template_categories WHERE bot_id = $1 AND key = $2',
        [bot_id, normalizedCategoryKey]
    );
    if (categoryCheck.rows.length === 0) {
        return res.status(400).json({ error: 'category_key not found for this bot' });
    }

    const active = parseBool(is_active);
    const defaultCount = parseInt(default_template_count, 10);
    const result = await query(
        `
        INSERT INTO template_subcategories (
            bot_id, category_key, key, label, description,
            reply_mode, greeting_policy, default_template_count,
            strategy_pool, sort_order, is_active
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
        RETURNING *
        `,
        [
            bot_id,
            normalizedCategoryKey,
            key,
            String(label).trim(),
            normalizeOptionalText(description) ?? null,
            replyMode,
            greetingPolicy,
            Number.isFinite(defaultCount) && defaultCount > 0 ? defaultCount : 3,
            JSON.stringify(strategyPool ?? []),
            Number.isInteger(sort_order) ? sort_order : (parseInt(sort_order, 10) || 0),
            active === undefined ? true : active
        ]
    );

    await invalidateTaxonomyCaches(bot_id);
    res.status(201).json({ subcategory: result.rows[0] });
}));

// ============================================
// PATCH /v1/template-taxonomy/subcategories/:id
// ============================================
router.patch('/subcategories/:id', requireRole('admin'), asyncHandler(async (req, res) => {
    const check = await query(
        `
        SELECT s.id, s.bot_id
        FROM template_subcategories s
        JOIN bots b ON b.id = s.bot_id
        WHERE s.id = $1 AND b.workspace_id = $2
        `,
        [req.params.id, req.user.workspace_id]
    );

    if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Subcategory not found' });
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (req.body.label !== undefined) {
        updates.push(`label = $${idx++}`);
        params.push(String(req.body.label).trim());
    }
    if (req.body.description !== undefined) {
        updates.push(`description = $${idx++}`);
        params.push(normalizeOptionalText(req.body.description));
    }
    if (req.body.sort_order !== undefined) {
        updates.push(`sort_order = $${idx++}`);
        params.push(parseInt(req.body.sort_order, 10) || 0);
    }
    if (req.body.is_active !== undefined) {
        const active = parseBool(req.body.is_active);
        if (active === undefined) {
            return res.status(400).json({ error: 'is_active must be boolean' });
        }
        updates.push(`is_active = $${idx++}`);
        params.push(active);
    }
    if (req.body.reply_mode !== undefined) {
        if (!isValidReplyMode(req.body.reply_mode)) {
            return res.status(400).json({ error: 'Invalid reply_mode' });
        }
        updates.push(`reply_mode = $${idx++}`);
        params.push(req.body.reply_mode);
    }
    if (req.body.greeting_policy !== undefined) {
        if (!isValidGreetingPolicy(req.body.greeting_policy)) {
            return res.status(400).json({ error: 'Invalid greeting_policy' });
        }
        updates.push(`greeting_policy = $${idx++}`);
        params.push(req.body.greeting_policy);
    }
    if (req.body.default_template_count !== undefined) {
        const count = parseInt(req.body.default_template_count, 10);
        if (!Number.isFinite(count) || count <= 0) {
            return res.status(400).json({ error: 'default_template_count must be a positive integer' });
        }
        updates.push(`default_template_count = $${idx++}`);
        params.push(count);
    }
    if (req.body.strategy_pool !== undefined) {
        const strategyPool = normalizeOptionalJsonArray(req.body.strategy_pool);
        if (strategyPool === undefined) {
            return res.status(400).json({ error: 'strategy_pool must be an array' });
        }
        updates.push(`strategy_pool = $${idx++}::jsonb`);
        params.push(JSON.stringify(strategyPool));
    }
    if (req.body.category_key !== undefined) {
        const categoryKey = normalizeKey(req.body.category_key);
        if (!categoryKey) {
            return res.status(400).json({ error: 'category_key cannot be empty' });
        }
        const categoryCheck = await query(
            'SELECT id FROM template_categories WHERE bot_id = $1 AND key = $2',
            [check.rows[0].bot_id, categoryKey]
        );
        if (categoryCheck.rows.length === 0) {
            return res.status(400).json({ error: 'category_key not found for this bot' });
        }
        updates.push(`category_key = $${idx++}`);
        params.push(categoryKey);
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(req.params.id);

    const result = await query(
        `UPDATE template_subcategories SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
    );

    await invalidateTaxonomyCaches(check.rows[0].bot_id);
    res.json({ subcategory: result.rows[0] });
}));

// ============================================
// DELETE /v1/template-taxonomy/subcategories/:id
// Hard delete only when not referenced (use disable otherwise)
// ============================================
router.delete('/subcategories/:id', requireRole('admin'), asyncHandler(async (req, res) => {
    const check = await query(
        `
        SELECT s.id, s.bot_id, s.key
        FROM template_subcategories s
        JOIN bots b ON b.id = s.bot_id
        WHERE s.id = $1 AND b.workspace_id = $2
        `,
        [req.params.id, req.user.workspace_id]
    );

    if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Subcategory not found' });
    }

    const templateCount = await query(
        'SELECT COUNT(*)::int AS count FROM templates WHERE bot_id = $1 AND sub_category = $2',
        [check.rows[0].bot_id, check.rows[0].key]
    );
    const refs = { templates: templateCount.rows[0].count };

    if (refs.templates > 0) {
        return res.status(409).json({
            error: 'Subcategory still used by templates. Disable it first or reassign/delete dependent templates.',
            references: refs
        });
    }

    await query('DELETE FROM template_subcategories WHERE id = $1', [req.params.id]);
    await invalidateTaxonomyCaches(check.rows[0].bot_id);
    res.json({ success: true });
}));

module.exports = router;
