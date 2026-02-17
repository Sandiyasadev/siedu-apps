const express = require('express');
const router = express.Router();
const { query } = require('../utils/db');
const { asyncHandler } = require('../middleware/errorHandler');

// POST /v1/scheduled/quick - Quick schedule follow-up
router.post('/quick', asyncHandler(async (req, res) => {
    const { conversation_id, hours, content } = req.body;

    if (!conversation_id || !hours || !content) {
        return res.status(400).json({ error: 'conversation_id, hours, and content are required' });
    }

    // Verify conversation belongs to user's workspace
    const convCheck = await query(`
        SELECT c.id FROM conversations c
        JOIN bots b ON b.id = c.bot_id
        WHERE c.id = $1 AND b.workspace_id = $2
    `, [conversation_id, req.user.workspace_id]);

    if (convCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Conversation not found in your workspace' });
    }

    const scheduledAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    // Insert scheduled message
    const result = await query(`
        INSERT INTO scheduled_messages (conversation_id, content, scheduled_at, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING id, conversation_id, content, scheduled_at, status
    `, [conversation_id, content, scheduledAt, req.user.id]);

    res.status(201).json({ scheduled: result.rows[0] });
}));

// GET /v1/scheduled - List scheduled messages
router.get('/', asyncHandler(async (req, res) => {
    const result = await query(`
        SELECT sm.* FROM scheduled_messages sm
        JOIN conversations c ON c.id = sm.conversation_id
        JOIN bots b ON b.id = c.bot_id
        WHERE b.workspace_id = $1
        ORDER BY sm.scheduled_at ASC
    `, [req.user.workspace_id]);

    res.json({ scheduled: result.rows });
}));

module.exports = router;
