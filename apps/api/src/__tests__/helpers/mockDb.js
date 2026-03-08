/**
 * Mock factory for utils/db.js
 * Usage in test file (must be called before any require of files that use db):
 *   jest.mock('../../utils/db', () => require('../helpers/mockDb').create())
 * Then access mocks via: const { query } = require('../../utils/db')
 */
const create = () => ({
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    transaction: jest.fn(),
});

module.exports = { create };
