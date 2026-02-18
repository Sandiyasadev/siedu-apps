const express = require('express');
const router = express.Router();
const { query } = require('../utils/db');
const asyncHandler = require('../middleware/asyncHandler');
const { emitNewMessage, emitStatusChange } = require('../services/socketService');
const { sendToChannel } = require('../services/channelService');
const handoffService = require('../services/handoffService');

// ============================================
// Internal API - For n8n communication
// Protected by INTERNAL_API_KEY
// ============================================

// Middleware: Verify internal API key
const verifyInternalKey = (req, res, next) => {
    const expectedKey = process.env.INTERNAL_API_KEY;

    if (!expectedKey) {
        console.error('INTERNAL_API_KEY not configured');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    // Support both X-Internal-Key header and Bearer token
    const internalKey = req.headers['x-internal-key'];
    const authHeader = req.headers.authorization;

    let token = null;
    if (internalKey) {
        token = internalKey;
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ error: 'Missing authorization' });
    }

    if (token !== expectedKey) {
        return res.status(401).json({ error: 'Invalid API key' });
    }

    next();
};

router.use(verifyInternalKey);

// ============================================
// POST /v1/internal/ai-response
// n8n sends AI response here
// ============================================
router.post('/ai-response', asyncHandler(async (req, res) => {
    const { conversation_id, content, handoff, handoff_reason, sender_type = 'bot' } = req.body;

    // V1: Detect [HANDOFF] tag from AI response
    let cleanContent = content || '';
    let aiRequestedHandoff = false;
    if (cleanContent.includes('[HANDOFF]')) {
        cleanContent = cleanContent.replace(/\[HANDOFF\]/g, '').trim();
        aiRequestedHandoff = true;
        console.log(`[AI Response] HANDOFF detected for conv: ${conversation_id}`);
    }

    if (!conversation_id || !content) {
        return res.status(400).json({ error: 'conversation_id and content are required' });
    }

    // Insert AI/bot message (with clean content, tag stripped)
    const msgResult = await query(`
        INSERT INTO messages (conversation_id, role, content, raw)
        VALUES ($1, 'assistant', $2, $3)
        RETURNING *
    `, [
        conversation_id,
        cleanContent,
        JSON.stringify({ handoff: handoff || aiRequestedHandoff, handoff_reason, sender_type, ai_handoff: aiRequestedHandoff })
    ]);

    // V1: Update conversation status if handoff (from AI tag or explicit)
    if (handoff || aiRequestedHandoff) {
        await query(`
            UPDATE conversations 
            SET status = 'human', unanswered_count = 0
            WHERE id = $1
        `, [conversation_id]);
    }

    // Get conversation for channel routing
    const convResult = await query(`
        SELECT c.*, b.id as bot_id, b.workspace_id
        FROM conversations c 
        JOIN bots b ON b.id = c.bot_id 
        WHERE c.id = $1
    `, [conversation_id]);

    if (convResult.rows.length === 0) {
        return res.status(404).json({ error: 'Conversation not found' });
    }

    const conversation = convResult.rows[0];

    // Emit socket event for real-time update
    emitNewMessage(conversation_id, msgResult.rows[0], conversation.workspace_id);

    if (handoff || aiRequestedHandoff) {
        emitStatusChange(conversation_id, 'human', conversation.workspace_id);
    }

    // Send to external channel (Telegram, WhatsApp, etc.) with clean content
    let channelResult = { success: true };
    if (conversation.channel_type !== 'web') {
        channelResult = await sendToChannel(conversation_id, cleanContent);
        console.log(`[AI Response] Channel send result:`, channelResult);

        // Update message with provider_message_id and status
        if (channelResult.success && channelResult.message_id) {
            await query(
                'UPDATE messages SET provider_message_id = $1, status = $2 WHERE id = $3',
                [String(channelResult.message_id), 'sent', msgResult.rows[0].id]
            );
            msgResult.rows[0].provider_message_id = String(channelResult.message_id);
            msgResult.rows[0].status = 'sent';
        } else if (!channelResult.success) {
            await query(
                'UPDATE messages SET status = $1 WHERE id = $2',
                ['failed', msgResult.rows[0].id]
            );
            msgResult.rows[0].status = 'failed';
        }
    }

    console.log(`[AI Response] Conv: ${conversation_id}, Channel: ${conversation.channel_type}, Handoff: ${handoff}`);

    res.json({
        success: true,
        message: msgResult.rows[0],
        handoff_triggered: !!handoff,
        channel_sent: channelResult.success
    });
}));

