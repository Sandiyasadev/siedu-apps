const express = require('express');
const router = express.Router();
const { query } = require('../utils/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireRole } = require('../middleware/auth');

// ============================================
// GET /v1/templates - List templates for a bot
// ============================================
router.get('/', asyncHandler(async (req, res) => {
    const { bot_id, category } = req.query;

    let sql = `
        SELECT t.*, b.name as bot_name
        FROM templates t
        JOIN bots b ON b.id = t.bot_id
        WHERE b.workspace_id = $1 AND t.is_active = true
    `;
    const params = [req.user.workspace_id];
    let paramIndex = 2;

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

    sql += ' ORDER BY t.category, t.use_count DESC';

    const result = await query(sql, params);
    res.json({ templates: result.rows });
}));

// ============================================
// GET /v1/templates/:id - Get single template
// ============================================
router.get('/:id', asyncHandler(async (req, res) => {
    const result = await query(`
        SELECT t.*, b.name as bot_name
        FROM templates t
        JOIN bots b ON b.id = t.bot_id
        WHERE t.id = $1 AND b.workspace_id = $2
    `, [req.params.id, req.user.workspace_id]);

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template: result.rows[0] });
}));

// ============================================
// POST /v1/templates - Create template
// ============================================
router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
    const { bot_id, name, content, category, shortcut } = req.body;

    if (!bot_id || !name || !content) {
        return res.status(400).json({ error: 'bot_id, name, and content are required' });
    }

    // Verify bot belongs to workspace
    const botCheck = await query(`
        SELECT id FROM bots WHERE id = $1 AND workspace_id = $2
    `, [bot_id, req.user.workspace_id]);

    if (botCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    const result = await query(`
        INSERT INTO templates (bot_id, name, content, category, shortcut)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `, [bot_id, name, content, category || 'general', shortcut]);

    res.status(201).json({ template: result.rows[0] });
}));

// ============================================
// PATCH /v1/templates/:id - Update template
// ============================================
router.patch('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
    const { name, content, category, shortcut, is_active } = req.body;

    // Verify template belongs to workspace
    const check = await query(`
        SELECT t.id FROM templates t
        JOIN bots b ON b.id = t.bot_id
        WHERE t.id = $1 AND b.workspace_id = $2
    `, [req.params.id, req.user.workspace_id]);

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

    res.json({ template: result.rows[0] });
}));

// ============================================
// DELETE /v1/templates/:id - Delete template
// ============================================
router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
    // Verify template belongs to workspace
    const check = await query(`
        SELECT t.id FROM templates t
        JOIN bots b ON b.id = t.bot_id
        WHERE t.id = $1 AND b.workspace_id = $2
    `, [req.params.id, req.user.workspace_id]);

    if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
    }

    await query('DELETE FROM templates WHERE id = $1', [req.params.id]);
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
    `, [req.params.id, req.user.workspace_id]);

    if (templateResult.rows.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
    }

    // Verify conversation belongs to the same workspace
    const convCheck = await query(`
        SELECT c.id FROM conversations c
        JOIN bots b ON b.id = c.bot_id
        WHERE c.id = $1 AND b.workspace_id = $2
    `, [conversation_id, req.user.workspace_id]);

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
