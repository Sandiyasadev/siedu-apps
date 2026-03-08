const { query } = require('../utils/db');
const { emitStatusChange } = require('./socketService');
const logger = require('../utils/logger');

// Must match the value in hooks.js
const HANDOFF_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const CHECK_INTERVAL_MS = 60 * 1000; // Run every 1 minute

let intervalId = null;

/**
 * Scan for stale 'human' conversations and revert them to 'bot'.
 * This runs as a background job so conversations don't stay stuck
 * in human mode when both the user and agent stop chatting.
 */
async function revertStaleHandoffs() {
    try {
        const result = await query(`
            UPDATE conversations c
            SET status = 'bot', unanswered_count = 0
            FROM bots b
            WHERE c.bot_id = b.id
              AND c.status = 'human'
              AND c.last_agent_reply_at IS NOT NULL
              AND c.last_agent_reply_at < NOW() - INTERVAL '${HANDOFF_TIMEOUT_MS / 1000} seconds'
            RETURNING c.id, b.workspace_id
        `);

        if (result.rows.length > 0) {
            logger.info({ count: result.rows.length }, '[HandoffScheduler] Auto-reverted conversations to bot');

            // Emit socket events so dashboards update in real-time
            for (const row of result.rows) {
                emitStatusChange(row.id, 'bot', row.workspace_id);
            }
        }
    } catch (err) {
        logger.error({ err: err.message }, '[HandoffScheduler] Error reverting stale handoffs');
    }
}

function startHandoffScheduler() {
    if (intervalId) return; // Already running

    logger.info({ intervalSecs: CHECK_INTERVAL_MS / 1000, timeoutSecs: HANDOFF_TIMEOUT_MS / 1000 }, '[HandoffScheduler] Started');
    intervalId = setInterval(revertStaleHandoffs, CHECK_INTERVAL_MS);

    // Also run once immediately on startup
    revertStaleHandoffs();
}

function stopHandoffScheduler() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        logger.info('[HandoffScheduler] Stopped');
    }
}

module.exports = { startHandoffScheduler, stopHandoffScheduler };
