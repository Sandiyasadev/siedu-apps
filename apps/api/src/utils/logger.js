'use strict';

const pino = require('pino');

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const logger = pino({
    level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
    // Skip pretty-printing in test mode (no pino-pretty worker threads in Jest)
    transport: (!isProd && !isTest)
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } }
        : undefined,
    base: { env: process.env.NODE_ENV || 'development', service: 'siedu-api' },
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.current_password',
            'req.body.new_password',
        ],
        censor: '[REDACTED]',
    },
});

module.exports = logger;
