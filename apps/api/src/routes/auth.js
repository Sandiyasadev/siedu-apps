const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../utils/db');
const { generateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// POST /v1/auth/login
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
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

    const token = generateToken(user);

    res.json({
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            workspace_id: user.workspace_id
        }
    });
}));

// ============================================
// PUBLIC REGISTRATION DISABLED FOR SECURITY
// Use: docker-compose exec api node scripts/create-admin.js <email> <password> [name]
// ============================================
// router.post('/register', asyncHandler(async (req, res) => { ... }));
router.post('/register', (req, res) => {
    res.status(403).json({ error: 'Public registration is disabled. Contact your system administrator.' });
});

// GET /v1/auth/me
const { authenticate } = require('../middleware/auth');
router.get('/me', authenticate, asyncHandler(async (req, res) => {
    res.json({ user: req.user });
}));

module.exports = router;
