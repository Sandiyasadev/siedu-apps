'use strict';

const pinoHttp = require('pino-http');
const { randomUUID } = require('crypto');
const logger = require('../utils/logger');

const requestLogger = pinoHttp({
    logger,
    genReqId: () => randomUUID(),
    // Expose request ID to the response so clients/n8n can correlate logs
    customSuccessMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
    customErrorMessage: (req, res, err) => `${req.method} ${req.url} → ${res.statusCode} — ${err.message}`,
    // Skip health-check noise
    autoLogging: {
        ignore: (req) => req.url === '/healthz' || req.url === '/health' || req.url === '/api/health',
    },
    // Attach req.id to response header for distributed tracing
    customAttributeKeys: { reqId: 'reqId' },
    customProps: (req) => ({
        reqId: req.id,
    }),
    // Set response header so clients get the request ID
    wrapSerializers: false,
});

// Middleware: attach X-Request-Id response header
const attachRequestId = (req, res, next) => {
    res.setHeader('x-request-id', req.id || '');
    next();
};

module.exports = { requestLogger, attachRequestId };
