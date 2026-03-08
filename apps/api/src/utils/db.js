const { Pool } = require('pg');
const logger = require('./logger');

// ============================================
// Connection Pool Configuration
// Optimized for production workloads
// ============================================

const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    
    // Pool sizing
    max: parseInt(process.env.DB_POOL_MAX) || 20,          // Max connections
    min: parseInt(process.env.DB_POOL_MIN) || 2,           // Min connections to keep
    
    // Timeouts
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,        // Close idle connections after 30s
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT) || 5000, // Fail if can't connect in 5s
    
    // Statement timeout to prevent long-running queries
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT) || 30000,    // 30s max query time
    
    // Keep connections alive
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    
    // Application name for monitoring
    application_name: process.env.APP_NAME || 'ai-chatbot-api',
};

const pool = new Pool(poolConfig);

// ============================================
// Pool Event Handlers
// ============================================

// Log when new client connects
pool.on('connect', () => {
    // Set session parameters for better query planning
    // Note: pool.on('connect') provides the client as first arg
});

// Log errors
pool.on('error', (err) => {
    logger.error({ err: err.message, code: err.code }, 'PostgreSQL pool error');
});

// ============================================
// Query Helper Functions
// ============================================

/**
 * Execute a query with automatic connection management
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
const query = async (text, params) => {
    const start = Date.now();
    
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        
        // Log slow queries (> 1000ms) always; all queries in dev
        if (duration > 1000) {
            logger.warn({ sql: text.substring(0, 80).replace(/\s+/g, ' '), durationMs: duration, rows: result.rowCount }, 'Slow query');
        } else if (process.env.NODE_ENV === 'development' && duration > 100) {
            logger.debug({ sql: text.substring(0, 80).replace(/\s+/g, ' '), durationMs: duration, rows: result.rowCount }, 'Query');
        }
        
        return result;
    } catch (error) {
        const duration = Date.now() - start;
        logger.error({ sql: text.substring(0, 100).replace(/\s+/g, ' '), durationMs: duration, err: error.message, code: error.code }, 'Query error');
        throw error;
    }
};

/**
 * Execute multiple queries in a transaction
 * @param {Function} callback - Function that receives a client and returns a promise
 * @returns {Promise<any>}
 */
const transaction = async (callback) => {
    const client = await pool.connect();
    const start = Date.now();
    
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error({ durationMs: Date.now() - start, err: error.message }, 'Transaction rolled back');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Get a client for manual connection management
 * Remember to release the client when done!
 * @returns {Promise<pg.PoolClient>}
 */
const getClient = async () => {
    const client = await pool.connect();
    const originalRelease = client.release.bind(client);
    
    // Monkey-patch release to track unreleased clients
    const timeout = setTimeout(() => {
        logger.warn('DB client not released within 30 seconds');
    }, 30000);
    
    client.release = () => {
        clearTimeout(timeout);
        return originalRelease();
    };
    
    return client;
};

/**
 * Get pool statistics for monitoring
 * @returns {Object}
 */
const getPoolStats = () => ({
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    maxConnections: poolConfig.max
});

/**
 * Health check - verify database is accessible
 * @returns {Promise<boolean>}
 */
const healthCheck = async () => {
    try {
        const result = await pool.query('SELECT 1 as health');
        return result.rows[0]?.health === 1;
    } catch (error) {
        logger.error({ err: error.message }, 'Database health check failed');
        return false;
    }
};

/**
 * Graceful shutdown - close all pool connections
 * @returns {Promise<void>}
 */
const shutdown = async () => {
    logger.info('Closing PostgreSQL connection pool');
    await pool.end();
    logger.info('PostgreSQL pool closed');
};

// Handle process termination
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = {
    pool,
    query,
    transaction,
    getClient,
    getPoolStats,
    healthCheck,
    shutdown
};
