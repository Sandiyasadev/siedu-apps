'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-32chars';

// Use jest.useFakeTimers to control setInterval/clearInterval
jest.useFakeTimers();

// We use jest.doMock + jest.resetModules in beforeEach to get a fresh module
// instance (reset the module-level `intervalId` state) for each test.

describe('handoffScheduler', () => {
    let mockQuery;
    let mockEmitStatusChange;
    let handoffScheduler;

    beforeEach(() => {
        jest.resetModules();
        mockQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
        mockEmitStatusChange = jest.fn();

        jest.doMock('../../utils/db', () => ({ query: mockQuery }));
        jest.doMock('../../services/socketService', () => ({
            emitStatusChange: mockEmitStatusChange,
        }));

        handoffScheduler = require('../../services/handoffScheduler');
    });

    afterEach(() => {
        handoffScheduler.stopHandoffScheduler();
        jest.clearAllTimers();
        jest.clearAllMocks();
    });

    // ============================================
    // revertStaleHandoffs
    // ============================================
    describe('revertStaleHandoffs (via startHandoffScheduler)', () => {
        test('emits socket event for each reverted row', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    { id: 'conv-1', workspace_id: 'ws-1' },
                    { id: 'conv-2', workspace_id: 'ws-1' },
                ],
                rowCount: 2,
            });

            handoffScheduler.startHandoffScheduler();
            // flush the immediate revertStaleHandoffs() call
            await Promise.resolve();
            await Promise.resolve();

            expect(mockEmitStatusChange).toHaveBeenCalledTimes(2);
            expect(mockEmitStatusChange).toHaveBeenCalledWith('conv-1', 'bot', 'ws-1');
            expect(mockEmitStatusChange).toHaveBeenCalledWith('conv-2', 'bot', 'ws-1');
        });

        test('does not emit when no rows returned', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

            handoffScheduler.startHandoffScheduler();
            await Promise.resolve();
            await Promise.resolve();

            expect(mockEmitStatusChange).not.toHaveBeenCalled();
        });

        test('swallows DB errors without throwing', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

            handoffScheduler.startHandoffScheduler();
            // Should not throw
            await Promise.resolve();
            await Promise.resolve();

            expect(mockEmitStatusChange).not.toHaveBeenCalled();
        });
    });

    // ============================================
    // startHandoffScheduler
    // ============================================
    describe('startHandoffScheduler()', () => {
        test('calls setInterval', () => {
            const spy = jest.spyOn(global, 'setInterval');
            handoffScheduler.startHandoffScheduler();
            expect(spy).toHaveBeenCalledTimes(1);
        });

        test('is idempotent — second call does not create a second interval', () => {
            const spy = jest.spyOn(global, 'setInterval');
            handoffScheduler.startHandoffScheduler();
            handoffScheduler.startHandoffScheduler();
            expect(spy).toHaveBeenCalledTimes(1);
        });
    });

    // ============================================
    // stopHandoffScheduler
    // ============================================
    describe('stopHandoffScheduler()', () => {
        test('calls clearInterval after start', () => {
            const spy = jest.spyOn(global, 'clearInterval');
            handoffScheduler.startHandoffScheduler();
            handoffScheduler.stopHandoffScheduler();
            expect(spy).toHaveBeenCalledTimes(1);
        });

        test('is idempotent — second stop is a no-op', () => {
            const spy = jest.spyOn(global, 'clearInterval');
            handoffScheduler.startHandoffScheduler();
            handoffScheduler.stopHandoffScheduler();
            handoffScheduler.stopHandoffScheduler(); // should not throw or call clearInterval again
            expect(spy).toHaveBeenCalledTimes(1);
        });
    });
});
