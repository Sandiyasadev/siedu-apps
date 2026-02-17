const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
const { query } = require('../utils/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /v1/bots - List all bots
router.get('/', asyncHandler(async (req, res) => {
    const result = await query(
        `SELECT id, name, system_prompt, rag_top_k, rag_min_score, 
            handoff_enabled, llm_provider, llm_model, n8n_config,
            created_at, updated_at 
     FROM bots 
     WHERE workspace_id = $1 
     ORDER BY created_at DESC`,
        [req.user.workspace_id]
    );

    res.json({ bots: result.rows });
}));

// GET /v1/bots/:id - Get single bot
router.get('/:id', asyncHandler(async (req, res) => {
    const result = await query(
        `SELECT id, name, system_prompt, rag_top_k, rag_min_score,
            handoff_enabled, handoff_min_score, llm_provider, llm_model,
            embed_provider, embed_model, n8n_config, created_at, updated_at
     FROM bots 
     WHERE id = $1 AND workspace_id = $2`,
        [req.params.id, req.user.workspace_id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    res.json({ bot: result.rows[0] });
}));

// POST /v1/bots - Create new bot
router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
    const {
        name,
        system_prompt = '',
        rag_top_k = 6,
        rag_min_score = 0.2,
        handoff_enabled = true,
        handoff_min_score = 0.15,
        llm_provider = 'openai',
        llm_model = 'gpt-4o-mini',
        embed_provider = 'openai',
        embed_model = 'text-embedding-3-small'
    } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Bot name is required' });
    }

    const result = await query(
        `INSERT INTO bots (workspace_id, name, system_prompt, rag_top_k, rag_min_score,
                       handoff_enabled, handoff_min_score, llm_provider, llm_model,
                       embed_provider, embed_model)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
        [req.user.workspace_id, name, system_prompt, rag_top_k, rag_min_score,
            handoff_enabled, handoff_min_score, llm_provider, llm_model,
            embed_provider, embed_model]
    );

    res.status(201).json({ bot: result.rows[0] });
}));

// PATCH /v1/bots/:id - Update bot
router.patch('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
    const allowedFields = [
        'name', 'system_prompt', 'rag_top_k', 'rag_min_score',
        'handoff_enabled', 'handoff_min_score', 'llm_provider', 'llm_model',
        'embed_provider', 'embed_model', 'n8n_config'
    ];

    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            updates.push(`${field} = $${paramIndex}`);
            values.push(req.body[field]);
            paramIndex++;
        }
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.user.workspace_id);

    const result = await query(
        `UPDATE bots SET ${updates.join(', ')} 
     WHERE id = $${paramIndex} AND workspace_id = $${paramIndex + 1}
     RETURNING *`,
        values
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    res.json({ bot: result.rows[0] });
}));

// DELETE /v1/bots/:id - Delete bot
router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
    const result = await query(
        'DELETE FROM bots WHERE id = $1 AND workspace_id = $2 RETURNING id',
        [req.params.id, req.user.workspace_id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    res.json({ success: true, message: 'Bot deleted' });
}));

// Channel type definitions with required config fields
const CHANNEL_TYPES = {
    telegram: { requiredConfig: ['bot_token'], label: 'Telegram' },
    whatsapp: { requiredConfig: ['phone_number_id', 'access_token', 'verify_token'], label: 'WhatsApp' },
    facebook: { requiredConfig: ['page_id', 'page_access_token', 'verify_token'], label: 'Facebook' },
    instagram: { requiredConfig: ['business_account_id', 'page_access_token', 'verify_token'], label: 'Instagram' },
    discord: { requiredConfig: ['bot_token', 'application_id'], label: 'Discord' }
};

// Sensitive fields that should be masked in responses
const SENSITIVE_CONFIG_FIELDS = [
    'bot_token', 'access_token', 'page_access_token', 'app_secret', 'verify_token', 'public_key'
];

// Mask sensitive values in config
function maskConfig(config) {
    if (!config || typeof config !== 'object') return config;
    const masked = { ...config };
    for (const field of SENSITIVE_CONFIG_FIELDS) {
        if (masked[field]) {
            const val = masked[field];
            if (val.length > 8) {
                masked[field] = val.substring(0, 4) + '••••••••' + val.substring(val.length - 4);
            } else {
                masked[field] = '••••••••';
            }
        }
    }
    return masked;
}

// Validate channel config based on type
function validateChannelConfig(channelType, config) {
    const typeConfig = CHANNEL_TYPES[channelType];
    if (!typeConfig) {
        return { valid: false, error: `Invalid channel type: ${channelType}` };
    }

    const missing = [];
    for (const field of typeConfig.requiredConfig) {
        if (!config || !config[field]) {
            missing.push(field);
        }
    }

    if (missing.length > 0) {
        return { valid: false, error: `Missing required config fields: ${missing.join(', ')}` };
    }

    return { valid: true };
}

// Register Telegram webhook automatically
async function registerTelegramWebhook(channel, botToken) {
    const publicApiUrl = process.env.PUBLIC_API_URL;

    if (!publicApiUrl) {
        console.log('[Telegram] PUBLIC_API_URL not set, skipping auto webhook registration');
        return { success: false, error: 'PUBLIC_API_URL not configured' };
    }

    const webhookUrl = `${publicApiUrl}/v1/hooks/telegram/${channel.public_id}`;
    const secretToken = channel.secret;

    console.log('[Telegram] Auto-registering webhook:', webhookUrl);

    try {
        const telegramUrl = `https://api.telegram.org/bot${botToken}/setWebhook`;
        const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: webhookUrl,
                secret_token: secretToken,
                allowed_updates: ['message', 'callback_query']
            })
        });

        const result = await response.json();

        if (!result.ok) {
            console.log('[Telegram] Webhook registration failed:', result.description);
            return { success: false, error: result.description };
        }

        console.log('[Telegram] Webhook registered successfully');
        return { success: true, webhook_url: webhookUrl };
    } catch (err) {
        console.error('[Telegram] Webhook registration error:', err.message);
        return { success: false, error: err.message };
    }
}

