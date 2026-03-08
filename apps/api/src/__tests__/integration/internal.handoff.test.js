'use strict';

// Environment must be set before any module load
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-32chars';
process.env.INTERNAL_API_KEY = 'test-internal-api-key-for-integration';

const request = require('supertest');
const express = require('express');

// ── Mocks (hoisted by Jest) ──────────────────────────────────────────────────

jest.mock('../../utils/db', () => ({ query: jest.fn() }));
jest.mock('../../utils/cache', () => ({
    getOrSet: jest.fn().mockImplementation((_key, fn) => fn()),
    delByPattern: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../services/socketService', () => ({
    emitNewMessage: jest.fn(),
    emitStatusChange: jest.fn(),
}));
jest.mock('../../services/channelService', () => ({
    sendToChannel: jest.fn().mockResolvedValue({ success: true }),
    sendTypingIndicator: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../services/handoffService', () => ({
    initiateHandoff: jest.fn().mockResolvedValue({ success: true }),
    assignAgent: jest.fn().mockResolvedValue({ success: true }),
    resolveHandoff: jest.fn().mockResolvedValue({ success: true }),
    returnToBot: jest.fn().mockResolvedValue({ success: true }),
    getHandoffQueue: jest.fn().mockResolvedValue([]),
    isCSAvailable: jest.fn().mockResolvedValue(true),
}));

// ── Test App Setup ────────────────────────────────────────────────────────────

const { query: mockQuery } = require('../../utils/db');
const { emitStatusChange, emitNewMessage } = require('../../services/socketService');

function buildApp() {
    const app = express();
    app.use(express.json());
    // internalRoutes must be loaded AFTER all mocks are set up
    const internalRoutes = require('../../routes/internal');
    app.use('/v1/internal', internalRoutes);
    return app;
}

const VALID_KEY = process.env.INTERNAL_API_KEY;

// ── Helpers ────────────────────────────────────────────────────────────────────

const makeMessage = (id) => ({
    id,
    conversation_id: 'conv-123',
    role: 'assistant',
    content: 'cleaned content',
    created_at: new Date().toISOString(),
    raw: {},
});

