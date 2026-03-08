'use strict';

const CircuitBreaker = require('opossum');
const logger = require('./logger');

const CIRCUIT_OPTIONS = {
    timeout: 5000,                   // 5 second request timeout
    errorThresholdPercentage: 50,    // open if ≥50% of calls fail
    resetTimeout: 30000,             // try half-open after 30 seconds
    volumeThreshold: 5,              // need at least 5 calls before circuit can open
    rollingCountTimeout: 60000,      // sliding window of 60 seconds
};

// Singleton map: n8n base URL → CircuitBreaker instance
const breakers = new Map();

/**
 * The actual HTTP call wrapped by the circuit breaker.
 * @param {string} url - Full n8n webhook URL
 * @param {Object} payload - JSON body
 * @param {string} [reqId] - Request ID for distributed tracing
 */
async function callN8n(url, payload, reqId) {
    // Uses Node 18+ global fetch (same as hooks.js)
    const headers = { 'Content-Type': 'application/json' };
    if (reqId) headers['x-request-id'] = reqId;

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const err = new Error(`n8n returned HTTP ${response.status}`);
        err.statusCode = response.status;
        throw err;
    }

    return response;
}

/**
 * Get (or create) a circuit breaker for a given n8n base URL.
 * Each unique base URL gets its own independent circuit.
 * @param {string} baseUrl
 * @returns {CircuitBreaker}
 */
function getBreaker(baseUrl) {
    if (!baseUrl) {
        // Return a pass-through no-op breaker when n8n is not configured
        return {
            fire: (...args) => callN8n(...args).catch(err => {
                logger.warn({ err: err.message }, '[n8n] Call failed (no circuit — n8n not configured)');
            }),
        };
    }

    if (breakers.has(baseUrl)) {
        return breakers.get(baseUrl);
    }

    const breaker = new CircuitBreaker(callN8n, CIRCUIT_OPTIONS);

    breaker.on('open', () => {
        logger.warn({ baseUrl }, '[n8n] Circuit OPEN — skipping calls until reset');
    });
    breaker.on('halfOpen', () => {
        logger.info({ baseUrl }, '[n8n] Circuit HALF-OPEN — testing recovery');
    });
    breaker.on('close', () => {
        logger.info({ baseUrl }, '[n8n] Circuit CLOSED — calls resuming normally');
    });
    breaker.fallback(() => {
        logger.warn({ baseUrl }, '[n8n] Circuit fallback — message stored, n8n skipped');
        return { skipped: true };
    });

    breakers.set(baseUrl, breaker);
    return breaker;
}

/**
 * Get stats for all circuit breakers (for health endpoint).
 */
function getCircuitStats() {
    const stats = {};
    for (const [baseUrl, breaker] of breakers.entries()) {
        const s = breaker.stats;
        stats[baseUrl] = {
            state: breaker.opened ? 'open' : (breaker.halfOpen ? 'half_open' : 'closed'),
            successes: s.successes,
            failures: s.failures,
            fallbacks: s.fallbacks,
            timeouts: s.timeouts,
            latencyMean: s.latencyMean,
        };
    }
    return stats;
}

module.exports = { getBreaker, getCircuitStats };
