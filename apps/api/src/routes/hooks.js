const express = require('express');
const crypto = require('crypto');
const { query } = require('../utils/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { webhookLimiter } = require('../middleware/rateLimiter');
const { findOrCreateContact, linkConversationToContact } = require('../services/contactService');
const { emitNewMessage, emitNewConversation, emitMessageStatus } = require('../services/socketService');
const { downloadAndStoreMedia, downloadTelegramMedia, extractMediaInfo, buildMediaContent } = require('../services/mediaService');

const router = express.Router();

// Apply rate limiter to all webhook routes
router.use(webhookLimiter);

// ============================================
// V1 Handoff Gatekeeper
// Determines if message should be forwarded to n8n or skipped
// ============================================
const HANDOFF_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_UNANSWERED = 3;

async function shouldForwardToN8n(conversationId) {
    const result = await query(
        `SELECT status, last_agent_reply_at, unanswered_count 
         FROM conversations WHERE id = $1`,
        [conversationId]
    );
    const conv = result.rows[0];
    if (!conv || conv.status === 'bot') return true;

    // Status is 'human' — check timeout conditions
    const timeSinceAgent = conv.last_agent_reply_at
        ? Date.now() - new Date(conv.last_agent_reply_at).getTime()
        : Infinity;

    if (timeSinceAgent > HANDOFF_TIMEOUT_MS || (conv.unanswered_count || 0) >= MAX_UNANSWERED) {
        // Auto-revert to bot
        await query(
            `UPDATE conversations 
             SET status = 'bot', unanswered_count = 0 
             WHERE id = $1`,
            [conversationId]
        );
        console.log(`[Handoff] Auto-reverted conv ${conversationId} to bot (timeout: ${timeSinceAgent > HANDOFF_TIMEOUT_MS}, unanswered: ${(conv.unanswered_count || 0) >= MAX_UNANSWERED})`);
        return true;
    }

    // Still in human mode, increment unanswered count
    await query(
        `UPDATE conversations 
         SET unanswered_count = COALESCE(unanswered_count, 0) + 1 
         WHERE id = $1`,
        [conversationId]
    );
    console.log(`[Handoff] Conv ${conversationId} in human mode, unanswered: ${(conv.unanswered_count || 0) + 1}`);
    return false;
}




// Verify Telegram webhook using X-Telegram-Bot-Api-Secret-Token header
const verifyTelegramWebhook = async (req) => {
    const secretToken = req.headers['x-telegram-bot-api-secret-token'];
    const botPublicId = req.params.bot_public_id;

    console.log('[Telegram] Incoming webhook request:');
    console.log('[Telegram] - Public ID:', botPublicId);

    if (!botPublicId) {
        console.log('[Telegram] - FAIL: No public ID');
        return null;
    }

    // Get channel by public_id
    const result = await query(
        `SELECT bc.*, b.id as bot_id, b.workspace_id, b.n8n_config
         FROM bot_channels bc
         JOIN bots b ON bc.bot_id = b.id
         WHERE bc.channel_type = 'telegram' AND bc.public_id = $1 AND bc.is_enabled = true`,
        [botPublicId]
    );

    if (result.rows.length === 0) {
        console.log('[Telegram] - FAIL: Channel not found or disabled');
        return null;
    }

    const channel = result.rows[0];

    // Secret token is REQUIRED — reject if missing
    if (!secretToken) {
        console.log('[Telegram] - FAIL: Missing secret token header');
        return null;
    }

    // Verify it matches our stored secret
    if (secretToken !== channel.secret) {
        console.log('[Telegram] - FAIL: Secret token mismatch');
        return null;
    }

    console.log('[Telegram] - SUCCESS: Verification passed');
    return channel;
};

// POST /v1/hooks/telegram/:bot_public_id - Telegram webhook
router.post('/telegram/:bot_public_id', asyncHandler(async (req, res) => {
    console.log('[Telegram] ========= NEW WEBHOOK REQUEST =========');
    const channel = await verifyTelegramWebhook(req);

    if (!channel) {
        return res.status(401).json({ error: 'Invalid channel or secret token' });
    }

    const { message, callback_query } = req.body;

    // Handle regular messages
    const msgData = message || callback_query?.message;
    const chatId = msgData?.chat?.id;
    const fromUser = message?.from || callback_query?.from;

    if (!chatId) {
        return res.status(200).json({ status: 'skipped' });
    }

    // Extract text and/or media from the Telegram message
    let text = message?.text || message?.caption || callback_query?.data || null;
    let content = null;
    let mediaResult = null;
    const botToken = channel.config?.bot_token;

    // Detect media in message
    const telegramMedia = extractTelegramMedia(message);

    if (telegramMedia && botToken) {
        // Download and store media
        mediaResult = await downloadTelegramMedia(
            telegramMedia.fileId,
            telegramMedia.mediaType,
            botToken,
            {
                filename: telegramMedia.filename || null,
                caption: text || null,
                mimeType: telegramMedia.mimeType || null
            }
        );

        if (mediaResult) {
            content = buildMediaContent(telegramMedia.mediaType, mediaResult.objectKey, mediaResult.caption);
        } else {
            // Download failed - save placeholder
            content = `[${telegramMedia.mediaType.toUpperCase()}] (gagal diunduh)`;
        }
    } else if (text) {
        content = text;
    }

    if (!content) {
        console.log('[Telegram] - Skipping: no text or media');
        return res.status(200).json({ status: 'skipped' });
    }

    const previewText = content.startsWith('media::')
        ? `[${telegramMedia?.mediaType?.toUpperCase() || 'MEDIA'}]${text ? ' ' + text : ''}`
        : content;

    console.log(`[Telegram] - Message from ${chatId}: ${previewText.substring(0, 100)}`);

    // Find or create contact
    const contact = await findOrCreateContact({
        workspaceId: channel.workspace_id,
        externalId: chatId.toString(),
        channelType: 'telegram',
        userData: fromUser
    });

    // Upsert conversation
    const conversationResult = await query(
        `INSERT INTO conversations (bot_id, channel_type, external_thread_id, contact_id, last_user_at, unread_count)
         VALUES ($1, 'telegram', $2, $3, NOW(), 1)
         ON CONFLICT (bot_id, channel_type, external_thread_id) 
         DO UPDATE SET 
            last_user_at = NOW(), 
            contact_id = COALESCE(conversations.contact_id, $3),
            unread_count = conversations.unread_count + 1,
            agent_read_at = NULL
         RETURNING id, (xmax = 0) as is_new`,
        [channel.bot_id, chatId.toString(), contact.id]
    );

    const conversationId = conversationResult.rows[0].id;
    const isNewConversation = conversationResult.rows[0].is_new;

    // Update contact stats if new conversation
    if (isNewConversation) {
        await linkConversationToContact(conversationId, contact.id);
    }

    // Insert user message
    const msgResult = await query(
        `INSERT INTO messages (conversation_id, role, content, raw)
         VALUES ($1, 'user', $2, $3)
         RETURNING *`,
        [conversationId, content, JSON.stringify({
            message: message,
            media: mediaResult || null
        })]
    );

    // Emit socket event for real-time updates
    emitNewMessage(conversationId, msgResult.rows[0], channel.workspace_id);

    // Emit new conversation event for inbox to update
    if (isNewConversation) {
        emitNewConversation(channel.workspace_id, {
            id: conversationId,
            channel_type: 'telegram',
            external_thread_id: chatId.toString(),
            last_message: previewText,
            status: 'open',
            unread_count: 1
        });
    }

    // Update channel last_activity
    await query(
        'UPDATE bot_channels SET last_activity_at = NOW(), status = $1 WHERE id = $2',
        ['connected', channel.id]
    );

    // V1 Handoff Gatekeeper: check if should forward to n8n
    const shouldForward = await shouldForwardToN8n(conversationId);

    if (shouldForward) {
        const n8nBase = channel.n8n_config?.webhook_base_url || process.env.N8N_WEBHOOK_BASE;
        const n8nWebhookUrl = `${n8nBase}/chat-message`;

        fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bot_id: channel.bot_id,
                channel_id: channel.id,
                conversation_id: conversationId,
                channel_type: 'telegram',
                external_thread_id: chatId.toString(),
                text: text || previewText,
                message_type: telegramMedia?.mediaType || 'text',
                media: mediaResult || null,
                user: fromUser,
                raw: req.body
            })
        }).catch(err => console.error('n8n chat webhook error:', err.message));
    } else {
        console.log(`[Telegram] Skipping n8n forward - conv ${conversationId} in human mode`);
    }

    res.status(200).json({ status: 'received' });
}));

