const express = require('express');
const router = express.Router();
const multer = require('multer');
const { query } = require('../utils/db');
const asyncHandler = require('../middleware/asyncHandler');
const { emitNewMessage, emitStatusChange } = require('../services/socketService');
const cache = require('../utils/cache');
const { storeOutboundMedia, buildMediaContent, getWhatsAppMediaType } = require('../services/mediaService');
const { sendToChannel } = require('../services/channelService');

// Multer config: memory storage, 20MB limit
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }
});

// ============================================
// GET /v1/conversations/stats - Dashboard stats (with caching)
// ============================================
router.get('/stats', asyncHandler(async (req, res) => {
    const workspaceId = req.user.workspace_id;
    const cacheKey = `stats:${workspaceId}`;

    // Try to get from cache first (60 second TTL)
    const cachedStats = await cache.get(cacheKey);
    if (cachedStats) {
        return res.json({ stats: cachedStats, cached: true });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Run all queries in parallel
    const [
        statusCounts,
        channelCounts,
        todayConversations,
        todayMessages,
        contactsCount,
        avgResponseTime
    ] = await Promise.all([
        // Conversations by status
        query(`
            SELECT c.status, COUNT(*) as count
            FROM conversations c
            JOIN bots b ON b.id = c.bot_id
            WHERE b.workspace_id = $1
            GROUP BY c.status
        `, [workspaceId]),

        // Conversations by channel
        query(`
            SELECT c.channel_type, COUNT(*) as count
            FROM conversations c
            JOIN bots b ON b.id = c.bot_id
            WHERE b.workspace_id = $1
            GROUP BY c.channel_type
        `, [workspaceId]),

        // Today's new conversations
        query(`
            SELECT COUNT(*) as count
            FROM conversations c
            JOIN bots b ON b.id = c.bot_id
            WHERE b.workspace_id = $1 AND c.created_at >= $2
        `, [workspaceId, today]),

        // Today's messages
        query(`
            SELECT COUNT(*) as count
            FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            JOIN bots b ON b.id = c.bot_id
            WHERE b.workspace_id = $1 AND m.created_at >= $2
        `, [workspaceId, today]),

        // Total contacts
        query(`
            SELECT COUNT(*) as count FROM contacts WHERE workspace_id = $1
        `, [workspaceId]),

        // Avg response time (time between user message and bot/agent reply)
        query(`
            SELECT AVG(response_time) as avg_seconds FROM (
                SELECT 
                    EXTRACT(EPOCH FROM (
                        (SELECT MIN(created_at) FROM messages m2 
                         WHERE m2.conversation_id = m.conversation_id 
                         AND m2.role IN ('assistant', 'agent') 
                         AND m2.created_at > m.created_at)
                        - m.created_at
                    )) as response_time
                FROM messages m
                JOIN conversations c ON c.id = m.conversation_id
                JOIN bots b ON b.id = c.bot_id
                WHERE b.workspace_id = $1 AND m.role = 'user' AND m.created_at >= $2
            ) sub WHERE response_time IS NOT NULL
        `, [workspaceId, today])
    ]);

    // Calculate totals (V1: only bot/human statuses)
    const totalConversations = statusCounts.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
    const botCount = statusCounts.rows.find(r => r.status === 'bot')?.count || 0;
    const humanCount = statusCounts.rows.find(r => r.status === 'human')?.count || 0;

    // AI resolution rate = bot-handled / total (approximate)
    const aiResolutionRate = totalConversations > 0
        ? Math.round((parseInt(botCount) / totalConversations) * 100)
        : 0;

    const stats = {
        totalConversations,
        conversationsByStatus: {
            bot: parseInt(botCount),
            human: parseInt(humanCount)
        },
        conversationsByChannel: channelCounts.rows.reduce((acc, r) => {
            acc[r.channel_type] = parseInt(r.count);
            return acc;
        }, {}),
        todayConversations: parseInt(todayConversations.rows[0]?.count || 0),
        todayMessages: parseInt(todayMessages.rows[0]?.count || 0),
        totalContacts: parseInt(contactsCount.rows[0]?.count || 0),
        aiResolutionRate,
        avgResponseTimeSeconds: Math.round(avgResponseTime.rows[0]?.avg_seconds || 0)
    };

    // Cache for 60 seconds
    await cache.set(cacheKey, stats, 60);

    res.json({ stats });
}));

// ============================================
// GET /v1/conversations - List conversations (with cursor pagination)
// ============================================
router.get('/', asyncHandler(async (req, res) => {
    const {
        bot_id,
        status,
        channel_type,
        limit = 50,
        cursor,           // cursor_id for pagination
        direction = 'next' // 'next' or 'prev'
    } = req.query;

    // Validate and cap limit
    const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);

    // Build base query - use denormalized fields for performance
    let sql = `
        SELECT 
            c.id,
            c.cursor_id,
            c.bot_id,
            c.channel_type,
            c.external_thread_id,
            c.status,
            c.handoff_reason,
            c.handoff_at,
            c.assigned_agent,
            c.last_user_at,
            c.created_at,
            c.updated_at,
            c.agent_read_at,
            c.unread_count,
            c.last_message_preview,
            c.last_message_at,
            c.last_message_role,
            c.message_count,
            b.name as bot_name,
            COALESCE(co.display_name, co.name) as contact_name,
            co.avatar_url as contact_avatar,
            co.phone as contact_phone
        FROM conversations c
        JOIN bots b ON b.id = c.bot_id
        LEFT JOIN contacts co ON co.id = c.contact_id
        WHERE b.workspace_id = $1
    `;

    const params = [req.user.workspace_id];
    let paramIndex = 2;

    // Filter by bot
    if (bot_id) {
        sql += ` AND c.bot_id = $${paramIndex}`;
        params.push(bot_id);
        paramIndex++;
    }

    // Filter by status
    if (status && status !== 'all') {
        sql += ` AND c.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
    }

    // Filter by channel
    if (channel_type && channel_type !== 'all') {
        sql += ` AND c.channel_type = $${paramIndex}`;
        params.push(channel_type);
        paramIndex++;
    }

    // Cursor-based pagination
    if (cursor) {
        const cursorValue = parseInt(cursor);
        if (!isNaN(cursorValue)) {
            if (direction === 'prev') {
                sql += ` AND c.cursor_id > $${paramIndex}`;
            } else {
                sql += ` AND c.cursor_id < $${paramIndex}`;
            }
            params.push(cursorValue);
            paramIndex++;
        }
    }

    // Order by cursor_id DESC (newest first)
    // Fallback to last_message_at for sorting display
    sql += ` ORDER BY c.cursor_id DESC`;
    sql += ` LIMIT $${paramIndex}`;
    params.push(safeLimit + 1); // Fetch one extra to check if there are more

    const result = await query(sql, params);

    // Check if there are more results
    const hasMore = result.rows.length > safeLimit;
    const conversations = hasMore ? result.rows.slice(0, safeLimit) : result.rows;

    // Get cursor values for pagination
    const nextCursor = conversations.length > 0
        ? conversations[conversations.length - 1].cursor_id
        : null;
    const prevCursor = conversations.length > 0
        ? conversations[0].cursor_id
        : null;

    res.json({
        conversations,
        pagination: {
            limit: safeLimit,
            has_more: hasMore,
            next_cursor: hasMore ? nextCursor : null,
            prev_cursor: cursor ? prevCursor : null
        }
    });
}));

// ============================================
// GET /v1/conversations/:id - Get detail
// ============================================
router.get('/:id', asyncHandler(async (req, res) => {
    const result = await query(`
        SELECT 
            c.*, 
            b.name as bot_name,
            co.name as contact_name,
            co.email as contact_email,
            co.phone as contact_phone,
            co.avatar_url as contact_avatar
        FROM conversations c
        JOIN bots b ON b.id = c.bot_id
        LEFT JOIN contacts co ON co.id = c.contact_id
        WHERE c.id = $1 AND b.workspace_id = $2
    `, [req.params.id, req.user.workspace_id]);

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ conversation: result.rows[0] });
}));

// ============================================
// DELETE /v1/conversations/:id/messages - Clear history
// ============================================
router.delete('/:id/messages', asyncHandler(async (req, res) => {
    const conversationId = req.params.id;

    // Verify conversation belongs to user's workspace
    const check = await query(`
        SELECT c.id FROM conversations c
        JOIN bots b ON b.id = c.bot_id
        WHERE c.id = $1 AND b.workspace_id = $2
    `, [conversationId, req.user.workspace_id]);

    if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Conversation not found' });
    }

    // Delete all messages for this conversation
    await query(`
        DELETE FROM messages 
        WHERE conversation_id = $1
    `, [conversationId]);

    // Reset unread count and last message preview might need update but for now just clear messages
    await query(`
        UPDATE conversations 
        SET unread_count = 0, agent_read_at = NOW()
        WHERE id = $1
    `, [conversationId]);

    res.json({ success: true, message: 'History cleared' });
}));

// ============================================
// PATCH /v1/conversations/:id/contact - Update contact name
// ============================================
router.patch('/:id/contact', asyncHandler(async (req, res) => {
    const conversationId = req.params.id;
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }

    // Verify conversation and get contact_id
    const conv = await query(`
        SELECT c.contact_id FROM conversations c
        JOIN bots b ON b.id = c.bot_id
        WHERE c.id = $1 AND b.workspace_id = $2
    `, [conversationId, req.user.workspace_id]);

    if (conv.rows.length === 0) {
        return res.status(404).json({ error: 'Conversation not found' });
    }

    const contactId = conv.rows[0].contact_id;
    if (!contactId) {
        return res.status(404).json({ error: 'Contact not found for this conversation' });
    }

    // Update contact name
    const result = await query(`
        UPDATE contacts 
        SET name = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
    `, [name, contactId]);

    res.json({ contact: result.rows[0] });
}));

// ============================================
// POST /v1/conversations/:id/read - Mark conversation as read
// ============================================
router.post('/:id/read', asyncHandler(async (req, res) => {
    // Verify conversation belongs to user's workspace
    const check = await query(`
        SELECT c.id FROM conversations c
        JOIN bots b ON b.id = c.bot_id
        WHERE c.id = $1 AND b.workspace_id = $2
    `, [req.params.id, req.user.workspace_id]);

    if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Conversation not found' });
    }

    // Mark as read and reset unread count
    const result = await query(`
        UPDATE conversations 
        SET agent_read_at = NOW(), unread_count = 0
        WHERE id = $1
        RETURNING *
    `, [req.params.id]);

    res.json({ conversation: result.rows[0] });
}));

// ============================================
// PATCH /v1/conversations/:id/status
// ============================================
router.patch('/:id/status', asyncHandler(async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['bot', 'human'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Use: bot, human' });
    }

    const check = await query(`
        SELECT c.id FROM conversations c
        JOIN bots b ON b.id = c.bot_id
        WHERE c.id = $1 AND b.workspace_id = $2
    `, [req.params.id, req.user.workspace_id]);

    if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Conversation not found' });
    }

    // V1 Simplified: only bot/human toggle
    let sql;
    if (status === 'human') {
        // Taking over: set agent timestamp for timeout tracking
        sql = `UPDATE conversations SET status = 'human', last_agent_reply_at = NOW(), unanswered_count = 0 WHERE id = $1 RETURNING *`;
    } else {
        // Back to bot: reset counters
        sql = `UPDATE conversations SET status = 'bot', unanswered_count = 0 WHERE id = $1 RETURNING *`;
    }

    const result = await query(sql, [req.params.id]);

    // Emit socket event
    emitStatusChange(req.params.id, status);

    res.json({ conversation: result.rows[0] });
}));

// ============================================
// GET /v1/conversations/:id/messages (with cursor pagination)
// ============================================
router.get('/:id/messages', asyncHandler(async (req, res) => {
    const {
        limit = 50,
        cursor,
        direction = 'older' // 'older' or 'newer'
    } = req.query;

    // Validate and cap limit
    const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);

    // Verify conversation access
    const check = await query(`
        SELECT c.id FROM conversations c
        JOIN bots b ON b.id = c.bot_id
        WHERE c.id = $1 AND b.workspace_id = $2
    `, [req.params.id, req.user.workspace_id]);

    if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Conversation not found' });
    }

    // Build query with cursor pagination
    let sql = `
        SELECT id, cursor_id, role, content, raw, created_at
        FROM messages
        WHERE conversation_id = $1
    `;
    const params = [req.params.id];
    let paramIndex = 2;

    // Apply cursor filter
    if (cursor) {
        const cursorValue = parseInt(cursor);
        if (!isNaN(cursorValue)) {
            if (direction === 'newer') {
                sql += ` AND cursor_id > $${paramIndex}`;
            } else {
                sql += ` AND cursor_id < $${paramIndex}`;
            }
            params.push(cursorValue);
            paramIndex++;
        }
    }

    // Order: newest first for loading, then reverse in client
    // Or if loading older, use DESC
    if (direction === 'newer') {
        sql += ` ORDER BY cursor_id ASC`;
    } else {
        sql += ` ORDER BY cursor_id DESC`;
    }

    sql += ` LIMIT $${paramIndex}`;
    params.push(safeLimit + 1);

    const result = await query(sql, params);

    // Check if there are more
    const hasMore = result.rows.length > safeLimit;
    let messages = hasMore ? result.rows.slice(0, safeLimit) : result.rows;

    // If loading older (DESC), reverse to get chronological order
    if (direction !== 'newer') {
        messages = messages.reverse();
    }

    // Get cursors
    const oldestCursor = messages.length > 0 ? messages[0].cursor_id : null;
    const newestCursor = messages.length > 0 ? messages[messages.length - 1].cursor_id : null;

    res.json({
        messages,
        pagination: {
            limit: safeLimit,
            has_more: hasMore,
            oldest_cursor: oldestCursor,
            newest_cursor: newestCursor,
            has_older: direction !== 'newer' ? hasMore : undefined,
            has_newer: direction === 'newer' ? hasMore : undefined
        }
    });
}));

// ============================================
// POST /v1/conversations/:id/messages - Agent reply (text or media)
// ============================================
router.post('/:id/messages', upload.single('file'), asyncHandler(async (req, res) => {
    const content = req.body.content || '';
    const file = req.file;

    // Must have either text or file
    if (!content.trim() && !file) {
        return res.status(400).json({ error: 'Content or file is required' });
    }

    const convResult = await query(`
        SELECT c.*, b.name as bot_name
        FROM conversations c
        JOIN bots b ON b.id = c.bot_id
        WHERE c.id = $1 AND b.workspace_id = $2
    `, [req.params.id, req.user.workspace_id]);

    if (convResult.rows.length === 0) {
        return res.status(404).json({ error: 'Conversation not found' });
    }

    let messageContent = content.trim();
    let mediaInfo = null; // { buffer, mimeType, originalName } for channel sending

    // Handle file upload
    if (file) {
        try {
            // Store in MinIO
            const stored = await storeOutboundMedia(file.buffer, file.originalname, file.mimetype);
            const mediaType = getWhatsAppMediaType(file.mimetype);

            // Build media content string for DB
            messageContent = buildMediaContent(mediaType, stored.objectKey, content.trim() || null);

            // Prepare media info for channel sending (pass raw buffer)
            mediaInfo = {
                buffer: file.buffer,
                mimeType: file.mimetype,
                originalName: file.originalname
            };
        } catch (err) {
            console.error('[Conversations] Failed to process outbound media:', err.message);
            return res.status(500).json({ error: 'Failed to upload media' });
        }
    }

    const msgResult = await query(`
        INSERT INTO messages (conversation_id, role, content, raw)
        VALUES ($1, 'agent', $2, $3)
        RETURNING *
    `, [
        req.params.id,
        messageContent,
        JSON.stringify({ sender_id: req.user.id, sender_name: req.user.name })
    ]);

    // Emit socket event for real-time
    emitNewMessage(req.params.id, msgResult.rows[0]);

    // V1: Track agent reply for handoff timeout
    await query(
        `UPDATE conversations 
         SET last_agent_reply_at = NOW(), unanswered_count = 0 
         WHERE id = $1`,
        [req.params.id]
    );

    // Send to external channel (Telegram, WhatsApp, etc.)
    // For media: pass caption (original text) + media object
    // For text: pass text only
    const channelText = file ? (content.trim() || '') : messageContent;
    const sendResult = await sendToChannel(req.params.id, channelText, mediaInfo);

    // Update message with provider_message_id and delivery status
    if (sendResult.success && sendResult.message_id) {
        await query(
            'UPDATE messages SET provider_message_id = $1, status = $2 WHERE id = $3',
            [String(sendResult.message_id), 'sent', msgResult.rows[0].id]
        );
        msgResult.rows[0].provider_message_id = String(sendResult.message_id);
        msgResult.rows[0].status = 'sent';
    } else if (!sendResult.success) {
        console.error('[Conversations] Failed to send to channel:', sendResult.error);
        await query(
            'UPDATE messages SET status = $1 WHERE id = $2',
            ['failed', msgResult.rows[0].id]
        );
        msgResult.rows[0].status = 'failed';
    }

    res.status(201).json({
        message: msgResult.rows[0],
        channel_delivery: sendResult
    });
}));

module.exports = router;
