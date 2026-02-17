const { query } = require('../utils/db');
const { uploadToMeta, getWhatsAppMediaType } = require('./mediaService');

/**
 * Send message to a specific channel
 * @param {string} conversationId - Conversation ID
 * @param {string} content - Message content (text or media content string)
 * @param {Object} [media] - Optional media for outbound: { buffer, mimeType, originalName }
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendToChannel(conversationId, content, media = null) {
    // Get conversation with channel details
    const result = await query(`
        SELECT 
            c.id, c.channel_type, c.external_thread_id, c.bot_id,
            bc.id as channel_id, bc.config, bc.public_id
        FROM conversations c
        JOIN bot_channels bc ON bc.bot_id = c.bot_id AND bc.channel_type = c.channel_type
        WHERE c.id = $1 AND bc.is_enabled = true
        LIMIT 1
    `, [conversationId]);

    if (result.rows.length === 0) {
        console.error(`[ChannelService] No channel found for conversation ${conversationId}`);
        return { success: false, error: 'Channel not found' };
    }

    const conv = result.rows[0];
    const config = conv.config || {};

    console.log(`[ChannelService] Sending to ${conv.channel_type} - chat: ${conv.external_thread_id}`);

    try {
        switch (conv.channel_type) {
            case 'telegram':
                return await sendTelegram(conv.external_thread_id, content, config, media);
            case 'whatsapp':
                return await sendWhatsApp(conv.external_thread_id, content, config, media);
            default:
                console.warn(`[ChannelService] Unsupported channel type: ${conv.channel_type}`);
                return { success: false, error: 'Unsupported channel' };
        }
    } catch (error) {
        console.error(`[ChannelService] Error sending to ${conv.channel_type}:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Send message via Telegram Bot API with timeout and retry
 * Supports text and media (image, video, audio, document)
 */
async function sendTelegram(chatId, text, config, media = null, retries = 3) {
    const botToken = config.bot_token;

    if (!botToken) {
        return { success: false, error: 'Telegram bot_token not configured' };
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            let url, body, headers;

            if (media && media.buffer) {
                // Send media via multipart FormData
                const mimeType = media.mimeType || 'application/octet-stream';
                let method;

                if (mimeType.startsWith('image/')) method = 'sendPhoto';
                else if (mimeType.startsWith('video/')) method = 'sendVideo';
                else if (mimeType.startsWith('audio/')) method = 'sendAudio';
                else method = 'sendDocument';

                url = `https://api.telegram.org/bot${botToken}/${method}`;

                // Field name depends on method
                const fieldMap = {
                    sendPhoto: 'photo',
                    sendVideo: 'video',
                    sendAudio: 'audio',
                    sendDocument: 'document'
                };
                const fieldName = fieldMap[method];

                const form = new FormData();
                form.append('chat_id', chatId);
                form.append(fieldName, new Blob([media.buffer], { type: mimeType }), media.originalName || 'file');
                if (text) form.append('caption', text);

                body = form;
                headers = {}; // let fetch set multipart boundary
            } else {
                // Text-only message
                url = `https://api.telegram.org/bot${botToken}/sendMessage`;
                body = JSON.stringify({
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'HTML'
                });
                headers = { 'Content-Type': 'application/json' };
            }

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const data = await response.json();

            if (!data.ok) {
                console.error('[Telegram] API Error:', data.description);
                return { success: false, error: data.description };
            }

            console.log(`[Telegram] Message sent to ${chatId}`);
            return { success: true, message_id: data.result.message_id };

        } catch (error) {
            const isLastAttempt = attempt === retries;
            const errorMsg = error.name === 'AbortError' ? 'Request timeout' : error.message;

            console.error(`[Telegram] Attempt ${attempt}/${retries} failed:`, errorMsg);

            if (isLastAttempt) {
                return { success: false, error: errorMsg };
            }

            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }

    return { success: false, error: 'All retry attempts failed' };
}

/**
 * Send message via WhatsApp Business API (Meta)
 * Supports text and media (image, video, audio, document)
 */
async function sendWhatsApp(phoneNumber, text, config, media = null) {
    const { phone_number_id, access_token } = config;

    if (!phone_number_id || !access_token) {
        return { success: false, error: 'WhatsApp credentials not configured' };
    }

    const url = `https://graph.facebook.com/v18.0/${phone_number_id}/messages`;
    let payload;

    if (media && media.buffer) {
        // Step 1: Upload media to Meta
        const mediaType = getWhatsAppMediaType(media.mimeType);
        let mediaId;

        try {
            mediaId = await uploadToMeta(media.buffer, media.mimeType, config);
        } catch (uploadErr) {
            console.error('[WhatsApp] Media upload to Meta failed:', uploadErr.message);
            return { success: false, error: `Media upload failed: ${uploadErr.message}` };
        }

        // Step 2: Send message with media_id
        const mediaPayload = { id: mediaId };
        if (text) {
            if (mediaType === 'document') {
                mediaPayload.filename = media.originalName || 'file';
                mediaPayload.caption = text;
            } else if (mediaType === 'image' || mediaType === 'video') {
                mediaPayload.caption = text;
            }
            // audio doesn't support caption
        }

        payload = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: mediaType,
            [mediaType]: mediaPayload
        };
    } else {
        // Text-only
        payload = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'text',
            text: { body: text }
        };
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.error) {
        console.error('[WhatsApp] API Error:', data.error.message);
        return { success: false, error: data.error.message };
    }

    console.log(`[WhatsApp] Message sent to ${phoneNumber}`);
    return { success: true, message_id: data.messages?.[0]?.id };
}

/**
 * Get channel config for a conversation
 */
async function getChannelConfig(conversationId) {
    const result = await query(`
        SELECT bc.config, bc.channel_type
        FROM conversations c
        JOIN bot_channels bc ON bc.bot_id = c.bot_id AND bc.channel_type = c.channel_type
        WHERE c.id = $1 AND bc.is_enabled = true
        LIMIT 1
    `, [conversationId]);

    return result.rows[0] || null;
}

module.exports = {
    sendToChannel,
    sendTelegram,
    sendWhatsApp,
    getChannelConfig
};
