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
    max: 100, // limit each IP to 100 requests per window
    message: { error: 'Too many requests, please try again later.' },
});

// Auth endpoints rate limiter (stricter)
const authLimiter = createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 login attempts per hour
    message: { error: 'Too many login attempts, please try again later.' },
});

// Webhook rate limiter (more lenient for integrations)
const webhookLimiter = createLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: { error: 'Webhook rate limit exceeded.' },
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
    webhookLimiter,
    uploadLimiter
};