// ============================================
// POST /v1/internal/update-state
// Update conversation state from n8n
// ============================================
router.post('/update-state', asyncHandler(async (req, res) => {
    const { conversation_id, status, handoff_reason } = req.body;

    if (!conversation_id || !status) {
        return res.status(400).json({ error: 'conversation_id and status are required' });
    }

    // V1 Simplified: only bot/human
    const validStatuses = ['bot', 'human'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Use: bot, human' });
    }

    let sql;
    const params = [];

    if (status === 'human') {
        sql = `UPDATE conversations SET status = 'human', handoff_at = NOW(), handoff_reason = $1, unanswered_count = 0 WHERE id = $2 RETURNING *`;
        params.push(handoff_reason || 'system', conversation_id);
    } else {
        sql = `UPDATE conversations SET status = 'bot', unanswered_count = 0 WHERE id = $1 RETURNING *`;
        params.push(conversation_id);
    }

    const result = await query(sql, params);

    // Emit socket event
    emitStatusChange(conversation_id, status);

    res.json({ success: true, conversation: result.rows[0] });
}));

// ============================================
// GET /v1/internal/conversation-state/:id
// Get current conversation state for n8n decision
// ============================================
router.get('/conversation-state/:id', asyncHandler(async (req, res) => {
    const result = await query(`
        SELECT status, handoff_reason, handoff_at, assigned_agent
        FROM conversations
        WHERE id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
        // Return default state for new conversations (V1: bot is default)
        return res.json({
            status: 'bot',
            ai_active: true
        });
    }

    const conv = result.rows[0];
    res.json({
        ...conv,
        ai_active: conv.status === 'bot'
    });
}));

// ╔══════════════════════════════════════════════════════════════╗
// ║  PHASE 2 — NOT ACTIVE IN V1                                ║
// ║  Endpoints below implement advanced handoff with scoring,   ║
// ║  queue management, and CS availability.                     ║
// ║  V1 only uses simple bot/human toggle (see hooks.js).       ║
// ║  Keep for future use, do NOT call from n8n in V1.           ║
// ╚══════════════════════════════════════════════════════════════╝

// ============================================
// POST /v1/internal/initiate-handoff
// Initiate handoff process
// ============================================
router.post('/initiate-handoff', asyncHandler(async (req, res) => {
    const {
        conversation_id,
        bot_id,
        trigger_type,
        score,
        signals,
        customer_name,
        customer_contact
    } = req.body;

    if (!conversation_id || !bot_id) {
        return res.status(400).json({ error: 'conversation_id and bot_id are required' });
    }

    const result = await handoffService.initiateHandoff({
        conversationId: conversation_id,
        botId: bot_id,
        triggerType: trigger_type || 'scoring',
        score: score || 0,
        signals: signals || [],
        context: {
            customerName: customer_name,
            customerContact: customer_contact
        }
    });

    if (result.success) {
        // Send handoff message to customer
        if (result.customerMessage) {
            // Insert as system message
            await query(`
                INSERT INTO messages (conversation_id, role, content, raw)
                VALUES ($1, 'system', $2, $3)
            `, [conversation_id, result.customerMessage, JSON.stringify({ type: 'handoff_initiated' })]);

            // Send to external channel
            const convResult = await query(`SELECT channel_type FROM conversations WHERE id = $1`, [conversation_id]);
            if (convResult.rows[0]?.channel_type !== 'web') {
                await sendToChannel(conversation_id, result.customerMessage);
            }

            // Emit socket event
            emitStatusChange(conversation_id, 'handoff_pending');
        }
    }

    console.log(`[Handoff] Initiated for ${conversation_id}, success: ${result.success}`);

    res.json(result);
}));

// ============================================
// POST /v1/internal/handoff-offer-response
// Handle customer response to handoff offer
// ============================================
router.post('/handoff-offer-response', asyncHandler(async (req, res) => {
    const { conversation_id, bot_id, accepted } = req.body;

    if (!conversation_id) {
        return res.status(400).json({ error: 'conversation_id is required' });
    }

    if (accepted) {
        // Customer accepted, initiate handoff
        const result = await handoffService.initiateHandoff({
            conversationId: conversation_id,
            botId: bot_id,
            triggerType: 'explicit',
            score: 100
        });
        res.json(result);
    } else {
        // Customer declined, continue with bot
        await query(`
            UPDATE conversations SET
                handoff_score = 0,
                handoff_signals = '[]'::jsonb,
                updated_at = now()
            WHERE id = $1
        `, [conversation_id]);

        res.json({
            success: true,
            action: 'continue_bot',
            message: 'Customer declined handoff, continuing with bot'
        });
    }
}));

// ============================================
// POST /v1/internal/set-pending-offer
// Set pending_handoff_offer flag on conversation
// Called by n8n after sending handoff offer message
// ============================================
router.post('/set-pending-offer', asyncHandler(async (req, res) => {
    const { conversation_id, pending } = req.body;

    if (!conversation_id) {
        return res.status(400).json({ error: 'conversation_id is required' });
    }

    const pendingValue = pending !== false; // default true

    await query(`
        UPDATE conversations SET
            pending_handoff_offer = $2,
            updated_at = now()
        WHERE id = $1
    `, [conversation_id, pendingValue]);

    console.log(`[Handoff] Set pending_handoff_offer=${pendingValue} for ${conversation_id}`);

    res.json({
        success: true,
        conversation_id,
        pending_handoff_offer: pendingValue
    });
}));

// ============================================
// GET /v1/internal/handoff-queue/:botId
// Get handoff queue for CS dashboard
// ============================================
router.get('/handoff-queue/:botId', asyncHandler(async (req, res) => {
    const queue = await handoffService.getHandoffQueue(req.params.botId, req.query.status || 'waiting');
    res.json({ queue });
}));

// ============================================
// POST /v1/internal/assign-agent
// Assign agent to handoff
// ============================================
router.post('/assign-agent', asyncHandler(async (req, res) => {
    const { handoff_id, agent_id, agent_name } = req.body;

    if (!handoff_id || !agent_id || !agent_name) {
        return res.status(400).json({ error: 'handoff_id, agent_id, and agent_name are required' });
    }

    const result = await handoffService.assignAgent(handoff_id, agent_id, agent_name);

    if (result.success && result.customerMessage) {
        // Send greeting to customer
        const convId = result.handoff.conversation_id;

        await query(`
            INSERT INTO messages (conversation_id, role, content, raw)
            VALUES ($1, 'agent', $2, $3)
        `, [convId, result.customerMessage, JSON.stringify({ agent_id, agent_name, type: 'handoff_greeting' })]);

        await sendToChannel(convId, result.customerMessage);
        emitStatusChange(convId, 'human_active');
        emitNewMessage(convId, { role: 'agent', content: result.customerMessage });
    }

    res.json(result);
}));

// ============================================
// POST /v1/internal/resolve-handoff
// Resolve handoff
// ============================================
router.post('/resolve-handoff', asyncHandler(async (req, res) => {
    const { handoff_id, resolution_notes, csat_score, csat_feedback } = req.body;

    if (!handoff_id) {
        return res.status(400).json({ error: 'handoff_id is required' });
    }

    const result = await handoffService.resolveHandoff(handoff_id, {
        resolutionNotes: resolution_notes,
        csatScore: csat_score,
        csatFeedback: csat_feedback
    });

    if (result.success) {
        emitStatusChange(result.handoff.conversation_id, 'resolved');
    }

    res.json(result);
}));

// ============================================
// POST /v1/internal/return-to-bot
// Return conversation from human to bot
// ============================================
router.post('/return-to-bot', asyncHandler(async (req, res) => {
    const { conversation_id, reason } = req.body;

    if (!conversation_id) {
        return res.status(400).json({ error: 'conversation_id is required' });
    }

    const result = await handoffService.returnToBot(conversation_id, reason);

    if (result.success) {
        emitStatusChange(conversation_id, 'bot_active');
    }

    res.json(result);
}));

// ============================================
// GET /v1/internal/cs-available/:botId
// Check if CS is available for handoff
// ============================================
router.get('/cs-available/:botId', asyncHandler(async (req, res) => {
    const available = await handoffService.isCSAvailable(req.params.botId);
    res.json({ available });
}));

// ============================================
// POST /v1/internal/log-event
// Log observability event
// ============================================
router.post('/log-event', asyncHandler(async (req, res) => {
    const {
        bot_id,
        conversation_id,
        event_type,
        question,
        answer,
        status,
        latency_ms,
        tokens_in,
        tokens_out,
        meta
    } = req.body;

    if (!bot_id || !event_type) {
        return res.status(400).json({ error: 'bot_id and event_type are required' });
    }

    await query(`
        INSERT INTO analytics_log (
            bot_id, conversation_id, event_type, question, answer,
            status, latency_ms, tokens_in, tokens_out, meta
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
        bot_id,
        conversation_id,
        event_type,
        question,
        answer,
        status,
        latency_ms,
        tokens_in,
        tokens_out,
        JSON.stringify(meta || {})
    ]);

    res.json({ success: true });
}));

