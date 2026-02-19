require('dotenv').config();
const { validateEnv } = require('./config/env');
validateEnv();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');

// Import routes
const authRoutes = require('./routes/auth');
const botRoutes = require('./routes/bots');
const kbRoutes = require('./routes/kb');
const hookRoutes = require('./routes/hooks');
const healthRoutes = require('./routes/health');
const conversationRoutes = require('./routes/conversations');
const internalRoutes = require('./routes/internal');
const templateRoutes = require('./routes/templates');
const mediaRoutes = require('./routes/media');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/auth');
const { apiLimiter } = require('./middleware/rateLimiter');

// Import services
const { initSocket } = require('./services/socketService');
const { initMediaBucket } = require('./utils/storage');

const app = express();
const PORT = process.env.PORT || 8080;

// Create HTTP server for Socket.io
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Security middleware
app.use(helmet());

// CORS - use whitelist when credentials are enabled
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
    origin: corsOrigin.split(',').map(s => s.trim()),
    credentials: true
}));

// Global rate limiter
// Global rate limiter — exclude webhooks (they have their own limiter in hooks.js)
app.use('/v1', (req, res, next) => {
    if (req.path.startsWith('/hooks')) return next();
    return apiLimiter(req, res, next);
});

// Logging
app.use(morgan('combined'));

// Body parsing (capture raw body for webhook signature verification)
app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/v1/auth', authRoutes);
app.use('/v1/bots', authenticate, botRoutes);
app.use('/v1/kb', authenticate, kbRoutes);
app.use('/v1/conversations', authenticate, conversationRoutes);
app.use('/v1/templates', authenticate, templateRoutes);
app.use('/v1/media', mediaRoutes);  // Media proxy (auth inside route)
app.use('/v1/internal', internalRoutes);  // n8n internal - API key auth
app.use('/v1/hooks', hookRoutes);
app.use('/healthz', healthRoutes);
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);

// Error handler
app.use(errorHandler);

// Start server with Socket.io support
server.listen(PORT, async () => {
    console.log(`API Server running on port ${PORT}`);
    console.log(`Socket.io enabled`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

    // Initialize media bucket with lifecycle policy
    await initMediaBucket();
});

module.exports = { app, server };

