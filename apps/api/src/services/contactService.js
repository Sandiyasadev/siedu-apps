const { query } = require('../utils/db');

/**
 * Find or create a contact based on external_id and channel
 * @param {Object} params
 * @param {string} params.workspaceId - Workspace ID
 * @param {string} params.externalId - External identifier (chat_id, phone, etc.)
 * @param {string} params.channelType - Channel type (telegram, whatsapp, etc.)
 * @param {Object} [params.userData] - User data from the channel
 * @returns {Promise<{id: string, created: boolean}>}
 */
async function findOrCreateContact({ workspaceId, externalId, channelType, userData = {} }) {
    // Try to find existing contact
    const existing = await query(
        `SELECT id FROM contacts 
         WHERE workspace_id = $1 AND channel_type = $2 AND external_id = $3`,
        [workspaceId, channelType, externalId]
    );

    if (existing.rows.length > 0) {
        // Update last_seen and metadata
        await query(
            `UPDATE contacts SET 
                last_seen_at = NOW(),
                updated_at = NOW(),
                metadata = metadata || $1::jsonb,
                name = COALESCE(NULLIF($2, ''), name)
             WHERE id = $3`,
            [
                JSON.stringify(userData),
                extractName(userData, channelType),
                existing.rows[0].id
            ]
        );

        return { id: existing.rows[0].id, created: false };
    }

    // Create new contact
    const name = extractName(userData, channelType);
    const phone = extractPhone(externalId, channelType);

    const result = await query(
        `INSERT INTO contacts (workspace_id, external_id, channel_type, name, phone, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [workspaceId, externalId, channelType, name, phone, JSON.stringify(userData)]
    );

    console.log(`[Contact] Created new contact: ${result.rows[0].id} for ${channelType}:${externalId}`);

    return { id: result.rows[0].id, created: true };
}

/**
 * Link a conversation to a contact
 */
async function linkConversationToContact(conversationId, contactId) {
    await query(
        `UPDATE conversations SET contact_id = $1 WHERE id = $2`,
        [contactId, conversationId]
    );

    // Update contact stats
    await query(
        `UPDATE contacts SET 
            total_conversations = total_conversations + 1,
            last_conversation_at = NOW()
         WHERE id = $1`,
        [contactId]
    );
}

/**
 * Get contact by ID
 */
async function getContact(contactId) {
    const result = await query(
        `SELECT * FROM contacts WHERE id = $1`,
        [contactId]
    );
    return result.rows[0] || null;
}

/**
 * Get contact by external ID
 */
async function getContactByExternalId(workspaceId, channelType, externalId) {
    const result = await query(
        `SELECT * FROM contacts 
         WHERE workspace_id = $1 AND channel_type = $2 AND external_id = $3`,
        [workspaceId, channelType, externalId]
    );
    return result.rows[0] || null;
}

/**
 * Extract display name from user data
 */
function extractName(userData, channelType) {
    if (!userData) return null;

    switch (channelType) {
        case 'telegram':
            const tgName = [userData.first_name, userData.last_name].filter(Boolean).join(' ');
            return tgName || userData.username || null;
        case 'whatsapp':
            return userData.profile?.name || userData.name || null;
        case 'facebook':
        case 'instagram':
            return userData.name || null;
        default:
            return userData.name || null;
    }
}

/**
 * Extract phone number if available
 */
function extractPhone(externalId, channelType) {
    if (channelType === 'whatsapp') {
        // WhatsApp external_id is usually the phone number
        return externalId.startsWith('+') ? externalId : `+${externalId}`;
    }
    return null;
}

module.exports = {
    findOrCreateContact,
    linkConversationToContact,
    getContact,
    getContactByExternalId
};
