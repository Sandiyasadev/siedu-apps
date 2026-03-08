'use strict';

process.env.NODE_ENV = 'test';

const { errorHandler, AppError, asyncHandler } = require('../../middleware/errorHandler');

describe('AppError', () => {
    test('creates error with message and status', () => {
        const err = new AppError('Not found', 404);
        expect(err.message).toBe('Not found');
        expect(err.status).toBe(404);
        expect(err.name).toBe('AppError');
        expect(err instanceof Error).toBe(true);
    });

    test('defaults status to 500', () => {
        const err = new AppError('Oops');
        expect(err.status).toBe(500);
    });
});

describe('asyncHandler', () => {
    test('passes resolved value through', async () => {
        const fn = jest.fn().mockResolvedValue('ok');
        const wrapped = asyncHandler(fn);
        const req = {};
        const res = {};
        const next = jest.fn();
        await wrapped(req, res, next);
        expect(fn).toHaveBeenCalledWith(req, res, next);
        expect(next).not.toHaveBeenCalled();
    });

    test('calls next(err) when async function rejects', async () => {
        const err = new Error('async error');
        const fn = jest.fn().mockRejectedValue(err);
        const wrapped = asyncHandler(fn);
        const next = jest.fn();
        await wrapped({}, {}, next);
        expect(next).toHaveBeenCalledWith(err);
    });
});

describe('errorHandler middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = { path: '/test', method: 'GET' };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        next = jest.fn();
        // Suppress pino output noise during tests
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('returns 400 for ValidationError', () => {
        const err = new Error('bad input');
        err.name = 'ValidationError';
        err.details = [{ msg: 'required' }];
        errorHandler(err, req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'Validation failed' })
        );
    });

    test('returns 400 for PostgreSQL constraint error (23xxx)', () => {
        const err = new Error('duplicate key');
        err.code = '23505';
        errorHandler(err, req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns error status from err.status', () => {
        const err = new AppError('Not found', 404);
        errorHandler(err, req, res, next);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'Not found' })
        );
    });

    test('returns 500 for unhandled errors', () => {
        const err = new Error('something broke');
        errorHandler(err, req, res, next);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
