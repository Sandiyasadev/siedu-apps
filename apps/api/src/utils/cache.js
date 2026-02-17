const IORedis = require('ioredis');

// ============================================
// Redis Cache Configuration
// ============================================

const CACHE_PREFIX = 'chatbot:cache:';
const DEFAULT_TTL = 300; // 5 minutes default

// Reuse connection from queue or create new one
let redis = null;

const getRedis = () => {
    if (!redis) {
        redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
            maxRetriesPerRequest: 3,
            retryDelayOnFailover: 100,
            lazyConnect: true,
            // Don't throw errors on connection issues
            enableOfflineQueue: true
        });

        redis.on('error', (err) => {
            console.error('❌ Redis cache error:', err.message);
        });

        redis.on('connect', () => {
            console.log('📦 Redis cache connected');
        });
    }
    return redis;
};

// ============================================
// Cache Helper Functions
// ============================================

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any|null>}
 */
const get = async (key) => {
    try {
        const client = getRedis();
        const value = await client.get(CACHE_PREFIX + key);
        if (value) {
            return JSON.parse(value);
        }
        return null;
    } catch (error) {
        console.error('Cache get error:', error.message);
        return null;
    }
};

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<boolean>}
 */
const set = async (key, value, ttl = DEFAULT_TTL) => {
    try {
        const client = getRedis();
        await client.setex(CACHE_PREFIX + key, ttl, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error('Cache set error:', error.message);
        return false;
    }
};

/**
 * Delete value from cache
 * @param {string} key - Cache key
 * @returns {Promise<boolean>}
 */
const del = async (key) => {
    try {
        const client = getRedis();
        await client.del(CACHE_PREFIX + key);
        return true;
    } catch (error) {
        console.error('Cache del error:', error.message);
        return false;
    }
};

/**
 * Delete multiple keys by pattern
 * @param {string} pattern - Key pattern (e.g., 'bot:*')
 * @returns {Promise<number>}
 */
const delByPattern = async (pattern) => {
    try {
        const client = getRedis();
        const keys = await client.keys(CACHE_PREFIX + pattern);
        if (keys.length > 0) {
            await client.del(...keys);
            return keys.length;
        }
        return 0;
    } catch (error) {
        console.error('Cache delByPattern error:', error.message);
        return 0;
    }
};

/**
 * Get or set pattern - fetch from cache or execute function
 * @param {string} key - Cache key
 * @param {Function} fn - Function to execute if cache miss
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<any>}
 */
const getOrSet = async (key, fn, ttl = DEFAULT_TTL) => {
    // Try to get from cache first
    const cached = await get(key);
    if (cached !== null) {
        return cached;
    }

    // Cache miss - execute function
    const result = await fn();
    
    // Store in cache
    await set(key, result, ttl);
    
    return result;
};

/**
 * Increment a counter
 * @param {string} key - Counter key
 * @param {number} ttl - Time to live in seconds (for new keys)
 * @returns {Promise<number>}
 */
const incr = async (key, ttl = null) => {
    try {
        const client = getRedis();
        const fullKey = CACHE_PREFIX + key;
        const value = await client.incr(fullKey);
        
        // Set TTL only if this is a new key (value is 1)
        if (ttl && value === 1) {
            await client.expire(fullKey, ttl);
        }
        
        return value;
    } catch (error) {
        console.error('Cache incr error:', error.message);
        return 0;
    }
};

// ============================================
// Specific Cache Functions
// ============================================

/**
 * Cache bot configuration
 */
const cacheBot = async (botId, botData) => {
    return set(`bot:${botId}`, botData, 600); // 10 minutes
};

const getCachedBot = async (botId) => {
    return get(`bot:${botId}`);
};

const invalidateBot = async (botId) => {
    return del(`bot:${botId}`);
};

/**
 * Cache conversation count by status
 */
const cacheConversationStats = async (workspaceId, stats) => {
    return set(`stats:${workspaceId}`, stats, 60); // 1 minute
};

const getCachedConversationStats = async (workspaceId) => {
    return get(`stats:${workspaceId}`);
};

const invalidateConversationStats = async (workspaceId) => {
    return del(`stats:${workspaceId}`);
};

/**
 * Cache channel configuration
 */
const cacheChannel = async (channelId, channelData) => {
    return set(`channel:${channelId}`, channelData, 600); // 10 minutes
};

const getCachedChannel = async (channelId) => {
    return get(`channel:${channelId}`);
};

const invalidateChannel = async (channelId) => {
    return del(`channel:${channelId}`);
};

/**
 * Rate limiting helper
 */
const checkRateLimit = async (key, maxRequests, windowSeconds) => {
    try {
        const client = getRedis();
        const fullKey = CACHE_PREFIX + `ratelimit:${key}`;
        
        const current = await client.incr(fullKey);
        
        if (current === 1) {
            await client.expire(fullKey, windowSeconds);
        }
        
        return {
            allowed: current <= maxRequests,
            current,
            limit: maxRequests,
            remaining: Math.max(0, maxRequests - current)
        };
    } catch (error) {
        console.error('Rate limit check error:', error.message);
        // Allow on error
        return { allowed: true, current: 0, limit: maxRequests, remaining: maxRequests };
    }
};

/**
 * Health check
 */
const healthCheck = async () => {
    try {
        const client = getRedis();
        await client.ping();
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * Get cache stats
 */
const getStats = async () => {
    try {
        const client = getRedis();
        const info = await client.info('stats');
        const keyspace = await client.info('keyspace');
        return { info, keyspace };
    } catch (error) {
        return null;
    }
};

module.exports = {
    // Core functions
    get,
    set,
    del,
    delByPattern,
    getOrSet,
    incr,
    
    // Specific caches
    cacheBot,
    getCachedBot,
    invalidateBot,
    cacheConversationStats,
    getCachedConversationStats,
    invalidateConversationStats,
    cacheChannel,
    getCachedChannel,
    invalidateChannel,
    
    // Utilities
    checkRateLimit,
    healthCheck,
    getStats,
    
    // Constants
    DEFAULT_TTL,
    CACHE_PREFIX
};
