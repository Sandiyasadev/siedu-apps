const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { query } = require('../utils/db');

let io = null;

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
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;

        if (!token) {
            return next(new Error('Authentication required'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (err) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`[Socket] Client connected: ${socket.id} (user: ${socket.user.email})`);

        // Join conversation room - WITH OWNERSHIP CHECK
        socket.on('join:conversation', async (conversationId) => {
            try {
                // Verify conversation belongs to user's workspace
                const result = await query(
                    `SELECT c.id FROM conversations c
                     JOIN bots b ON b.id = c.bot_id
                     WHERE c.id = $1 AND b.workspace_id = $2`,
                    [conversationId, socket.user.workspace_id]
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
                socket.join(`workspace:${socket.user.workspace_id}`);
                console.log(`[Socket] Agent ${socket.user.email} joined workspace room`);
            }
        });

        // Typing indicator — only broadcast if user has joined the room
        socket.on('typing:start', ({ conversationId, role }) => {
            const roomName = `conversation:${conversationId}`;
            if (!socket.rooms.has(roomName)) return; // silently ignore
            socket.to(roomName).emit('typing:start', {
                conversationId,
                role
            });
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

    // Emit to conversation room
    io.to(`conversation:${conversationId}`).emit('message:new', message);

    // Emit to workspace room (agents)
    if (workspaceId) {
        io.to(`workspace:${workspaceId}`).emit('message:new', {
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
