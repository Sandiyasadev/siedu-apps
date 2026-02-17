module.exports = {
    apps: [
        {
            name: 'ai-chatbot-api',
            script: 'src/index.js',
            instances: 'max',       // Use all available CPU cores
            exec_mode: 'cluster',   // Enable cluster mode
            autorestart: true,      // Auto-restart on crash
            max_memory_restart: '512M', // Restart if memory exceeds 512MB
            env: {
                NODE_ENV: 'production',
            },
        },
    ],
};
