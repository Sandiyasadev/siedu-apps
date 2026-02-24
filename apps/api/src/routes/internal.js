const express = require('express');
const router = express.Router();
const { query } = require('../utils/db');
const { getOrSet, delByPattern } = require('../utils/cache');
const asyncHandler = require('../middleware/asyncHandler');
const { emitNewMessage, emitStatusChange } = require('../services/socketService');
const { sendToChannel } = require('../services/channelService');
const handoffService = require('../services/handoffService');
const { safeCompare } = require('../utils/crypto');

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

    if (!safeCompare(token, expectedKey)) {
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

    // Resolve workspaceId for socket broadcast
    const convLookup = await query(
        'SELECT b.workspace_id FROM conversations c JOIN bots b ON b.id = c.bot_id WHERE c.id = $1',
        [conversation_id]
    );
    const workspaceId = convLookup.rows[0]?.workspace_id || null;

    // Emit socket event
    emitStatusChange(conversation_id, status, workspaceId);

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
            // Resolve workspaceId for socket broadcast
            const wsLookup = await query(
                'SELECT b.workspace_id FROM conversations c JOIN bots b ON b.id = c.bot_id WHERE c.id = $1',
                [conversation_id]
            );
            emitStatusChange(conversation_id, 'handoff_pending', wsLookup.rows[0]?.workspace_id || null);
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

        // Resolve workspaceId for socket broadcast
        const wsLookup = await query(
            'SELECT b.workspace_id FROM conversations c JOIN bots b ON b.id = c.bot_id WHERE c.id = $1',
            [convId]
        );
        const wsId = wsLookup.rows[0]?.workspace_id || null;
        emitStatusChange(convId, 'human_active', wsId);
        emitNewMessage(convId, { role: 'agent', content: result.customerMessage }, wsId);
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
        // Resolve workspaceId for socket broadcast
        const wsLookup = await query(
            'SELECT b.workspace_id FROM conversations c JOIN bots b ON b.id = c.bot_id WHERE c.id = $1',
            [result.handoff.conversation_id]
        );
        emitStatusChange(result.handoff.conversation_id, 'resolved', wsLookup.rows[0]?.workspace_id || null);
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
        // Resolve workspaceId for socket broadcast
        const wsLookup = await query(
            'SELECT b.workspace_id FROM conversations c JOIN bots b ON b.id = c.bot_id WHERE c.id = $1',
            [conversation_id]
        );
        emitStatusChange(conversation_id, 'bot_active', wsLookup.rows[0]?.workspace_id || null);
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

const parsePositiveInt = (value, fallback) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const INTERNAL_BOT_CONFIG_CACHE_TTL = parsePositiveInt(process.env.INTERNAL_BOT_CONFIG_CACHE_TTL, 300);
const INTERNAL_TEMPLATE_CACHE_TTL = parsePositiveInt(process.env.INTERNAL_TEMPLATE_CACHE_TTL, 60);
const INTERNAL_TEMPLATE_TAXONOMY_CACHE_TTL = parsePositiveInt(process.env.INTERNAL_TEMPLATE_TAXONOMY_CACHE_TTL, 60);
const CONTACT_CONTINUATION_WINDOW_MINUTES = parsePositiveInt(process.env.CONTACT_CONTINUATION_WINDOW_MINUTES, 15);
const CONTACT_RETURNING_THRESHOLD_MINUTES = parsePositiveInt(process.env.CONTACT_RETURNING_THRESHOLD_MINUTES, 24 * 60);

const toWIB = (d) => new Date(new Date(d).getTime() + 7 * 3600000);

const fmtTimeWIB = (d) => {
    const w = toWIB(d);
    return w.toISOString().slice(11, 16).replace(':', '.'); // "14.30"
};

const fmtDateWIB = (d) => {
    const w = toWIB(d);
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${days[w.getUTCDay()]}, ${w.getUTCDate()} ${months[w.getUTCMonth()]} ${w.getUTCFullYear()}`;
};

const formatGapHuman = (minutes) => {
    if (!Number.isFinite(minutes) || minutes < 0) return 'belum ada riwayat';
    if (minutes < 60) return `${minutes} menit`;
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    if (rem === 0) return `${hours} jam`;
    return `${hours} jam ${rem} menit`;
};

const getCurrentGreetingWord = (now = new Date()) => {
    const nowWIB = toWIB(now);
    const hourWIB = nowWIB.getUTCHours();
    let greeting = 'Selamat pagi';
    if (hourWIB >= 11 && hourWIB < 15) greeting = 'Selamat siang';
    if (hourWIB >= 15 && hourWIB < 18) greeting = 'Selamat sore';
    if (hourWIB >= 18 || hourWIB < 4) greeting = 'Selamat malam';
    return greeting;
};

async function fetchBotConfigData(botId) {
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
        const err = new Error('Bot not found');
        err.status = 404;
        throw err;
    }

    const bot = result.rows[0];
    return {
        bot_id: bot.id,
        name: bot.name,
        system_prompt: bot.system_prompt || '',
        rag_top_k: bot.rag_top_k || 6,
        rag_min_score: bot.rag_min_score || 0.5,
        llm_provider: bot.llm_provider || 'openai',
        llm_model: bot.llm_model || 'gpt-4o-mini',
        embed_provider: bot.embed_provider || 'aws_bedrock',
        embed_model: bot.embed_model || 'amazon.titan-embed-text-v2:0',
        booking_link: bot.booking_link || null,
        handoff_enabled: bot.handoff_enabled
    };
}

async function fetchBotConfigCached(botId) {
    return getOrSet(
        `internal:bot-config:${botId}`,
        () => fetchBotConfigData(botId),
        INTERNAL_BOT_CONFIG_CACHE_TTL
    );
}

async function buildChatHistoryPayload(conversationId, limitInput) {
    const limit = Math.min(parsePositiveInt(limitInput, 10), 20);
    const now = new Date();

    const [messageResult, userHistoryResult] = await Promise.all([
        query(
            `SELECT role, content, created_at
             FROM messages
             WHERE conversation_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [conversationId, limit]
        ),
        query(
            `SELECT created_at
             FROM messages
             WHERE conversation_id = $1 AND role = 'user'
             ORDER BY created_at DESC
             LIMIT 2`,
            [conversationId]
        )
    ]);

    const messages = messageResult.rows.reverse(); // chronological
    const count = messages.length;

    // userHistoryResult is DESC order: [current_user_msg, previous_user_msg]
    const currentUserMessageAt = userHistoryResult.rows[0]?.created_at
        ? new Date(userHistoryResult.rows[0].created_at)
        : null;
    const previousUserMessageAt = userHistoryResult.rows[1]?.created_at
        ? new Date(userHistoryResult.rows[1].created_at)
        : null;

    // "new" means this is the first user message in the conversation.
    const isNew = userHistoryResult.rows.length <= 1;

    let gapMinutes = null;
    let gapHours = null;
    let isSameDay = false;

    if (currentUserMessageAt && previousUserMessageAt) {
        gapMinutes = Math.max(0, Math.round((currentUserMessageAt - previousUserMessageAt) / 60000));
        gapHours = Math.round(gapMinutes / 60);

        const currentWIB = toWIB(currentUserMessageAt).toISOString().slice(0, 10);
        const previousWIB = toWIB(previousUserMessageAt).toISOString().slice(0, 10);
        isSameDay = currentWIB === previousWIB;
    }

    const isContinuation = !isNew && gapMinutes !== null && gapMinutes <= CONTACT_CONTINUATION_WINDOW_MINUTES;
    const isReturning = !isNew && gapMinutes !== null && gapMinutes >= CONTACT_RETURNING_THRESHOLD_MINUTES;

    let conversationMode = 'resume';
    if (isNew) conversationMode = 'new';
    else if (isContinuation) conversationMode = 'continuation';
    else if (isReturning) conversationMode = 'returning';

    let forcedIntent = null;
    let forcedIntentReason = null;
    if (conversationMode === 'new') {
        forcedIntent = 'engagement.greeting_new';
        forcedIntentReason = 'new_contact';
    } else if (conversationMode === 'returning') {
        forcedIntent = 'engagement.greeting_return';
        forcedIntentReason = 'inactive_threshold_reached';
    }

    const greeting = getCurrentGreetingWord(now);
    const timeContext = `${fmtDateWIB(now)} pukul ${fmtTimeWIB(now)} WIB`;

    let promptInstruction = '';
    if (conversationMode === 'new') {
        promptInstruction = `Ini adalah KONTAK BARU (pesan user pertama). Gunakan sapaan: "${greeting}! 👋"`;
    } else if (conversationMode === 'returning') {
        promptInstruction = `Kontak KEMBALI setelah ${formatGapHuman(gapMinutes)} tidak aktif. Gunakan sapaan hangat: "${greeting}! Senang bisa chat lagi 😊"`;
    } else if (conversationMode === 'continuation') {
        promptInstruction = `Kontak masih lanjut percakapan (jarak antar pesan user ${formatGapHuman(gapMinutes)}). Lanjutkan secara natural TANPA sapaan ulang.`;
    } else if (isSameDay) {
        promptInstruction = `Kontak masih chat di hari yang sama (jarak antar pesan user ${formatGapHuman(gapMinutes)}). Lanjutkan percakapan secara natural tanpa sapaan ulang.`;
    } else {
        promptInstruction = `Kontak terakhir chat ${formatGapHuman(gapMinutes)} lalu. Lanjutkan percakapan secara natural (sapaan ulang opsional sesuai konteks).`;
    }

    const historyLines = messages.map(m => {
        const role = m.role === 'user' ? 'User' : 'Assistant';
        return `[${fmtTimeWIB(m.created_at)} WIB] ${role}: ${m.content}`;
    });

    return {
        messages,
        history_text: historyLines.join('\n'),
        time_context: timeContext,
        greeting_word: greeting,
        contact_status: {
            isNew,
            isContinuation,
            isReturning,
            isSameDay,
            conversationMode,
            gapMinutes,
            gapHours,
            lastMessageAt: previousUserMessageAt, // previous user message, basis mode detection
            currentUserMessageAt,
            previousUserMessageAt,
            forcedIntent,
            forcedIntentReason,
            messageCount: count,
            continuationWindowMinutes: CONTACT_CONTINUATION_WINDOW_MINUTES,
            returningThresholdMinutes: CONTACT_RETURNING_THRESHOLD_MINUTES,
            promptInstruction
        }
    };
}

