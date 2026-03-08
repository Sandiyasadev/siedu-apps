/**
 * Mock factory for utils/cache.js (Redis/ioredis)
 * Usage: jest.mock('../../utils/cache', () => require('../helpers/mockRedis').create())
 */
const create = () => ({
    getOrSet: jest.fn().mockImplementation((_key, fn) => fn()),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    delByPattern: jest.fn().mockResolvedValue(0),
    healthCheck: jest.fn().mockResolvedValue(true),
});

module.exports = { create };
