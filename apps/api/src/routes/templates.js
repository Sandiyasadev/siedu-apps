const express = require('express');
const router = express.Router();
const { query } = require('../utils/db');
const { delByPattern } = require('../utils/cache');
const asyncHandler = require('../middleware/asyncHandler');
const { requireRole, getEffectiveWorkspaceId } = require('../middleware/auth');
const { seedDefaultTemplatesForBot } = require('../services/templateDefaults');

const parseBool = (value) => {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return undefined;
};

const normalizeOptionalSubCategory = (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
};

const invalidateTemplateCaches = async (botId) => {
    await delByPattern(`internal:bot-templates:${botId}:*`);
    await delByPattern(`internal:template-taxonomy:${botId}:*`);
};

// ============================================
// GET /v1/templates - List templates for a bot
// ============================================
router.get('/', requireRole('admin'), asyncHandler(async (req, res) => {
    const { bot_id, category } = req.query;
    const sub_category = normalizeOptionalSubCategory(req.query.sub_category);
    const includeInactive = parseBool(req.query.include_inactive) === true;
    const activeFilter = parseBool(req.query.is_active);

    let sql = `
        SELECT t.*, b.name as bot_name
        FROM templates t
        JOIN bots b ON b.id = t.bot_id
        WHERE b.workspace_id = $1
    `;
    const params = [getEffectiveWorkspaceId(req)];
    let paramIndex = 2;

    if (!includeInactive) {
        sql += ` AND t.is_active = true`;
    } else if (activeFilter !== undefined) {
        sql += ` AND t.is_active = $${paramIndex}`;
        params.push(activeFilter);
        paramIndex++;
    }

    if (bot_id) {
        sql += ` AND t.bot_id = $${paramIndex}`;
        params.push(bot_id);
        paramIndex++;
    }

    if (category) {
        sql += ` AND t.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
    }

    // `sub_category=` (empty string) explicitly filters templates without intent mapping.
    if (req.query.sub_category !== undefined) {
        if (sub_category === null) {
            sql += ` AND t.sub_category IS NULL`;
        } else if (sub_category !== undefined) {
            sql += ` AND t.sub_category = $${paramIndex}`;
            params.push(sub_category);
            paramIndex++;
        }
    }

    sql += ' ORDER BY t.category, t.use_count DESC';

    const result = await query(sql, params);
    res.json({ templates: result.rows });
}));

// ============================================
// GET /v1/templates/:id - Get single template
// ============================================
router.get('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
    const result = await query(`
        SELECT t.*, b.name as bot_name
        FROM templates t
        JOIN bots b ON b.id = t.bot_id
        WHERE t.id = $1 AND b.workspace_id = $2
    `, [req.params.id, getEffectiveWorkspaceId(req)]);

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template: result.rows[0] });
}));

// ============================================
// POST /v1/templates/apply-default
// Seed default templates preset to a bot (idempotent)
// ============================================
router.post('/apply-default', requireRole('admin'), asyncHandler(async (req, res) => {
    const { bot_id } = req.body || {};
    const mode = String(req.body?.mode || 'skip_existing').trim();
    const presetKey = String(req.body?.preset_key || 'default-v1').trim();

    if (!bot_id) {
        return res.status(400).json({ error: 'bot_id is required' });
    }
    if (!['skip_existing', 'reactivate_existing'].includes(mode)) {
        return res.status(400).json({ error: 'Invalid mode. Use skip_existing or reactivate_existing' });
    }

    const botCheck = await query(
        `SELECT id FROM bots WHERE id = $1 AND workspace_id = $2`,
        [bot_id, getEffectiveWorkspaceId(req)]
    );

    if (botCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    try {
        const summary = await seedDefaultTemplatesForBot(bot_id, { mode, presetKey });
        res.json({
            success: true,
            message: mode === 'reactivate_existing'
                ? 'Default templates applied and eligible templates reactivated'
                : 'Default templates applied (missing templates only)',
            mode,
            preset_key: presetKey,
            summary,
        });
    } catch (error) {
        if (['PRESET_NOT_FOUND', 'PRESET_READ_FAILED', 'PRESET_INVALID_JSON', 'PRESET_EMPTY'].includes(error.code)) {
            return res.status(400).json({ error: error.message, code: error.code });
        }
        throw error;
    }
}));

// ============================================
// POST /v1/templates - Create template
// ============================================
router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
    const { bot_id, name, content, category, shortcut } = req.body;
    const sub_category = normalizeOptionalSubCategory(req.body.sub_category);

    if (!bot_id || !name || !content) {
        return res.status(400).json({ error: 'bot_id, name, and content are required' });
    }

    // Verify bot belongs to workspace
    const botCheck = await query(`
        SELECT id FROM bots WHERE id = $1 AND workspace_id = $2
    `, [bot_id, getEffectiveWorkspaceId(req)]);

    if (botCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    const result = await query(`
        INSERT INTO templates (bot_id, name, content, category, sub_category, shortcut)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `, [bot_id, name, content, category || 'general', sub_category ?? null, shortcut]);

    await invalidateTemplateCaches(bot_id);

    res.status(201).json({ template: result.rows[0] });
}));

// ============================================
// PATCH /v1/templates/:id - Update template
// ============================================
router.patch('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
    const { name, content, category, shortcut, is_active } = req.body;
    const sub_category = normalizeOptionalSubCategory(req.body.sub_category);

    // Verify template belongs to workspace
    const check = await query(`
        SELECT t.id, t.bot_id FROM templates t
        JOIN bots b ON b.id = t.bot_id
        WHERE t.id = $1 AND b.workspace_id = $2
    `, [req.params.id, getEffectiveWorkspaceId(req)]);

    if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        params.push(name);
        paramIndex++;
    }
    if (content !== undefined) {
        updates.push(`content = $${paramIndex}`);
        params.push(content);
        paramIndex++;
    }
    if (category !== undefined) {
        updates.push(`category = $${paramIndex}`);
        params.push(category);
        paramIndex++;
    }
    if (shortcut !== undefined) {
        updates.push(`shortcut = $${paramIndex}`);
        params.push(shortcut);
        paramIndex++;
    }
    if (sub_category !== undefined) {
        updates.push(`sub_category = $${paramIndex}`);
        params.push(sub_category);
        paramIndex++;
    }
    if (is_active !== undefined) {
        updates.push(`is_active = $${paramIndex}`);
        params.push(is_active);
        paramIndex++;
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(req.params.id);

    const result = await query(`
        UPDATE templates SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
    `, params);

    await invalidateTemplateCaches(result.rows[0].bot_id);

    res.json({ template: result.rows[0] });
}));

// ============================================
// DELETE /v1/templates/:id - Delete template
// ============================================
router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
    // Verify template belongs to workspace
    const check = await query(`
        SELECT t.id, t.bot_id FROM templates t
        JOIN bots b ON b.id = t.bot_id
        WHERE t.id = $1 AND b.workspace_id = $2
    `, [req.params.id, getEffectiveWorkspaceId(req)]);

    if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
    }

    await query('DELETE FROM templates WHERE id = $1', [req.params.id]);
    await invalidateTemplateCaches(check.rows[0].bot_id);
    res.json({ success: true });
}));

// ============================================
// POST /v1/templates/:id/send - Send template to conversation
// ============================================
router.post('/:id/send', asyncHandler(async (req, res) => {
    const { conversation_id } = req.body;

    if (!conversation_id) {
        return res.status(400).json({ error: 'conversation_id is required' });
    }

    // Get template (verified against workspace)
    const templateResult = await query(`
        SELECT t.*, b.booking_link
        FROM templates t
        JOIN bots b ON b.id = t.bot_id
        WHERE t.id = $1 AND b.workspace_id = $2
    `, [req.params.id, getEffectiveWorkspaceId(req)]);

    if (templateResult.rows.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
    }

    // Verify conversation belongs to the same workspace
    const convCheck = await query(`
        SELECT c.id FROM conversations c
        JOIN bots b ON b.id = c.bot_id
        WHERE c.id = $1 AND b.workspace_id = $2
    `, [conversation_id, getEffectiveWorkspaceId(req)]);

    if (convCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Conversation not found in your workspace' });
    }

    const template = templateResult.rows[0];

    // Replace placeholders
    let content = template.content;
    content = content.replace('{{booking_link}}', template.booking_link || '[Link belum diatur]');

    // Get conversation and send via channel service
    const channelService = require('../services/channelService');
    const sendResult = await channelService.sendToChannel(conversation_id, content);

    if (sendResult.success) {
        // Save as message
        await query(`
            INSERT INTO messages (conversation_id, role, content)
            VALUES ($1, 'agent', $2)
        `, [conversation_id, content]);

        // Increment use count
        await query('UPDATE templates SET use_count = use_count + 1 WHERE id = $1', [req.params.id]);
    }

    res.json({ success: sendResult.success, error: sendResult.error });
}));

module.exports = router;
