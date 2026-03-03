const runtimeEnv = process.env.NODE_ENV || 'development';
const isDevNoLimit = runtimeEnv === 'development';

if (isDevNoLimit) {
    const passthroughLimiter = (req, res, next) => next();

    module.exports = {
        apiLimiter: passthroughLimiter,
        authLimiter: passthroughLimiter,
        loginLimiter: passthroughLimiter,
        webhookLimiter: passthroughLimiter,
        uploadLimiter: passthroughLimiter,
    };
} else {
    const rateLimit = require('express-rate-limit');
    const { RedisStore } = require('rate-limit-redis');
    const IORedis = require('ioredis');

    // ============================================
    // Redis Client for Rate Limiting
    // Separate from cache.js to avoid circular deps
    // ============================================
    let redisClient = null;

    const getRedisClient = () => {
        if (!redisClient) {
            redisClient = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
                maxRetriesPerRequest: 3,
                enableOfflineQueue: true,
                lazyConnect: true,
            });
            redisClient.on('error', (err) => {
                console.error('🚦 Rate limiter Redis error:', err.message);
            });
        }
        return redisClient;
    };

    // Helper to create a rate limiter with Redis store
    const createLimiter = (options) => {
        return rateLimit({
            ...options,
            standardHeaders: true,
            legacyHeaders: false,
            passOnStoreError: true, // fail-open: allow traffic if Redis is down
            store: new RedisStore({
                sendCommand: (...args) => getRedisClient().call(...args),
                prefix: 'rl:', // rate-limit prefix in Redis
            }),
        });
    };

    // General API rate limiter
    const apiLimiter = createLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 500, // limit each IP to 500 requests per window
        message: { error: 'Too many requests, please try again later.' },
    });

    // Auth endpoints rate limiter — global per IP (fallback)
    const authLimiter = createLimiter({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10, // 10 login attempts per hour per IP
        message: { error: 'Too many login attempts, please try again later.' },
    });

    // Login rate limiter — per IP+email combo (stricter, per-account protection)
    const loginLimiter = createLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 attempts per 15 min per IP+email
        message: { error: 'Too many login attempts for this account. Please try again in 15 minutes.' },
        keyGenerator: (req) => {
            const email = (req.body?.email || 'unknown').toLowerCase().trim();
            const ip = req.ip || req.headers?.['x-forwarded-for'] || 'unknown';
            return `login:${ip}:${email}`;
        },
    });

    // Webhook rate limiter (per channel path, lenient for integrations)
    const webhookLimiter = createLimiter({
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 600, // 600 requests per minute per channel
        message: { error: 'Webhook rate limit exceeded.' },
        keyGenerator: (req) => {
            // Key by channel path (e.g. "/v1/hooks/whatsapp/669bb048")
            // so each bot/channel gets its own rate limit bucket
            return req.originalUrl || req.path;
        },
    });

    // Upload rate limiter
    const uploadLimiter = createLimiter({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 50, // 50 uploads per hour
        message: { error: 'Upload rate limit exceeded.' },
    });

    module.exports = {
        apiLimiter,
        authLimiter,
        loginLimiter,
        webhookLimiter,
        uploadLimiter
    };
}
