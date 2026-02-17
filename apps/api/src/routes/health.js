const express = require('express');
const { pool, getPoolStats, healthCheck } = require('../utils/db');

const router = express.Router();

// GET /healthz - Health check endpoint
router.get('/', async (req, res) => {
    const checks = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {},
        pool: getPoolStats()
    };

    // Check database
    try {
        const isHealthy = await healthCheck();
        checks.services.database = isHealthy ? 'healthy' : 'unhealthy';
        if (!isHealthy) checks.status = 'degraded';
    } catch (error) {
        checks.services.database = 'unhealthy';
        checks.status = 'degraded';
    }

    // Check Redis (optional)
    try {
        const cache = require('../utils/cache');
        const isRedisHealthy = await cache.healthCheck();
        checks.services.redis = isRedisHealthy ? 'healthy' : 'unhealthy';
        if (!isRedisHealthy) checks.status = 'degraded';
    } catch (error) {
        checks.services.redis = 'unhealthy';
        checks.status = 'degraded';
    }

    const statusCode = checks.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(checks);
});

// GET /healthz/ready - Readiness check
router.get('/ready', async (req, res) => {
    try {
        const isHealthy = await healthCheck();
        if (isHealthy) {
            res.json({ ready: true, pool: getPoolStats() });
        } else {
            res.status(503).json({ ready: false });
        }
    } catch {
        res.status(503).json({ ready: false });
    }
});

// GET /healthz/live - Liveness check
router.get('/live', (req, res) => {
    res.json({ 
        live: true,
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// GET /healthz/pool - Pool statistics (for monitoring)
router.get('/pool', (req, res) => {
    res.json({
        pool: getPoolStats(),
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
