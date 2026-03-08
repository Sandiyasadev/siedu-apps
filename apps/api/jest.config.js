/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    resetModules: true,
    testMatch: ['**/__tests__/**/*.test.js'],
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'src/middleware/auth.js',
        'src/middleware/errorHandler.js',
        'src/services/handoffScheduler.js',
        'src/services/contactService.js',
        'src/routes/internal.js',
    ],
    coverageThreshold: {
        // Per-file minimums for directly-tested units
        'src/middleware/auth.js': { lines: 55 },
        'src/middleware/errorHandler.js': { lines: 70 },
        'src/services/handoffScheduler.js': { lines: 90 },
        'src/services/contactService.js': { lines: 65 },
        // internal.js is large — integration tests cover the critical path
        'src/routes/internal.js': { lines: 15 },
    },
};
