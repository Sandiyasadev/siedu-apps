/**
 * Handoff Service
 * Manages conversation handoff from bot to human agents
 *
 * ⚠️  PHASE 2 — NOT ACTIVE IN V1
 * V1 uses simple bot/human toggle in hooks.js.
 * This service implements advanced scoring, queue, and CS availability
 * for future use. Do NOT call from V1 n8n workflows.
 */

const { query, getClient } = require('../utils/db');
const cache = require('../utils/cache');
const { sendToChannel } = require('./channelService');

/**
 * Process handoff request
 * @param {Object} params
 * @param {string} params.conversationId - Conversation ID
 * @param {string} params.botId - Bot ID
 * @param {string} params.triggerType - explicit | scoring | manual
 * @param {number} params.score - Handoff score
 * @param {Array} params.signals - Triggered signals
 * @param {Object} params.context - Additional context
 * @returns {Object} Handoff result
 */
async function initiateHandoff(params) {
    const {
        conversationId,
        botId,
        triggerType = 'scoring',
        score = 0,
        signals = [],
        context = {}
    } = params;

    const client = await getClient();

    try {
        await client.query('BEGIN');

        // 1. Get conversation and recent messages
        const convResult = await client.query(`
            SELECT c.*, 
                   bc.channel_type, 
                   b.name as bot_name,
                   b.handoff_cs_hours_start,
                   b.handoff_cs_hours_end,
                   b.handoff_cs_days
            FROM conversations c
            JOIN bots b ON b.id = c.bot_id
            LEFT JOIN bot_channels bc ON bc.bot_id = c.bot_id AND bc.channel_type = c.channel_type
            WHERE c.id = $1
        `, [conversationId]);

        if (convResult.rows.length === 0) {
            throw new Error('Conversation not found');
        }

        const conversation = convResult.rows[0];

        // 2. Check if already in handoff
        if (conversation.handoff_status === 'handoff_pending' ||
            conversation.handoff_status === 'human_active') {
            return {
                success: false,
                reason: 'already_in_handoff',
                status: conversation.handoff_status
            };
        }

        // 3. Get recent messages for context
        const messagesResult = await client.query(`
            SELECT role, content, created_at
            FROM messages
            WHERE conversation_id = $1
            ORDER BY created_at DESC
            LIMIT 20
        `, [conversationId]);

        const recentMessages = messagesResult.rows.reverse();

        // 4. Generate summary and extract facts
        const summary = generateConversationSummary(recentMessages);
        const detectedFacts = extractFacts(recentMessages, context);
        const suggestedActions = generateSuggestedActions(signals, detectedFacts);

        // 5. Check CS availability
        const csAvailable = await isCSAvailable(botId);

        // 6. Calculate priority (higher score = higher priority)
        let priority = Math.min(100, score);
        // Boost priority for certain signals
        if (signals.some(s => s.signal === 'complaint')) priority += 10;
        if (signals.some(s => s.signal === 'refund_return')) priority += 15;
        priority = Math.min(100, priority);

        // 7. Create handoff queue entry
        const queueResult = await client.query(`
            INSERT INTO handoff_queue (
                conversation_id, bot_id, priority, handoff_score,
                trigger_type, trigger_signal, customer_name, customer_contact,
                channel_type, summary, detected_facts, suggested_actions,
                recent_messages, message_count, status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
            )
            RETURNING id, queue_position, estimated_wait_minutes
        `, [
            conversationId,
            botId,
            priority,
            score,
            triggerType,
            signals[0]?.signal || null,
            context.customerName || null,
            context.customerContact || null,
            conversation.channel_type,
            summary,
            JSON.stringify(detectedFacts),
            JSON.stringify(suggestedActions),
            JSON.stringify(recentMessages.slice(-10)),
            recentMessages.length,
            'waiting'
        ]);

        const queueEntry = queueResult.rows[0];

        // 8. Update conversation status
        await client.query(`
            UPDATE conversations SET
                handoff_status = 'handoff_pending',
                handoff_score = $2,
                handoff_signals = $3,
                handoff_summary = $4,
                handoff_detected_facts = $5,
                handoff_suggested_actions = $6,
                handoff_requested_at = now(),
                updated_at = now()
            WHERE id = $1
        `, [
            conversationId,
            score,
            JSON.stringify(signals),
            summary,
            JSON.stringify(detectedFacts),
            JSON.stringify(suggestedActions)
        ]);

        // 9. Log to handoff history
        await client.query(`
            INSERT INTO handoff_history (
                conversation_id, action, from_status, to_status,
                actor_type, reason, metadata
            ) VALUES ($1, 'requested', $2, 'handoff_pending', 'bot', $3, $4)
        `, [
            conversationId,
            conversation.handoff_status || 'bot_active',
            `Handoff triggered by ${triggerType} (score: ${score})`,
            JSON.stringify({ signals, trigger_type: triggerType })
        ]);

        await client.query('COMMIT');

        // 10. Prepare response message for customer
        let customerMessage;
        if (csAvailable) {
            customerMessage = generateHandoffMessage('initiated', {
                queuePosition: queueEntry.queue_position,
                estimatedWait: queueEntry.estimated_wait_minutes
            });
        } else {
            customerMessage = generateHandoffMessage('outside_hours', {
                csHoursStart: conversation.handoff_cs_hours_start,
                csHoursEnd: conversation.handoff_cs_hours_end,
                csDays: conversation.handoff_cs_days
            });
        }

        // 11. Invalidate any cached data
        await cache.del(`conversation:${conversationId}`);

        return {
            success: true,
            handoffId: queueEntry.id,
            queuePosition: queueEntry.queue_position,
            estimatedWait: queueEntry.estimated_wait_minutes,
            csAvailable,
            customerMessage,
            summary,
            detectedFacts,
            suggestedActions
        };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[HandoffService] Error initiating handoff:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Assign agent to handoff
 */
async function assignAgent(handoffId, agentId, agentName) {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        // Get handoff entry
        const result = await client.query(`
            UPDATE handoff_queue SET
                status = 'assigned',
                assigned_agent_id = $2,
                assigned_agent_name = $3,
                assigned_at = now(),
                updated_at = now()
            WHERE id = $1 AND status = 'waiting'
            RETURNING *
        `, [handoffId, agentId, agentName]);

        if (result.rows.length === 0) {
            throw new Error('Handoff not found or already assigned');
        }

        const handoff = result.rows[0];

        // Update conversation
        await client.query(`
            UPDATE conversations SET
                handoff_status = 'human_active',
                assigned_agent = $2,
                handoff_accepted_at = now(),
                updated_at = now()
            WHERE id = $1
        `, [handoff.conversation_id, agentName]);

        // Log history
        await client.query(`
            INSERT INTO handoff_history (
                conversation_id, action, from_status, to_status,
                actor_type, actor_id, actor_name
            ) VALUES ($1, 'assigned', 'handoff_pending', 'human_active', 'agent', $2, $3)
        `, [handoff.conversation_id, agentId, agentName]);

        await client.query('COMMIT');

        // Notify customer
        const customerMessage = `Halo Kak! 👋\n\nPerkenalkan, saya ${agentName} dari tim Customer Service.\nSaya sudah baca chat sebelumnya. Langsung saya bantu ya! 😊`;

        return {
            success: true,
            handoff,
            customerMessage
        };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[HandoffService] Error assigning agent:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Resolve handoff
 */
async function resolveHandoff(handoffId, resolution) {
    const {
        resolutionNotes,
        csatScore,
        csatFeedback
    } = resolution;

    const client = await getClient();

    try {
        await client.query('BEGIN');

        const result = await client.query(`
            UPDATE handoff_queue SET
                status = 'resolved',
                resolution_notes = $2,
                csat_score = $3,
                csat_feedback = $4,
                resolved_at = now(),
                updated_at = now()
            WHERE id = $1
            RETURNING *
        `, [handoffId, resolutionNotes, csatScore, csatFeedback]);

        if (result.rows.length === 0) {
            throw new Error('Handoff not found');
        }

        const handoff = result.rows[0];

        // Update conversation
        await client.query(`
            UPDATE conversations SET
                handoff_status = 'resolved',
                handoff_resolved_at = now(),
                status = 'closed',
                updated_at = now()
            WHERE id = $1
        `, [handoff.conversation_id]);

        // Log history
        await client.query(`
            INSERT INTO handoff_history (
                conversation_id, action, from_status, to_status,
                actor_type, actor_id, actor_name, reason
            ) VALUES ($1, 'resolved', 'human_active', 'resolved', 'agent', $2, $3, $4)
        `, [
            handoff.conversation_id,
            handoff.assigned_agent_id,
            handoff.assigned_agent_name,
            resolutionNotes
        ]);

        await client.query('COMMIT');

        return { success: true, handoff };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Return conversation to bot
 */
async function returnToBot(conversationId, reason = 'Customer request') {
    const result = await query(`
        UPDATE conversations SET
            handoff_status = 'bot_active',
            assigned_agent = NULL,
            updated_at = now()
        WHERE id = $1
        RETURNING *
    `, [conversationId]);

    // Update queue entry if exists
    await query(`
        UPDATE handoff_queue SET
            status = 'cancelled',
            resolution_notes = $2,
            updated_at = now()
        WHERE conversation_id = $1 AND status IN ('waiting', 'assigned')
    `, [conversationId, reason]);

    // Log
    await query(`
        INSERT INTO handoff_history (
            conversation_id, action, to_status, actor_type, reason
        ) VALUES ($1, 'returned_to_bot', 'bot_active', 'system', $2)
    `, [conversationId, reason]);

    return { success: true };
}

/**
 * Get handoff queue for a bot
 */
async function getHandoffQueue(botId, status = 'waiting') {
    const result = await query(`
        SELECT * FROM v_active_handoff_queue
        WHERE bot_id = $1 AND ($2 = 'all' OR status = $2)
        ORDER BY priority DESC, created_at ASC
    `, [botId, status]);

    return result.rows;
}

/**
 * Check if CS is available
 */
async function isCSAvailable(botId) {
    const result = await query(`
        SELECT is_cs_available($1) as available
    `, [botId]);

    return result.rows[0]?.available || false;
}

/**
 * Generate conversation summary for CS
 */
function generateConversationSummary(messages) {
    if (!messages || messages.length === 0) {
        return 'Tidak ada pesan sebelumnya.';
    }

    // Extract key points from conversation
    const userMessages = messages.filter(m => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';

    // Simple summary - in production, use LLM for better summarization
    const topics = [];

    // Detect topics mentioned
    if (/harga|price|biaya|berapa/i.test(lastUserMessage)) topics.push('pertanyaan harga');
    if (/produk|barang|item/i.test(lastUserMessage)) topics.push('informasi produk');
    if (/order|pesan|beli/i.test(lastUserMessage)) topics.push('pemesanan');
    if (/komplain|masalah|issue/i.test(lastUserMessage)) topics.push('keluhan');
    if (/refund|return|tukar/i.test(lastUserMessage)) topics.push('refund/return');

    const topicStr = topics.length > 0 ? topics.join(', ') : 'pertanyaan umum';

    return `Customer menghubungi terkait ${topicStr}. Total ${messages.length} pesan. Pesan terakhir: "${lastUserMessage.substring(0, 100)}..."`;
}

/**
 * Extract facts from conversation
 */
function extractFacts(messages, context = {}) {
    const facts = [];

    // From context
    if (context.customerName) {
        facts.push({ type: 'customer_name', value: context.customerName });
    }
    if (context.orderId) {
        facts.push({ type: 'order_id', value: context.orderId });
    }

    // Extract from messages
    const allText = messages.map(m => m.content).join(' ');

    // Order ID patterns
    const orderMatch = allText.match(/(?:order|pesanan|no\.?|nomor)\s*(?:id|#|:)?\s*([A-Z0-9-]+)/i);
    if (orderMatch) {
        facts.push({ type: 'order_id', value: orderMatch[1] });
    }

    // Phone number
    const phoneMatch = allText.match(/(?:\+62|62|0)8[0-9]{8,11}/);
    if (phoneMatch) {
        facts.push({ type: 'phone', value: phoneMatch[0] });
    }

    // Email
    const emailMatch = allText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
        facts.push({ type: 'email', value: emailMatch[0] });
    }

    // Product mentions
    const products = ['kaos premium', 'kemeja formal', 'jaket hoodie'];
    for (const product of products) {
        if (allText.toLowerCase().includes(product)) {
            facts.push({ type: 'product', value: product });
        }
    }

    return facts;
}

/**
 * Generate suggested actions for CS
 */
function generateSuggestedActions(signals, facts) {
    const actions = [];

    // Based on signals
    for (const signal of signals) {
        switch (signal.signal) {
            case 'refund_return':
                actions.push({
                    action: 'Check refund policy',
                    reason: 'Customer mentioned refund/return'
                });
                break;
            case 'complaint':
                actions.push({
                    action: 'Apologize and acknowledge issue',
                    reason: 'Customer is complaining'
                });
                break;
            case 'order_issue':
                actions.push({
                    action: 'Check order status in system',
                    reason: 'Order-related issue detected'
                });
                break;
            case 'looping_question':
                actions.push({
                    action: 'Provide clear step-by-step answer',
                    reason: 'Customer has asked similar question multiple times'
                });
                break;
        }
    }

    // Based on facts
    for (const fact of facts) {
        if (fact.type === 'order_id') {
            actions.push({
                action: `Lookup order ${fact.value}`,
                reason: 'Order ID was mentioned'
            });
        }
    }

    // Default action if none
    if (actions.length === 0) {
        actions.push({
            action: 'Review chat history and respond appropriately',
            reason: 'General inquiry'
        });
    }

    return actions;
}

/**
 * Generate handoff message for customer
 */
function generateHandoffMessage(type, params = {}) {
    switch (type) {
        case 'initiated':
            return `Siap Kak! 👍 Aku sudah hubungkan ke tim CS kami ya.\n\n📍 Status: Menunggu CS tersedia\n📍 Posisi antrian: #${params.queuePosition || 1}\n⏰ Estimasi tunggu: ${params.estimatedWait || 3} menit\n\nSambil menunggu, Kakak bisa lanjut ceritain detail masalahnya di sini ya. Tim CS akan baca history chat ini kok 😊`;

        case 'outside_hours':
            const days = (params.csDays || ['mon', 'tue', 'wed', 'thu', 'fri'])
                .map(d => ({ mon: 'Senin', tue: 'Selasa', wed: 'Rabu', thu: 'Kamis', fri: 'Jumat', sat: 'Sabtu', sun: 'Minggu' }[d]))
                .join(', ');
            return `Halo Kak! 🙏 Saat ini tim CS kami sedang offline.\n\n📍 Jam operasional: ${params.csHoursStart || '09:00'} - ${params.csHoursEnd || '18:00'} WIB\n📍 Hari: ${days}\n\nPesan Kakak sudah kami catat dan akan direspons ASAP saat CS online ya! 😊`;

        case 'offer':
            return `Sepertinya pertanyaan Kakak butuh penanganan lebih detail nih 🙏\nMau aku hubungkan ke tim CS kami? Mereka bisa bantu lebih lanjut!\n\nKetik "ya" untuk dihubungkan, atau lanjut chat sama aku juga boleh 😊`;

        case 'assigned':
            return `Halo Kak! 👋\n\nPerkenalkan, saya ${params.agentName} dari tim Customer Service.\nSaya sudah baca chat sebelumnya. Langsung saya bantu ya! 😊`;

        default:
            return 'Tim CS kami akan segera merespons. Terima kasih kesabarannya! 🙏';
    }
}

/**
 * Get handoff statistics
 */
async function getHandoffStats(botId, startDate, endDate) {
    const result = await query(`
        SELECT 
            COUNT(*) as total_handoffs,
            COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
            COUNT(*) FILTER (WHERE status = 'abandoned') as abandoned,
            AVG(EXTRACT(EPOCH FROM (assigned_at - created_at))) as avg_wait_seconds,
            AVG(EXTRACT(EPOCH FROM (resolved_at - assigned_at))) as avg_resolution_seconds,
            AVG(csat_score) as avg_csat
        FROM handoff_queue
        WHERE bot_id = $1
        AND created_at BETWEEN $2 AND $3
    `, [botId, startDate, endDate]);

    return result.rows[0];
}

module.exports = {
    initiateHandoff,
    assignAgent,
    resolveHandoff,
    returnToBot,
    getHandoffQueue,
    isCSAvailable,
    generateHandoffMessage,
    getHandoffStats,
    generateConversationSummary,
    extractFacts,
    generateSuggestedActions
};