const makeConversation = (overrides = {}) => ({
    id: 'conv-123',
    bot_id: 'bot-1',
    workspace_id: 'ws-1',
    channel_type: 'web',
    status: 'bot',
    ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /v1/internal/ai-response', () => {
    let app;

    beforeEach(() => {
        jest.resetModules();
        // Re-require mocked modules after resetModules
        jest.doMock('../../utils/db', () => ({ query: mockQuery }));
        jest.doMock('../../utils/cache', () => ({
            getOrSet: jest.fn().mockImplementation((_k, fn) => fn()),
            delByPattern: jest.fn().mockResolvedValue(0),
        }));
        jest.doMock('../../services/socketService', () => ({
            emitNewMessage: emitNewMessage,
            emitStatusChange: emitStatusChange,
        }));
        jest.doMock('../../services/channelService', () => ({
            sendToChannel: jest.fn().mockResolvedValue({ success: true }),
            sendTypingIndicator: jest.fn().mockResolvedValue({}),
        }));
        jest.doMock('../../services/handoffService', () => ({
            initiateHandoff: jest.fn().mockResolvedValue({ success: true }),
        }));

        app = buildApp();
        mockQuery.mockReset();
        emitStatusChange.mockClear();
        emitNewMessage.mockClear();
    });

    test('returns 401 for missing API key', async () => {
        const res = await request(app)
            .post('/v1/internal/ai-response')
            .send({ conversation_id: 'conv-1', content: 'hello' });
        expect(res.status).toBe(401);
    });

    test('returns 401 for invalid API key', async () => {
        const res = await request(app)
            .post('/v1/internal/ai-response')
            .set('X-Internal-Key', 'wrong-key')
            .send({ conversation_id: 'conv-1', content: 'hello' });
        expect(res.status).toBe(401);
    });

    test('[HANDOFF] tag is stripped from stored content', async () => {
        const msgId = 'msg-1';
        // INSERT message query
        mockQuery.mockResolvedValueOnce({ rows: [makeMessage(msgId)], rowCount: 1 });
        // UPDATE conversations status (handoff)
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
        // SELECT conversation + bot join
        mockQuery.mockResolvedValueOnce({ rows: [makeConversation()], rowCount: 1 });

        const res = await request(app)
            .post('/v1/internal/ai-response')
            .set('X-Internal-Key', VALID_KEY)
            .send({
                conversation_id: 'conv-123',
                content: 'Maaf tidak bisa membantu [HANDOFF] silakan tunggu.',
            });

        expect(res.status).toBe(200);

        // The INSERT call should NOT contain [HANDOFF]
        const insertCall = mockQuery.mock.calls.find(c => /INSERT INTO messages/i.test(c[0]));
        expect(insertCall).toBeDefined();
        const insertedContent = insertCall[1][1]; // second param is content
        expect(insertedContent).not.toContain('[HANDOFF]');
        expect(insertedContent).toBe('Maaf tidak bisa membantu  silakan tunggu.');
    });

    test('multiple [HANDOFF] tags are all stripped', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [makeMessage('msg-2')], rowCount: 1 });
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
        mockQuery.mockResolvedValueOnce({ rows: [makeConversation()], rowCount: 1 });

        await request(app)
            .post('/v1/internal/ai-response')
            .set('X-Internal-Key', VALID_KEY)
            .send({
                conversation_id: 'conv-123',
                content: '[HANDOFF] first [HANDOFF] second [HANDOFF]',
            });

        const insertCall = mockQuery.mock.calls.find(c => /INSERT INTO messages/i.test(c[0]));
        expect(insertCall[1][1]).not.toContain('[HANDOFF]');
    });

    test('[HANDOFF] tag triggers conversation status update to human', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [makeMessage('msg-3')], rowCount: 1 });
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPDATE status
        mockQuery.mockResolvedValueOnce({ rows: [makeConversation()], rowCount: 1 });

        await request(app)
            .post('/v1/internal/ai-response')
            .set('X-Internal-Key', VALID_KEY)
            .send({
                conversation_id: 'conv-123',
                content: 'Kami akan alihkan [HANDOFF]',
            });

        // UPDATE conversations SET status = 'human' should have been called
        const updateCall = mockQuery.mock.calls.find(
            c => /UPDATE conversations/i.test(c[0]) && /human/i.test(c[0])
        );
        expect(updateCall).toBeDefined();
    });

    test('explicit handoff:true flag triggers status human', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [makeMessage('msg-4')], rowCount: 1 });
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPDATE status
        mockQuery.mockResolvedValueOnce({ rows: [makeConversation()], rowCount: 1 });

        const res = await request(app)
            .post('/v1/internal/ai-response')
            .set('X-Internal-Key', VALID_KEY)
            .send({
                conversation_id: 'conv-123',
                content: 'Agent will help you.',
                handoff: true,
            });

        expect(res.status).toBe(200);
        expect(res.body.handoff_triggered).toBe(true);
    });

    test('normal message does not update conversation status', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [makeMessage('msg-5')], rowCount: 1 });
        mockQuery.mockResolvedValueOnce({ rows: [makeConversation()], rowCount: 1 });

        await request(app)
            .post('/v1/internal/ai-response')
            .set('X-Internal-Key', VALID_KEY)
            .send({
                conversation_id: 'conv-123',
                content: 'Hello, how can I help you?',
            });

        // Should NOT have any UPDATE conversations SET status = 'human'
        const humanUpdate = mockQuery.mock.calls.find(
            c => /UPDATE conversations/i.test(c[0]) && /human/i.test(c[0])
        );
        expect(humanUpdate).toBeUndefined();
    });
});