// ============================================
// GET /v1/internal/analytics/:botId
// Get analytics summary for bot
// ============================================
router.get('/analytics/:botId', asyncHandler(async (req, res) => {
    const { botId } = req.params;
    const days = parseInt(req.query.days) || 7;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get message counts
    const messageStats = await query(`
        SELECT 
            COUNT(*) as total_messages,
            COUNT(*) FILTER (WHERE event_type = 'msg_received') as user_messages,
            COUNT(*) FILTER (WHERE event_type = 'answer_sent') as bot_responses,
            COUNT(*) FILTER (WHERE event_type = 'handoff') as handoffs,
            AVG(latency_ms) FILTER (WHERE event_type = 'answer_sent') as avg_latency
        FROM analytics_log
        WHERE bot_id = $1
        AND created_at >= $2
    `, [botId, startDate]);

    // Get daily breakdown
    const dailyStats = await query(`
        SELECT 
            DATE(created_at) as date,
            COUNT(*) FILTER (WHERE event_type = 'msg_received') as messages,
            COUNT(*) FILTER (WHERE event_type = 'handoff') as handoffs
        FROM analytics_log
        WHERE bot_id = $1
        AND created_at >= $2
        GROUP BY DATE(created_at)
        ORDER BY date
    `, [botId, startDate]);

    res.json({
        period: { days, startDate, endDate: new Date() },
        messages: messageStats.rows[0],
        daily: dailyStats.rows
    });
}));

// ============================================
// GET /v1/internal/bot-config/:botId
// Get bot configuration for n8n workflow
// Returns system prompt, RAG settings, LLM config
// ============================================
router.get('/bot-config/:botId', asyncHandler(async (req, res) => {
    const { botId } = req.params;

    const result = await query(`
        SELECT 
            id, name, system_prompt, 
            rag_top_k, rag_min_score,
            llm_provider, llm_model,
            embed_provider, embed_model,
            booking_link,
            handoff_enabled
        FROM bots 
        WHERE id = $1
    `, [botId]);

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    const bot = result.rows[0];

    res.json({
        bot_id: bot.id,
        name: bot.name,
        system_prompt: bot.system_prompt || '',
        rag_top_k: bot.rag_top_k || 6,
        rag_min_score: bot.rag_min_score || 0.5,
        llm_provider: bot.llm_provider || 'openai',
        llm_model: bot.llm_model || 'gpt-4o-mini',
        embed_provider: bot.embed_provider || 'openai',
        embed_model: bot.embed_model || 'text-embedding-3-small',
        booking_link: bot.booking_link || null,
        handoff_enabled: bot.handoff_enabled
    });
}));

module.exports = router;