/**
 * Extract media info from a Telegram message object
 * Returns { fileId, mediaType, mimeType, filename } or null if text-only
 */
function extractTelegramMedia(msg) {
    if (!msg) return null;

    // Photo: array of PhotoSize, pick largest (last)
    if (msg.photo && msg.photo.length > 0) {
        const largest = msg.photo[msg.photo.length - 1];
        return {
            fileId: largest.file_id,
            mediaType: 'image',
            mimeType: 'image/jpeg', // Telegram photos are always JPEG
            filename: null
        };
    }

    // Video
    if (msg.video) {
        return {
            fileId: msg.video.file_id,
            mediaType: 'video',
            mimeType: msg.video.mime_type || 'video/mp4',
            filename: msg.video.file_name || null
        };
    }

    // Audio (music files)
    if (msg.audio) {
        return {
            fileId: msg.audio.file_id,
            mediaType: 'audio',
            mimeType: msg.audio.mime_type || 'audio/mpeg',
            filename: msg.audio.file_name || null
        };
    }

    // Voice note
    if (msg.voice) {
        return {
            fileId: msg.voice.file_id,
            mediaType: 'voice',
            mimeType: msg.voice.mime_type || 'audio/ogg',
            filename: null
        };
    }

    // Document (any file)
    if (msg.document) {
        return {
            fileId: msg.document.file_id,
            mediaType: 'document',
            mimeType: msg.document.mime_type || 'application/octet-stream',
            filename: msg.document.file_name || null
        };
    }

    // Sticker
    if (msg.sticker) {
        return {
            fileId: msg.sticker.file_id,
            mediaType: 'sticker',
            mimeType: 'image/webp',
            filename: null
        };
    }

    // Video note (round video)
    if (msg.video_note) {
        return {
            fileId: msg.video_note.file_id,
            mediaType: 'video',
            mimeType: 'video/mp4',
            filename: null
        };
    }

    // Location
    if (msg.location) {
        // Not a file download, handled separately
        return null;
    }

    return null;
}

