/**
 * URL Validator — prevents SSRF by blocking requests to internal/private networks.
 *
 * Usage:
 *   const { validateWebhookUrl } = require('../utils/urlValidator');
 *   const result = validateWebhookUrl(url);
 *   if (!result.valid) return res.status(400).json({ error: result.error });
 */

const { URL } = require('url');
const dns = require('dns');
const { promisify } = require('util');

const dnsLookup = promisify(dns.lookup);

// RFC 1918 + link-local + loopback + metadata ranges
const BLOCKED_CIDRS = [
    { prefix: '10.', mask: 8 },
    { prefix: '172.16.', mask: 12 },
    { prefix: '172.17.', mask: 12 },
    { prefix: '172.18.', mask: 12 },
    { prefix: '172.19.', mask: 12 },
    { prefix: '172.20.', mask: 12 },
    { prefix: '172.21.', mask: 12 },
    { prefix: '172.22.', mask: 12 },
    { prefix: '172.23.', mask: 12 },
    { prefix: '172.24.', mask: 12 },
    { prefix: '172.25.', mask: 12 },
    { prefix: '172.26.', mask: 12 },
    { prefix: '172.27.', mask: 12 },
    { prefix: '172.28.', mask: 12 },
    { prefix: '172.29.', mask: 12 },
    { prefix: '172.30.', mask: 12 },
    { prefix: '172.31.', mask: 12 },
    { prefix: '192.168.', mask: 16 },
    { prefix: '127.', mask: 8 },
    { prefix: '169.254.', mask: 16 }, // link-local / cloud metadata
    { prefix: '0.', mask: 8 },
];

/**
 * Check if an IPv4 address is in a private/blocked range.
 */
function isBlockedIP(ip) {
    if (!ip) return true;

    // IPv6 loopback
    if (ip === '::1' || ip === '::') return true;

    // IPv6 private (fc00::/7)
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true;

    // IPv4-mapped IPv6 (::ffff:x.x.x.x)
    const v4Match = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    const v4 = v4Match ? v4Match[1] : ip;

    for (const cidr of BLOCKED_CIDRS) {
        if (v4.startsWith(cidr.prefix)) return true;
    }

    return false;
}

/**
 * Validate a webhook URL for safety (anti-SSRF).
 *
 * Checks:
 * 1. Must be a valid URL
 * 2. Must use https:// (or http:// only in development)
 * 3. Hostname must not resolve to a private/internal IP
 *
 * @param {string} rawUrl - The URL to validate
 * @returns {{ valid: boolean, error?: string, url?: URL }}
 */
async function validateWebhookUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') {
        return { valid: false, error: 'webhook_base_url is required' };
    }

    // 1. Parse URL
    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return { valid: false, error: 'webhook_base_url is not a valid URL' };
    }

    // 2. Scheme check
    const allowHttp = process.env.NODE_ENV === 'development';
    if (parsed.protocol !== 'https:' && !(allowHttp && parsed.protocol === 'http:')) {
        return { valid: false, error: 'webhook_base_url must use https://' };
    }

    // 3. No user:password in URL
    if (parsed.username || parsed.password) {
        return { valid: false, error: 'webhook_base_url must not contain credentials' };
    }

    // 4. DNS resolution check — block private IPs
    try {
        const { address } = await dnsLookup(parsed.hostname);
        if (isBlockedIP(address)) {
            return { valid: false, error: 'webhook_base_url must not point to a private/internal network' };
        }
    } catch (dnsErr) {
        return { valid: false, error: `webhook_base_url hostname cannot be resolved: ${parsed.hostname}` };
    }

    return { valid: true, url: parsed };
}

module.exports = { validateWebhookUrl, isBlockedIP };