// GET /v1/bots/:id/channels/types - Get available channel types
router.get('/:id/channels/types', asyncHandler(async (req, res) => {
    const types = Object.entries(CHANNEL_TYPES).map(([key, value]) => ({
        type: key,
        label: value.label,
        requiredConfig: value.requiredConfig
    }));
    res.json({ types });
}));

// POST /v1/bots/:id/channels - Create channel for bot
router.post('/:id/channels', requireRole('admin'), asyncHandler(async (req, res) => {
    const { channel_type, name, public_id, config = {} } = req.body;

    if (!channel_type) {
        return res.status(400).json({ error: 'Channel type is required' });
    }

    // Validate channel type
    if (!CHANNEL_TYPES[channel_type]) {
        return res.status(400).json({
            error: `Invalid channel type. Must be one of: ${Object.keys(CHANNEL_TYPES).join(', ')}`
        });
    }

    // Validate config
    const validation = validateChannelConfig(channel_type, config);
    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }

    // Verify bot belongs to user's workspace
    const botCheck = await query(
        'SELECT id, name FROM bots WHERE id = $1 AND workspace_id = $2',
        [req.params.id, req.user.workspace_id]
    );

    if (botCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    // Generate secret and public_id if not provided
    const secret = uuidv4();
    const finalPublicId = public_id || uuidv4().substring(0, 8);
    const channelName = name || `${CHANNEL_TYPES[channel_type].label} - ${botCheck.rows[0].name}`;
    let status = 'pending_setup';
    let statusMessage = null;

    const result = await query(
        `INSERT INTO bot_channels (bot_id, channel_type, name, public_id, secret, config, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [req.params.id, channel_type, channelName, finalPublicId, secret, JSON.stringify(config), status]
    );

    const channel = result.rows[0];

    // Auto-register webhook for Telegram
    if (channel_type === 'telegram' && config.bot_token) {
        const webhookResult = await registerTelegramWebhook(channel, config.bot_token);

        if (webhookResult.success) {
            status = 'connected';
            statusMessage = `Webhook: ${webhookResult.webhook_url}`;
        } else {
            status = 'pending_setup';
            statusMessage = `Auto-setup failed: ${webhookResult.error}. Use manual setup.`;
        }

        // Update channel status
        await query(
            'UPDATE bot_channels SET status = $1, status_message = $2 WHERE id = $3',
            [status, statusMessage, channel.id]
        );
        channel.status = status;
        channel.status_message = statusMessage;
    }

    res.status(201).json({
        channel: {
            ...channel,
            config: maskConfig(channel.config)
        }
    });
}));

// GET /v1/bots/:id/channels - List channels for bot
router.get('/:id/channels', asyncHandler(async (req, res) => {
    // Verify bot belongs to user's workspace
    const botCheck = await query(
        'SELECT id FROM bots WHERE id = $1 AND workspace_id = $2',
        [req.params.id, req.user.workspace_id]
    );

    if (botCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    const result = await query(
        `SELECT id, bot_id, channel_type, name, public_id, config, 
                status, status_message, is_enabled, last_activity_at, created_at, updated_at
         FROM bot_channels WHERE bot_id = $1
         ORDER BY created_at DESC`,
        [req.params.id]
    );

    const channels = result.rows.map(ch => ({
        ...ch,
        config: maskConfig(ch.config)
    }));

    res.json({ channels });
}));

// GET /v1/bots/:id/channels/:channelId - Get single channel
router.get('/:id/channels/:channelId', asyncHandler(async (req, res) => {
    const botCheck = await query(
        'SELECT id FROM bots WHERE id = $1 AND workspace_id = $2',
        [req.params.id, req.user.workspace_id]
    );

    if (botCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    const result = await query(
        `SELECT id, bot_id, channel_type, name, public_id, config,
                status, status_message, is_enabled, last_activity_at, created_at, updated_at
         FROM bot_channels WHERE id = $1 AND bot_id = $2`,
        [req.params.channelId, req.params.id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Channel not found' });
    }

    const channel = result.rows[0];
    res.json({
        channel: {
            ...channel,
            config: maskConfig(channel.config)
        }
    });
}));

// GET /v1/bots/:id/channels/:channelId/config - Get channel config (unmasked, admin only)
router.get('/:id/channels/:channelId/config', requireRole('admin'), asyncHandler(async (req, res) => {
    const botCheck = await query(
        'SELECT id FROM bots WHERE id = $1 AND workspace_id = $2',
        [req.params.id, req.user.workspace_id]
    );

    if (botCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    const result = await query(
        `SELECT config FROM bot_channels WHERE id = $1 AND bot_id = $2`,
        [req.params.channelId, req.params.id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Channel not found' });
    }

    res.json({ config: result.rows[0].config });
}));

// PATCH /v1/bots/:id/channels/:channelId - Update channel
router.patch('/:id/channels/:channelId', requireRole('admin'), asyncHandler(async (req, res) => {
    const botCheck = await query(
        'SELECT id FROM bots WHERE id = $1 AND workspace_id = $2',
        [req.params.id, req.user.workspace_id]
    );

    if (botCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    // Get current channel to validate config updates
    const currentChannel = await query(
        'SELECT channel_type, config FROM bot_channels WHERE id = $1 AND bot_id = $2',
        [req.params.channelId, req.params.id]
    );

    if (currentChannel.rows.length === 0) {
        return res.status(404).json({ error: 'Channel not found' });
    }

    const { is_enabled, public_id, name, config, status, status_message } = req.body;
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (is_enabled !== undefined) {
        updates.push(`is_enabled = $${paramIndex}`);
        values.push(is_enabled);
        paramIndex++;
    }

    if (public_id !== undefined) {
        updates.push(`public_id = $${paramIndex}`);
        values.push(public_id);
        paramIndex++;
    }

    if (name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        values.push(name);
        paramIndex++;
    }

    if (config !== undefined) {
        // Merge with existing config (allows partial updates)
        const mergedConfig = { ...currentChannel.rows[0].config, ...config };

        // Validate merged config
        const channelType = currentChannel.rows[0].channel_type;
        const validation = validateChannelConfig(channelType, mergedConfig);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        updates.push(`config = $${paramIndex}`);
        values.push(JSON.stringify(mergedConfig));
        paramIndex++;
    }

    if (status !== undefined) {
        const validStatuses = ['pending_setup', 'connected', 'error', 'disabled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }
        updates.push(`status = $${paramIndex}`);
        values.push(status);
        paramIndex++;
    }

    if (status_message !== undefined) {
        updates.push(`status_message = $${paramIndex}`);
        values.push(status_message);
        paramIndex++;
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.channelId, req.params.id);

    const result = await query(
        `UPDATE bot_channels SET ${updates.join(', ')} 
         WHERE id = $${paramIndex} AND bot_id = $${paramIndex + 1}
         RETURNING *`,
        values
    );

    const channel = result.rows[0];
    res.json({
        channel: {
            ...channel,
            config: maskConfig(channel.config)
        }
    });
}));

// POST /v1/bots/:id/channels/:channelId/setup-webhook - Setup Telegram webhook (admin only)
router.post('/:id/channels/:channelId/setup-webhook', requireRole('admin'), asyncHandler(async (req, res) => {
    const { webhook_base_url } = req.body;

    const botCheck = await query(
        'SELECT id FROM bots WHERE id = $1 AND workspace_id = $2',
        [req.params.id, req.user.workspace_id]
    );

    if (botCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    const channelResult = await query(
        'SELECT * FROM bot_channels WHERE id = $1 AND bot_id = $2',
        [req.params.channelId, req.params.id]
    );

    if (channelResult.rows.length === 0) {
        return res.status(404).json({ error: 'Channel not found' });
    }

    const channel = channelResult.rows[0];

    if (channel.channel_type !== 'telegram') {
        return res.status(400).json({ error: 'This endpoint is only for Telegram channels' });
    }

    const botToken = channel.config?.bot_token;
    if (!botToken) {
        return res.status(400).json({ error: 'Bot token not configured' });
    }

    // Determine webhook URL
    const baseUrl = webhook_base_url || process.env.WEBHOOK_BASE_URL || req.headers.origin;
    if (!baseUrl) {
        return res.status(400).json({
            error: 'webhook_base_url is required (or set WEBHOOK_BASE_URL env var)',
            hint: 'Example: https://your-domain.com'
        });
    }

    const webhookUrl = `${baseUrl}/v1/hooks/telegram/${channel.public_id}`;
    const secretToken = channel.secret;

    try {
        // Call Telegram setWebhook API
        const telegramUrl = `https://api.telegram.org/bot${botToken}/setWebhook`;
        const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: webhookUrl,
                secret_token: secretToken,
                allowed_updates: ['message', 'callback_query']
            })
        });

        const result = await response.json();

        if (!result.ok) {
            // Update channel status to error
            await query(
                `UPDATE bot_channels SET status = 'error', status_message = $1, updated_at = NOW() WHERE id = $2`,
                [result.description || 'Failed to set webhook', channel.id]
            );
            return res.status(400).json({
                error: 'Failed to setup Telegram webhook',
                telegram_error: result.description
            });
        }

        // Update channel status to connected
        await query(
            `UPDATE bot_channels SET status = 'connected', status_message = 'Webhook configured', updated_at = NOW() WHERE id = $1`,
            [channel.id]
        );

        res.json({
            success: true,
            message: 'Telegram webhook configured successfully',
            webhook_url: webhookUrl
        });

    } catch (err) {
        console.error('Telegram webhook setup error:', err);
        await query(
            `UPDATE bot_channels SET status = 'error', status_message = $1, updated_at = NOW() WHERE id = $2`,
            [err.message, channel.id]
        );
        res.status(500).json({ error: 'Failed to connect to Telegram API', details: err.message });
    }
}));