// ============================================
// GET /v1/internal/bot-config/:botId
// Get bot configuration for n8n workflow
// Returns system prompt, RAG settings, LLM config
// ============================================
router.get('/bot-config/:botId', asyncHandler(async (req, res) => {
    const { botId } = req.params;
    const botConfig = await fetchBotConfigCached(botId);
    res.json(botConfig);
}));

// ============================================
// GET /v1/internal/responder-context/:conversationId
// Optimized context endpoint for responder workflow (parallel backend fetch)
// Combines bot-config + chat-history in one request to reduce n8n latency
// ============================================
router.get('/responder-context/:conversationId', asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { bot_id } = req.query;
    const limit = req.query.limit;

    if (!bot_id) {
        return res.status(400).json({ error: 'bot_id query parameter is required' });
    }

    const [config, history] = await Promise.all([
        fetchBotConfigCached(bot_id),
        buildChatHistoryPayload(conversationId, limit)
    ]);

    res.json({ config, history });
}));

// ============================================
// PATCH /v1/internal/kb-status
// Update KB source status after n8n ingestion
// ============================================
router.patch('/kb-status', asyncHandler(async (req, res) => {
    const { source_id, status, chunk_count, error_message } = req.body;

    if (!source_id || !status) {
        return res.status(400).json({ error: 'source_id and status are required' });
    }

    const validStatuses = ['processing', 'indexed', 'error', 'deleted'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Use: ${validStatuses.join(', ')}` });
    }

    const updates = ['status = $1'];
    const params = [status, source_id];
    let paramIdx = 3;

    if (status === 'indexed') {
        updates.push(`indexed_at = NOW()`);
        if (chunk_count !== undefined) {
            updates.push(`chunk_count = $${paramIdx++}`);
            params.splice(paramIdx - 2, 0, chunk_count);
        }
    }

    if (status === 'error' && error_message) {
        updates.push(`error_message = $${paramIdx++}`);
        params.splice(paramIdx - 2, 0, error_message);
    }

    updates.push('updated_at = NOW()');

    const result = await query(
        `UPDATE kb_sources SET ${updates.join(', ')} WHERE id = $2 RETURNING *`,
        params
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'KB source not found' });
    }

    console.log(`[KB] Status updated: ${source_id} → ${status}`);
    res.json({ success: true, source: result.rows[0] });
}));

// ============================================
// GET /v1/internal/kb-file/:sourceId
// Stream KB file from MinIO for n8n to download
// ============================================
router.get('/kb-file/:sourceId', asyncHandler(async (req, res) => {
    const { getFileStream, getFileStat } = require('../utils/storage');
    const mime = require('mime-types');

    const sourceResult = await query(
        'SELECT object_key, original_filename, content_type FROM kb_sources WHERE id = $1',
        [req.params.sourceId]
    );

    if (sourceResult.rows.length === 0) {
        return res.status(404).json({ error: 'KB source not found' });
    }

    const source = sourceResult.rows[0];

    try {
        const stat = await getFileStat(source.object_key);
        const contentType = source.content_type || mime.lookup(source.original_filename) || 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `attachment; filename="${source.original_filename}"`);

        const stream = await getFileStream(source.object_key);
        stream.pipe(res);
    } catch (error) {
        console.error(`[KB] Failed to stream file ${source.object_key}:`, error.message);
        res.status(404).json({ error: 'File not found in storage' });
    }
}));

// ============================================
// GET /v1/internal/template-taxonomy/:botId
// n8n fetches active template taxonomy (category + subcategory metadata)
// ============================================
router.get('/template-taxonomy/:botId', asyncHandler(async (req, res) => {
    const { botId } = req.params;
    const includeInactive = ['1', 'true', 'yes'].includes(String(req.query.include_inactive || '').toLowerCase());

    const payload = await getOrSet(
        `internal:template-taxonomy:${botId}:all:${includeInactive ? '1' : '0'}`,
        async () => {
            let categoriesResult;
            let subcategoriesResult;
            try {
                categoriesResult = await query(
                    `
                    SELECT id, bot_id, key, label, description, sort_order, is_active, created_at, updated_at
                    FROM template_categories
                    WHERE bot_id = $1
                      AND ($2::boolean = true OR is_active = true)
                    ORDER BY sort_order ASC, label ASC, key ASC
                    `,
                    [botId, includeInactive]
                );

                subcategoriesResult = await query(
                    `
                    SELECT
                        s.id, s.bot_id, s.category_key, s.key, s.label, s.description,
                        s.reply_mode, s.greeting_policy, s.default_template_count,
                        s.strategy_pool, s.sort_order, s.is_active, s.created_at, s.updated_at,
                        COALESCE(c.is_active, true) AS parent_category_is_active
                    FROM template_subcategories s
                    LEFT JOIN template_categories c
                      ON c.bot_id = s.bot_id AND c.key = s.category_key
                    WHERE s.bot_id = $1
                      AND ($2::boolean = true OR (s.is_active = true AND COALESCE(c.is_active, true) = true))
                    ORDER BY s.category_key ASC, s.sort_order ASC, s.label ASC, s.key ASC
                    `,
                    [botId, includeInactive]
                );
            } catch (error) {
                if (error.code !== '42P01') throw error;
                return {
                    bot_id: botId,
                    include_inactive: includeInactive,
                    categories: [],
                    subcategories: [],
                    intents: [],
                    grouped: [],
                    migration_required: 'v3_template_taxonomy.sql'
                };
            }

            const categories = categoriesResult.rows;
            const subcategories = subcategoriesResult.rows.map((row) => ({
                ...row,
                effective_is_active: !!(row.is_active && row.parent_category_is_active)
            }));
            const grouped = categories.map((category) => ({
                ...category,
                subcategories: subcategories.filter((sub) => sub.category_key === category.key)
            }));

            return {
                bot_id: botId,
                include_inactive: includeInactive,
                categories,
                subcategories,
                intents: subcategories.map((sub) => ({
                    key: sub.key,
                    category_key: sub.category_key,
                    label: sub.label,
                    description: sub.description,
                    reply_mode: sub.reply_mode,
                    greeting_policy: sub.greeting_policy,
                    default_template_count: sub.default_template_count,
                    strategy_pool: sub.strategy_pool,
                    is_active: sub.effective_is_active
                })),
                grouped
            };
        },
        INTERNAL_TEMPLATE_TAXONOMY_CACHE_TTL
    );

    res.json(payload);
}));

// ============================================
// GET /v1/internal/bot-templates/:botId
// n8n fetches templates for a bot
// Optional: ?sub_category=evaluation.objection_price
// Optional: ?category=objection (legacy, broad filter)
// ============================================
router.get('/bot-templates/:botId', asyncHandler(async (req, res) => {
    const { botId } = req.params;
    const { sub_category, category } = req.query;

    const templatesPayload = await getOrSet(
        `internal:bot-templates:${botId}:sub:${sub_category || ''}:cat:${category || ''}`,
        async () => {
            let result;
            try {
                result = await query(
                    `SELECT t.id, t.name, t.content, t.category, t.sub_category, t.shortcut
                     FROM templates t
                     LEFT JOIN template_subcategories ts
                       ON ts.bot_id = t.bot_id AND ts.key = t.sub_category
                     LEFT JOIN template_categories tsc
                       ON tsc.bot_id = ts.bot_id AND tsc.key = ts.category_key
                     LEFT JOIN template_categories tc
                       ON tc.bot_id = t.bot_id AND tc.key = t.category
                     WHERE t.bot_id = $1
                       AND t.is_active = true
                       AND ($2::text IS NULL OR t.sub_category = $2)
                       AND ($3::text IS NULL OR t.category = $3)
                       AND (
                         t.sub_category IS NULL
                         OR ts.id IS NULL
                         OR (ts.is_active = true AND COALESCE(tsc.is_active, true) = true)
                       )
                       AND (
                         tc.id IS NULL
                         OR tc.is_active = true
                       )
                     ORDER BY t.use_count DESC
                     LIMIT 3`,
                    [botId, sub_category || null, category || null]
                );
            } catch (error) {
                if (error.code !== '42P01') throw error;
                result = await query(
                    `SELECT id, name, content, category, sub_category, shortcut
                     FROM templates
                     WHERE bot_id = $1
                       AND is_active = true
                       AND ($2::text IS NULL OR sub_category = $2)
                       AND ($3::text IS NULL OR category = $3)
                     ORDER BY use_count DESC
                     LIMIT 3`,
                    [botId, sub_category || null, category || null]
                );
            }

            return { templates: result.rows, intent: sub_category || category || 'all' };
        },
        INTERNAL_TEMPLATE_CACHE_TTL
    );

    res.json(templatesPayload);
}));

// ============================================
// POST /v1/internal/templates/bulk
// n8n bulk-inserts generated templates for a bot
// ============================================
router.post('/templates/bulk', asyncHandler(async (req, res) => {
    const { bot_id, templates } = req.body;

    if (!bot_id || !Array.isArray(templates) || templates.length === 0) {
        return res.status(400).json({ error: 'bot_id and templates array are required' });
    }

    // Verify bot exists
    const botCheck = await query('SELECT id FROM bots WHERE id = $1', [bot_id]);
    if (botCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    let created = 0;
    const errors = [];

    for (const t of templates) {
        if (!t.name || !t.content) {
            errors.push(`Skipped: missing name or content`);
            continue;
        }
        try {
            const subCategory = typeof t.sub_category === 'string'
                ? (t.sub_category.trim() || null)
                : (t.sub_category ?? null);
            await query(
                `INSERT INTO templates (bot_id, name, content, category, sub_category, shortcut)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [bot_id, t.name, t.content, t.category || 'general', subCategory, t.shortcut || null]
            );
            created++;
        } catch (err) {
            errors.push(`Failed "${t.name}": ${err.message}`);
        }
    }

    // Invalidate n8n responder template/taxonomy cache (best effort)
    await delByPattern(`internal:bot-templates:${bot_id}:*`);
    await delByPattern(`internal:template-taxonomy:${bot_id}:*`);

    res.json({ created, total: templates.length, errors });
}));

// ============================================
// GET /v1/internal/chat-history/:conversationId
// n8n fetches chat history with timestamps & contact status
// Replaces n8n Load Memory + Format History + Check Contact Status
// ============================================
router.get('/chat-history/:conversationId', asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const payload = await buildChatHistoryPayload(conversationId, req.query.limit);
    res.json(payload);
}));

module.exports = router;
