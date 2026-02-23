const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../utils/db');
const {
    generateAccessToken,
    generateRefreshToken,
    validateRefreshToken,
    revokeRefreshToken,
    revokeAllUserRefreshTokens,
    updateLastLogin,
    authenticate,
} = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { authLimiter, loginLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// POST /v1/auth/login
router.post('/login', authLimiter, loginLimiter, asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await query(
        'SELECT id, email, name, role, password_hash, workspace_id FROM users WHERE email = $1 AND is_active = true',
        [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user, req);

    // Track last login
    await updateLastLogin(user.id, req);

    res.json({
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            workspace_id: user.workspace_id
        }
    });
}));

// POST /v1/auth/refresh — exchange refresh token for new access + refresh tokens
router.post('/refresh', asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
    }

    // Validate and rotate
    const user = await validateRefreshToken(refreshToken);
    if (!user) {
        return res.status(401).json({ error: 'Invalid or expired refresh token', code: 'REFRESH_INVALID' });
    }

    // Issue new pair
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = await generateRefreshToken(user, req);

    res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
    });
}));

// POST /v1/auth/logout — revoke refresh token(s)
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
    const { refreshToken, all } = req.body;

    if (all) {
        // Revoke all sessions for this user
        await revokeAllUserRefreshTokens(req.user.id);
    } else if (refreshToken) {
        await revokeRefreshToken(refreshToken);
    } else {
        // Fallback: revoke all
        await revokeAllUserRefreshTokens(req.user.id);
    }

    res.json({ success: true });
}));

// ============================================
// PUBLIC REGISTRATION DISABLED FOR SECURITY
// Use: docker-compose exec api node scripts/create-admin.js <email> <password> [name] [role]
// ============================================
router.post('/register', (req, res) => {
    res.status(403).json({ error: 'Public registration is disabled. Contact your system administrator.' });
});

// GET /v1/auth/me
router.get('/me', authenticate, asyncHandler(async (req, res) => {
    res.json({ user: req.user });
}));

module.exports = router;
