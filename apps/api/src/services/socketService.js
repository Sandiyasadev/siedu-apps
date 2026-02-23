const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { query } = require('../utils/db');

let io = null;
const SOCKET_WORKSPACE_OVERRIDE_KEY = 'workspaceId';

const normalizeSocketWorkspaceOverride = (value) => {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed === '' ? null : trimmed;
};

async function resolveSocketEffectiveWorkspace(decoded, handshakeAuth = {}) {
    const actorWorkspaceId = decoded?.workspace_id || null;
    const requestedWorkspaceId = normalizeSocketWorkspaceOverride(
        handshakeAuth?.[SOCKET_WORKSPACE_OVERRIDE_KEY]
    );

    if (!requestedWorkspaceId) {
        return {
            actorWorkspaceId,
            effectiveWorkspaceId: actorWorkspaceId,
            overrideRequested: false,
            overrideApplied: false,
            overrideWorkspace: null
        };
    }

    if (decoded?.role !== 'super_admin') {
        const err = new Error('Workspace override is only allowed for super_admin');
        err.code = 'WORKSPACE_OVERRIDE_FORBIDDEN';
        throw err;
    }

    const workspaceResult = await query(
        'SELECT id, name, slug FROM workspaces WHERE id = $1 LIMIT 1',
        [requestedWorkspaceId]
    );

    if (workspaceResult.rows.length === 0) {
        const err = new Error('Workspace override target not found');
        err.code = 'WORKSPACE_OVERRIDE_NOT_FOUND';
        throw err;
    }

    const workspace = workspaceResult.rows[0];
    return {
        actorWorkspaceId,
        effectiveWorkspaceId: workspace.id,
        overrideRequested: true,
        overrideApplied: workspace.id !== actorWorkspaceId,
        overrideWorkspace: workspace
    };
}

// ============================================
// Initialize Socket.io
// ============================================
function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
            methods: ['GET', 'POST'],
            credentials: true
        },
        path: '/socket.io'
    });

    // Authentication middleware - JWT REQUIRED
    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new Error('Authentication required'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const workspaceCtx = await resolveSocketEffectiveWorkspace(decoded, socket.handshake.auth);
            socket.user = {
                ...decoded,
                actor_workspace_id: workspaceCtx.actorWorkspaceId,
                effective_workspace_id: workspaceCtx.effectiveWorkspaceId,
                workspace_override_requested: workspaceCtx.overrideRequested,
                workspace_override_applied: workspaceCtx.overrideApplied,
                override_workspace: workspaceCtx.overrideWorkspace,
            };
            next();
        } catch (err) {
            console.warn('[Socket] Authentication error:', err.code || err.message);
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`[Socket] Client connected: ${socket.id} (user: ${socket.user.email}, workspace: ${socket.user.effective_workspace_id || socket.user.workspace_id})`);

        // Join conversation room - WITH OWNERSHIP CHECK
        socket.on('join:conversation', async (conversationId) => {
            try {
                // Verify conversation belongs to user's workspace
                const result = await query(
                    `SELECT c.id FROM conversations c
                     JOIN bots b ON b.id = c.bot_id
                     WHERE c.id = $1 AND b.workspace_id = $2`,
                    [conversationId, socket.user.effective_workspace_id || socket.user.workspace_id]
                );

                if (result.rows.length === 0) {
                    socket.emit('error', { message: 'Access denied: conversation not found in your workspace' });
                    console.log(`[Socket] DENIED: ${socket.user.email} tried to join conversation:${conversationId}`);
                    return;
                }

                socket.join(`conversation:${conversationId}`);
                console.log(`[Socket] ${socket.id} joined conversation:${conversationId}`);
            } catch (err) {
                console.error(`[Socket] Error verifying conversation access:`, err.message);
                socket.emit('error', { message: 'Failed to join conversation' });
            }
        });

        // Leave conversation room
        socket.on('leave:conversation', (conversationId) => {
            socket.leave(`conversation:${conversationId}`);
        });

        // Join agent room (for all conversations in workspace)
        socket.on('join:agent', () => {
            if (socket.user) {
                const workspaceId = socket.user.effective_workspace_id || socket.user.workspace_id;
                socket.join(`workspace:${workspaceId}`);
                console.log(`[Socket] Agent ${socket.user.email} joined workspace room:${workspaceId}`);
            }
        });

        // Typing indicator — broadcast to other dashboard users AND forward to external channel
        socket.on('typing:start', ({ conversationId, role }) => {
            const roomName = `conversation:${conversationId}`;
            if (!socket.rooms.has(roomName)) return; // silently ignore
            socket.to(roomName).emit('typing:start', {
                conversationId,
                role
            });

            // Forward agent typing to external channel (WhatsApp/Telegram)
            if (role === 'agent') {
                // Lazy import to avoid circular dependency
                const { sendTypingIndicator } = require('./channelService');
                sendTypingIndicator(conversationId).catch(() => { });
            }
        });

        socket.on('typing:stop', ({ conversationId, role }) => {
            const roomName = `conversation:${conversationId}`;
            if (!socket.rooms.has(roomName)) return; // silently ignore
            socket.to(roomName).emit('typing:stop', {
                conversationId,
                role
            });
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] Client disconnected: ${socket.id}`);
        });
    });

    console.log('🔌 Socket.io initialized');
    return io;
}

// ============================================
// Emit Events (untuk dipakai di routes)
// ============================================

// New message event
function emitNewMessage(conversationId, message, workspaceId = null) {
    if (!io) return;

    // Emit to conversation room (agents with chat open)
    io.to(`conversation:${conversationId}`).emit('message:new', message);

    // Emit to workspace room (agents on inbox list)
    // .except() prevents double delivery to agents already in the conversation room
    if (workspaceId) {
        io.to(`workspace:${workspaceId}`).except(`conversation:${conversationId}`).emit('message:new', {
            ...message,
            conversation_id: conversationId
        });
    }
}

// Conversation status change
function emitStatusChange(conversationId, status, workspaceId = null) {
    if (!io) return;

    io.to(`conversation:${conversationId}`).emit('status:change', {
        conversationId,
        status
    });

    if (workspaceId) {
        io.to(`workspace:${workspaceId}`).emit('conversation:update', {
            id: conversationId,
            status
        });
    }
}

// Message status update (sent, delivered, read, failed)
function emitMessageStatus(conversationId, messageId, status, workspaceId = null) {
    if (!io) return;
    const payload = { message_id: messageId, status };
    io.to(`conversation:${conversationId}`).emit('message:status', payload);
    if (workspaceId) {
        io.to(`workspace:${workspaceId}`).emit('message:status', { ...payload, conversation_id: conversationId });
    }
}

// New conversation (for agents)
function emitNewConversation(workspaceId, conversation) {
    if (!io) return;
    io.to(`workspace:${workspaceId}`).emit('conversation:new', conversation);
}

// Get io instance
function getIO() {
    return io;
}

module.exports = {
    initSocket,
    emitNewMessage,
    emitStatusChange,
    emitMessageStatus,
    emitNewConversation,
    getIO
};