// GET /v1/bots/:id/channels/:channelId/webhook-info - Get Telegram webhook info (admin only)
router.get('/:id/channels/:channelId/webhook-info', requireRole('admin'), asyncHandler(async (req, res) => {
    const botCheck = await query(
        'SELECT id FROM bots WHERE id = $1 AND workspace_id = $2',
        [req.params.id, req.user.workspace_id]
    );

    if (botCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    const channelResult = await query(
        'SELECT * FROM bot_channels WHERE id = $1 AND bot_id = $2',
        [req.params.channelId, req.params.id]
    );

    if (channelResult.rows.length === 0) {
        return res.status(404).json({ error: 'Channel not found' });
    }

    const channel = channelResult.rows[0];

    if (channel.channel_type !== 'telegram') {
        return res.status(400).json({ error: 'This endpoint is only for Telegram channels' });
    }

    const botToken = channel.config?.bot_token;
    if (!botToken) {
        return res.status(400).json({ error: 'Bot token not configured' });
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
        const result = await response.json();

        if (!result.ok) {
            return res.status(400).json({ error: result.description });
        }

        res.json({
            webhook_info: result.result,
            expected_url: `/v1/hooks/telegram/${channel.public_id}`
        });

    } catch (err) {
        res.status(500).json({ error: 'Failed to get webhook info', details: err.message });
    }
}));

// DELETE /v1/bots/:id/channels/:channelId - Delete channel
router.delete('/:id/channels/:channelId', requireRole('admin'), asyncHandler(async (req, res) => {
    const botCheck = await query(
        'SELECT id FROM bots WHERE id = $1 AND workspace_id = $2',
        [req.params.id, req.user.workspace_id]
    );

    if (botCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    const result = await query(
        'DELETE FROM bot_channels WHERE id = $1 AND bot_id = $2 RETURNING id',
        [req.params.channelId, req.params.id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Channel not found' });
    }

    res.json({ success: true, message: 'Channel deleted' });
}));

module.exports = router;
