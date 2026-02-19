module.exports = {
    apps: [
        {
            name: 'ai-chatbot-api',
            script: 'src/index.js',
            instances: 1,           // Single instance (no Redis Adapter for Socket.io yet)
            exec_mode: 'fork',      // Fork mode for Socket.io compatibility
            autorestart: true,      // Auto-restart on crash
            max_memory_restart: '512M', // Restart if memory exceeds 512MB
            env: {
                NODE_ENV: 'production',
            },
        },
    ],
};