// ============================================
// WhatsApp (Meta Cloud API) Webhooks
// ============================================

// Helper: Verify WhatsApp webhook signature
const verifyWhatsAppSignature = (req, appSecret) => {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) return false;

    const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', appSecret)
        .update(req.rawBody || Buffer.from(JSON.stringify(req.body)))
        .digest('hex');

    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    } catch {
        return false;
    }
};

// Helper: Look up WhatsApp channel by public_id
const findWhatsAppChannel = async (botPublicId) => {
    const result = await query(
        `SELECT bc.*, b.id as bot_id, b.workspace_id, b.n8n_config
         FROM bot_channels bc
         JOIN bots b ON bc.bot_id = b.id
         WHERE bc.channel_type = 'whatsapp' AND bc.public_id = $1 AND bc.is_enabled = true`,
        [botPublicId]
    );
    return result.rows[0] || null;
};

// GET /v1/hooks/whatsapp/:bot_public_id - Meta webhook verification
router.get('/whatsapp/:bot_public_id', asyncHandler(async (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('[WhatsApp] Webhook verification request:');
    console.log('[WhatsApp] - Public ID:', req.params.bot_public_id);
    console.log('[WhatsApp] - Mode:', mode);

    if (mode !== 'subscribe' || !token) {
        return res.status(403).send('Forbidden');
    }

    const channel = await findWhatsAppChannel(req.params.bot_public_id);
    if (!channel) {
        console.log('[WhatsApp] - FAIL: Channel not found');
        return res.status(404).send('Channel not found');
    }

    // verify_token is stored in channel config
    const expectedToken = channel.config?.verify_token;
    if (token !== expectedToken) {
        console.log('[WhatsApp] - FAIL: Verify token mismatch');
        return res.status(403).send('Invalid verify token');
    }

    console.log('[WhatsApp] - SUCCESS: Verification passed, returning challenge');

    // Update channel status to connected on successful verification
    await query(
        `UPDATE bot_channels SET status = 'connected', status_message = 'Webhook verified', updated_at = NOW() WHERE id = $1`,
        [channel.id]
    );

    res.status(200).send(challenge);
}));

