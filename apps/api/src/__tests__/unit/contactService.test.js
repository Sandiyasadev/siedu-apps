'use strict';

process.env.NODE_ENV = 'test';

jest.mock('../../utils/db', () => ({
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));

const { findOrCreateContact } = require('../../services/contactService');
const { query: mockQuery } = require('../../utils/db');

beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe('findOrCreateContact()', () => {
    const base = {
        workspaceId: 'ws-1',
        channelType: 'telegram',
        externalId: '12345678',
        userData: {},
    };

    test('returns existing contact without INSERT when found in DB', async () => {
        // First query (SELECT) returns a row
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'contact-existing' }], rowCount: 1 });
        // Second query (UPDATE last_seen) returns empty
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

        const result = await findOrCreateContact(base);

        expect(result).toEqual({ id: 'contact-existing', created: false });
        expect(mockQuery).toHaveBeenCalledTimes(2);
        // Ensure no INSERT happened
        const calls = mockQuery.mock.calls.map(c => c[0]);
        expect(calls.some(sql => /INSERT/i.test(sql))).toBe(false);
    });

    test('inserts new contact when not found and returns created:true', async () => {
        // SELECT returns nothing
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        // INSERT returns new id
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'contact-new' }], rowCount: 1 });

        const result = await findOrCreateContact(base);

        expect(result).toEqual({ id: 'contact-new', created: true });
        const insertCall = mockQuery.mock.calls.find(c => /INSERT/i.test(c[0]));
        expect(insertCall).toBeDefined();
    });

    test('WhatsApp externalId without + prefix gets + prepended', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'wa-contact' }], rowCount: 1 });

        await findOrCreateContact({
            ...base,
            channelType: 'whatsapp',
            externalId: '6281234567890',
        });

        const insertCall = mockQuery.mock.calls.find(c => /INSERT/i.test(c[0]));
        expect(insertCall).toBeDefined();
        // phone should be +6281234567890
        const phone = insertCall[1][4];
        expect(phone).toBe('+6281234567890');
    });

    test('WhatsApp externalId with + prefix is kept as-is', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'wa-contact-2' }], rowCount: 1 });

        await findOrCreateContact({
            ...base,
            channelType: 'whatsapp',
            externalId: '+6281234567890',
        });

        const insertCall = mockQuery.mock.calls.find(c => /INSERT/i.test(c[0]));
        const phone = insertCall[1][4];
        expect(phone).toBe('+6281234567890');
    });

    test('Telegram name is extracted from first_name + last_name', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'tg-contact' }], rowCount: 1 });

        await findOrCreateContact({
            ...base,
            channelType: 'telegram',
            userData: { first_name: 'Budi', last_name: 'Santoso' },
        });

        const insertCall = mockQuery.mock.calls.find(c => /INSERT/i.test(c[0]));
        const name = insertCall[1][3];
        expect(name).toBe('Budi Santoso');
    });

    test('Telegram name falls back to username when no first_name', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'tg-contact-2' }], rowCount: 1 });

        await findOrCreateContact({
            ...base,
            channelType: 'telegram',
            userData: { username: 'budisantoso' },
        });

        const insertCall = mockQuery.mock.calls.find(c => /INSERT/i.test(c[0]));
        const name = insertCall[1][3];
        expect(name).toBe('budisantoso');
    });
});
