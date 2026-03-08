'use strict';

// Must set JWT_SECRET BEFORE any module that imports auth.js is loaded,
// because auth.js calls process.exit(1) if the env var is missing.
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-32chars';
process.env.NODE_ENV = 'test';

const jwt = require('jsonwebtoken');

// Mock db so authenticate() doesn't need a real database
jest.mock('../../utils/db', () => ({
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));

const { validatePassword, generateAccessToken, authenticate } = require('../../middleware/auth');
const { query: mockQuery } = require('../../utils/db');

// ============================================
// validatePassword
// ============================================
describe('validatePassword()', () => {
    test('rejects password shorter than 8 chars', () => {
        expect(validatePassword('Ab1').valid).toBe(false);
    });

    test('rejects password without uppercase', () => {
        expect(validatePassword('abcdefg1').valid).toBe(false);
    });

    test('rejects password without lowercase', () => {
        expect(validatePassword('ABCDEFG1').valid).toBe(false);
    });

    test('rejects password without digit', () => {
        expect(validatePassword('Abcdefgh').valid).toBe(false);
    });

    test('accepts valid password', () => {
        expect(validatePassword('ValidPass1').valid).toBe(true);
    });

    test('rejects null/non-string input', () => {
        expect(validatePassword(null).valid).toBe(false);
        expect(validatePassword(undefined).valid).toBe(false);
        expect(validatePassword(123).valid).toBe(false);
    });
});

// ============================================
// generateAccessToken
// ============================================
describe('generateAccessToken()', () => {
    const user = {
        id: 'user-uuid-123',
        email: 'test@example.com',
        role: 'admin',
        workspace_id: 'ws-uuid-456',
    };

    test('returns a valid JWT string', () => {
        const token = generateAccessToken(user);
        expect(typeof token).toBe('string');
        expect(token.split('.').length).toBe(3); // header.payload.signature
    });

    test('payload contains expected fields', () => {
        const token = generateAccessToken(user);
        const decoded = jwt.decode(token);
        expect(decoded.userId).toBe(user.id);
        expect(decoded.email).toBe(user.email);
        expect(decoded.role).toBe(user.role);
        expect(decoded.workspace_id).toBe(user.workspace_id);
    });

    test('token verifies with the same secret', () => {
        const token = generateAccessToken(user);
        expect(() => jwt.verify(token, process.env.JWT_SECRET)).not.toThrow();
    });
});

// ============================================
// authenticate middleware
// ============================================
describe('authenticate middleware', () => {
    let req, res, next;

    beforeEach(() => {
        mockQuery.mockReset();
        req = { headers: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        next = jest.fn();
    });

    test('returns 401 when no Authorization header', async () => {
        await authenticate(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
        expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 when Authorization header has wrong format', async () => {
        req.headers.authorization = 'Basic sometoken';
        await authenticate(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 for invalid JWT', async () => {
        req.headers.authorization = 'Bearer not.a.valid.jwt';
        await authenticate(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    });

    test('returns 401 for expired JWT', async () => {
        const expiredToken = jwt.sign(
            { userId: 'u1', email: 'a@b.com', role: 'admin', workspace_id: 'ws1' },
            process.env.JWT_SECRET,
            { expiresIn: -1 } // already expired
        );
        req.headers.authorization = `Bearer ${expiredToken}`;
        await authenticate(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'TOKEN_EXPIRED' })
        );
    });

    test('returns 401 when user not found in DB', async () => {
        const token = jwt.sign(
            { userId: 'u-missing', email: 'x@x.com', role: 'admin', workspace_id: 'ws1' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        req.headers.authorization = `Bearer ${token}`;
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // user not found
        await authenticate(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'User not found or inactive' });
    });

    test('calls next() and sets req.user for valid token', async () => {
        const user = { id: 'u1', email: 'a@b.com', role: 'admin', workspace_id: 'ws1' };
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role, workspace_id: user.workspace_id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        req.headers.authorization = `Bearer ${token}`;
        mockQuery.mockResolvedValueOnce({ rows: [user], rowCount: 1 }); // user found
        await authenticate(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(req.user).toEqual(user);
    });

    test('non-admin with x-workspace-id header gets 403 (workspace override forbidden)', async () => {
        const user = { id: 'u2', email: 'b@b.com', role: 'admin', workspace_id: 'ws1' };
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role, workspace_id: user.workspace_id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        req.headers.authorization = `Bearer ${token}`;
        req.headers['x-workspace-id'] = 'ws-other';
        mockQuery.mockResolvedValueOnce({ rows: [user], rowCount: 1 }); // user found
        await authenticate(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'WORKSPACE_OVERRIDE_FORBIDDEN' })
        );
    });
});