// POST /v1/hooks/whatsapp/:bot_public_id - Receive WhatsApp messages
router.post('/whatsapp/:bot_public_id', asyncHandler(async (req, res) => {
    console.log('[WhatsApp] ========= NEW WEBHOOK REQUEST =========');

    const channel = await findWhatsAppChannel(req.params.bot_public_id);
    if (!channel) {
        console.log('[WhatsApp] - Channel not found for public_id:', req.params.bot_public_id);
        return res.status(200).json({ status: 'ignored' }); // Always 200 for Meta
    }

    // Require app_secret — reject if not configured
    const appSecret = channel.config?.app_secret;
    if (!appSecret) {
        console.warn('[WhatsApp] - REJECTED: app_secret not configured for channel', channel.id);
        return res.status(200).json({ status: 'rejected_no_secret' });
    }

    // Verify signature
    if (!verifyWhatsAppSignature(req, appSecret)) {
        console.log('[WhatsApp] - FAIL: Invalid signature');
        return res.status(200).json({ status: 'invalid_signature' });
    }

    const body = req.body;

    // Meta sends different object types; we only care about messages
    if (body.object !== 'whatsapp_business_account') {
        return res.status(200).json({ status: 'not_whatsapp' });
    }

    // Process each entry/change
    const entries = body.entry || [];
    for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
            if (change.field !== 'messages') continue;

            const value = change.value || {};
            const messages = value.messages || [];
            const contacts = value.contacts || [];
            const metadata = value.metadata || {};

            // Process each message
            for (const msg of messages) {
                const from = msg.from; // phone number (e.g. "628123456789")
                if (!from) continue;

                // Determine content based on message type
                let content = null;
                let mediaResult = null;
                const accessToken = channel.config?.access_token;

                switch (msg.type) {
                    case 'text':
                        content = msg.text?.body;
                        break;

                    case 'image':
                    case 'video':
                    case 'audio':
                    case 'document':
                    case 'sticker': {
                        const mediaInfo = extractMediaInfo(msg);
                        if (mediaInfo && accessToken) {
                            mediaResult = await downloadAndStoreMedia(
                                mediaInfo.mediaId,
                                mediaInfo.mediaType,
                                accessToken,
                                { filename: mediaInfo.filename, caption: mediaInfo.caption }
                            );

                            if (mediaResult) {
                                content = buildMediaContent(msg.type, mediaResult.objectKey, mediaResult.caption);
                            } else {
                                // Media download failed, save placeholder
                                content = `[${msg.type.toUpperCase()}] (gagal diunduh)`;
                            }
                        } else {
                            content = `[${msg.type.toUpperCase()}]`;
                        }
                        break;
                    }

                    case 'location':
                        content = `[LOCATION] ${msg.location?.latitude},${msg.location?.longitude}`;
                        break;

                    case 'contacts':
                        content = `[CONTACT] ${msg.contacts?.[0]?.name?.formatted_name || 'Unknown'}`;
                        break;

                    case 'reaction':
                        console.log(`[WhatsApp] - Reaction from ${from}: ${msg.reaction?.emoji}`);
                        continue; // Skip reactions, don't save as message

                    default:
                        content = `[${(msg.type || 'unknown').toUpperCase()}]`;
                        break;
                }

                if (!content) {
                    console.log('[WhatsApp] - Skipping empty message, type:', msg.type);
                    continue;
                }

                const previewText = content.startsWith('media::')
                    ? `[${msg.type.toUpperCase()}]${mediaResult?.caption ? ' ' + mediaResult.caption : ''}`
                    : content;

                console.log(`[WhatsApp] - ${msg.type} from ${from}: ${previewText.substring(0, 100)}`);

                // Get contact profile from webhook data
                const waContact = contacts.find(c => c.wa_id === from) || {};
                const userData = {
                    profile: waContact.profile || {},
                    name: waContact.profile?.name || null,
                    wa_id: from
                };

                // Find or create contact
                const contact = await findOrCreateContact({
                    workspaceId: channel.workspace_id,
                    externalId: from,
                    channelType: 'whatsapp',
                    userData
                });

                // Upsert conversation
                const conversationResult = await query(
                    `INSERT INTO conversations (bot_id, channel_type, external_thread_id, contact_id, last_user_at, unread_count)
                     VALUES ($1, 'whatsapp', $2, $3, NOW(), 1)
                     ON CONFLICT (bot_id, channel_type, external_thread_id)
                     DO UPDATE SET
                        last_user_at = NOW(),
                        contact_id = COALESCE(conversations.contact_id, $3),
                        unread_count = conversations.unread_count + 1,
                        agent_read_at = NULL
                     RETURNING id, (xmax = 0) as is_new`,
                    [channel.bot_id, from, contact.id]
                );

                const conversationId = conversationResult.rows[0].id;
                const isNewConversation = conversationResult.rows[0].is_new;

                // Update contact stats if new conversation
                if (isNewConversation) {
                    await linkConversationToContact(conversationId, contact.id);
                }

                // Insert user message
                const msgResult = await query(
                    `INSERT INTO messages (conversation_id, role, content, raw)
                     VALUES ($1, 'user', $2, $3)
                     RETURNING *`,
                    [conversationId, content, JSON.stringify({
                        message: msg,
                        contact: waContact,
                        metadata,
                        media: mediaResult || null
                    })]
                );

                // Emit socket events for real-time updates
                emitNewMessage(conversationId, msgResult.rows[0], channel.workspace_id);

                if (isNewConversation) {
                    emitNewConversation(channel.workspace_id, {
                        id: conversationId,
                        channel_type: 'whatsapp',
                        external_thread_id: from,
                        last_message: previewText,
                        status: 'open',
                        unread_count: 1
                    });
                }

                // Update channel last_activity
                await query(
                    'UPDATE bot_channels SET last_activity_at = NOW(), status = $1 WHERE id = $2',
                    ['connected', channel.id]
                );

                // V1 Handoff Gatekeeper: check if should forward to n8n
                const shouldForward = await shouldForwardToN8n(conversationId);

                if (shouldForward) {
                    const n8nBase = channel.n8n_config?.webhook_base_url || process.env.N8N_WEBHOOK_BASE;
                    const n8nWebhookUrl = `${n8nBase}/chat-message`;

                    fetch(n8nWebhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            bot_id: channel.bot_id,
                            channel_id: channel.id,
                            conversation_id: conversationId,
                            channel_type: 'whatsapp',
                            external_thread_id: from,
                            text: msg.type === 'text' ? content : previewText,
                            message_type: msg.type,
                            media: mediaResult || null,
                            user: userData,
                            wa_message_id: msg.id,
                            raw: { message: msg, contact: waContact, metadata }
                        })
                    }).catch(err => console.error('[WhatsApp] n8n forward error:', err.message));
                } else {
                    console.log(`[WhatsApp] Skipping n8n forward - conv ${conversationId} in human mode`);
                }
            }

            // Handle status updates (sent, delivered, read)
            const statuses = value.statuses || [];
            const statusRank = { failed: 0, sent: 1, delivered: 2, read: 3 };
            for (const status of statuses) {
                console.log(`[WhatsApp] - Status update: ${status.id} -> ${status.status}`);

                const newStatus = status.status; // sent | delivered | read | failed
                if (!(newStatus in statusRank)) continue;

                try {
                    // Find the message by provider_message_id
                    const msgLookup = await query(
                        'SELECT id, conversation_id, status FROM messages WHERE provider_message_id = $1',
                        [status.id]
                    );

                    if (msgLookup.rows.length === 0) {
                        console.log(`[WhatsApp] - No message found for provider_message_id: ${status.id}`);
                        continue;
                    }

                    const existingMsg = msgLookup.rows[0];
                    const currentRank = statusRank[existingMsg.status] ?? -1;
                    const newRank = statusRank[newStatus];

                    // Only upgrade status, never downgrade
                    if (newRank > currentRank) {
                        await query(
                            'UPDATE messages SET status = $1 WHERE id = $2',
                            [newStatus, existingMsg.id]
                        );
                        console.log(`[WhatsApp] - Updated message ${existingMsg.id} status: ${existingMsg.status} -> ${newStatus}`);

                        // Get workspace_id for socket emit
                        const convLookup = await query(
                            'SELECT c.id, b.workspace_id FROM conversations c JOIN bots b ON b.id = c.bot_id WHERE c.id = $1',
                            [existingMsg.conversation_id]
                        );
                        const workspaceId = convLookup.rows[0]?.workspace_id || null;

                        // Emit real-time status update to frontend
                        emitMessageStatus(existingMsg.conversation_id, existingMsg.id, newStatus, workspaceId);
                    }
                } catch (err) {
                    console.error(`[WhatsApp] - Error processing status update:`, err.message);
                }
            }
        }
    }

    // Always respond 200 to Meta - otherwise they'll retry and eventually disable the webhook
    res.status(200).json({ status: 'received' });
}));

module.exports = router;
