/**
 * Timing-safe comparison utility.
 *
 * Usage:
 *   const { safeCompare } = require('../utils/crypto');
 *   if (!safeCompare(provided, expected)) return res.status(401)...
 */

const { timingSafeEqual } = require('crypto');

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 * Returns false (instead of throwing) if inputs are invalid or different lengths.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
}

module.exports = { safeCompare };
