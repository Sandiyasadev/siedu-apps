const { query } = require('../utils/db');
const { emitStatusChange } = require('./socketService');

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
            console.log(`[HandoffScheduler] Auto-reverted ${result.rows.length} conversation(s) to bot`);

            // Emit socket events so dashboards update in real-time
            for (const row of result.rows) {
                emitStatusChange(row.id, 'bot', row.workspace_id);
            }
        }
    } catch (err) {
        console.error('[HandoffScheduler] Error reverting stale handoffs:', err.message);
    }
}

function startHandoffScheduler() {
    if (intervalId) return; // Already running

    console.log(`[HandoffScheduler] Started — checking every ${CHECK_INTERVAL_MS / 1000}s, timeout: ${HANDOFF_TIMEOUT_MS / 1000}s`);
    intervalId = setInterval(revertStaleHandoffs, CHECK_INTERVAL_MS);

    // Also run once immediately on startup
    revertStaleHandoffs();
}

function stopHandoffScheduler() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('[HandoffScheduler] Stopped');
    }
}

module.exports = { startHandoffScheduler, stopHandoffScheduler };
