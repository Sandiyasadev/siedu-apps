import { Send, MessageCircle, Facebook, Instagram, MessageSquare } from 'lucide-react'

export const CHANNEL_TYPES = {
    telegram: {
        label: 'Telegram',
        icon: Send,
        description: 'Connect to Telegram bot',
        color: '#0088CC',
        configFields: [
            { key: 'bot_token', label: 'Bot Token', type: 'password', placeholder: '1234567890:ABCdef...', required: true, helpText: 'Get this from @BotFather on Telegram' }
        ],
        setupInstructions: [
            'Open Telegram and search for @BotFather',
            'Send /newbot and follow the instructions',
            'Copy the Bot Token provided',
            'Paste it in the Bot Token field above',
            'After saving, register the webhook URL with Telegram'
        ],
        webhookSetup: 'curl -X POST "https://api.telegram.org/bot{BOT_TOKEN}/setWebhook?url={WEBHOOK_URL}&secret_token={SECRET}"'
    },
    whatsapp: {
        label: 'WhatsApp',
        icon: MessageCircle,
        description: 'Connect via WhatsApp Business API',
        color: '#25D366',
        configFields: [
            { key: 'phone_number_id', label: 'Phone Number ID', type: 'text', placeholder: '1234567890', required: true, helpText: 'From Meta Business Suite' },
            { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'EAABsbCS...', required: true, helpText: 'Permanent token from Meta Developer Console' },
            { key: 'verify_token', label: 'Verify Token', type: 'text', placeholder: 'my-verify-token', required: true, helpText: 'Custom string for webhook verification' },
            { key: 'app_secret', label: 'App Secret', type: 'password', placeholder: 'abc123...', required: false, helpText: 'For webhook signature verification (optional)' }
        ],
        setupInstructions: [
            'Go to Meta Business Suite and create a WhatsApp Business Account',
            'Create an app in Meta Developer Console',
            'Add WhatsApp product to your app',
            'Get Phone Number ID and Access Token',
            'Configure webhook URL in Meta Developer Console',
            'Set the Verify Token (must match the one you enter here)'
        ]
    },
    facebook: {
        label: 'Facebook Messenger',
        icon: Facebook,
        description: 'Connect to Facebook Page',
        color: '#1877F2',
        configFields: [
            { key: 'page_id', label: 'Page ID', type: 'text', placeholder: '1234567890', required: true, helpText: 'Your Facebook Page ID' },
            { key: 'page_access_token', label: 'Page Access Token', type: 'password', placeholder: 'EAABsbCS...', required: true, helpText: 'Long-lived page access token' },
            { key: 'verify_token', label: 'Verify Token', type: 'text', placeholder: 'my-verify-token', required: true, helpText: 'Custom string for webhook verification' },
            { key: 'app_secret', label: 'App Secret', type: 'password', placeholder: 'abc123...', required: false, helpText: 'For webhook signature verification (optional)' }
        ],
        setupInstructions: [
            'Go to Meta Developer Console and create an app',
            'Add Messenger product to your app',
            'Connect your Facebook Page',
            'Generate a Page Access Token',
            'Configure webhook URL with messages subscription',
            'Set the Verify Token (must match the one you enter here)'
        ]
    },
    instagram: {
        label: 'Instagram',
        icon: Instagram,
        description: 'Connect to Instagram Business Account',
        color: '#E4405F',
        configFields: [
            { key: 'business_account_id', label: 'Business Account ID', type: 'text', placeholder: '1234567890', required: true, helpText: 'Your Instagram Business Account ID' },
            { key: 'page_access_token', label: 'Page Access Token', type: 'password', placeholder: 'EAABsbCS...', required: true, helpText: 'From linked Facebook Page' },
            { key: 'verify_token', label: 'Verify Token', type: 'text', placeholder: 'my-verify-token', required: true, helpText: 'Custom string for webhook verification' },
            { key: 'app_secret', label: 'App Secret', type: 'password', placeholder: 'abc123...', required: false, helpText: 'For webhook signature verification (optional)' }
        ],
        setupInstructions: [
            'Link your Instagram Business Account to a Facebook Page',
            'Go to Meta Developer Console',
            'Add Instagram product to your app',
            'Configure webhook URL with messaging subscription',
            'Use the linked Facebook Page Access Token'
        ]
    },
    discord: {
        label: 'Discord',
        icon: MessageSquare,
        description: 'Connect to Discord bot',
        color: '#5865F2',
        configFields: [
            { key: 'bot_token', label: 'Bot Token', type: 'password', placeholder: 'MTIzNDU2Nzg5...', required: true, helpText: 'From Discord Developer Portal' },
            { key: 'application_id', label: 'Application ID', type: 'text', placeholder: '1234567890', required: true, helpText: 'Your Discord application ID' },
            { key: 'public_key', label: 'Public Key', type: 'text', placeholder: 'abc123...', required: false, helpText: 'For interaction verification' }
        ],
        setupInstructions: [
            'Go to Discord Developer Portal',
            'Create a new application',
            'Go to Bot section and create a bot',
            'Copy the Bot Token',
            'Enable required intents (Message Content, etc.)',
            'Invite bot to your server with proper permissions'
        ]
    }
}

export const STATUS_CONFIG = {
    pending_setup: { label: 'Pending Setup', color: 'var(--warning-500)', bgColor: 'var(--warning-50)' },
    connected: { label: 'Connected', color: 'var(--success-700)', bgColor: 'var(--success-50)' },
    error: { label: 'Error', color: 'var(--error-700)', bgColor: 'var(--error-50)' },
    disabled: { label: 'Disabled', color: 'var(--gray-500)', bgColor: 'var(--gray-100)' }
}

export function getChannelType(type) {
    return CHANNEL_TYPES[type] || CHANNEL_TYPES.telegram
}

export function getStatusConfig(status) {
    return STATUS_CONFIG[status] || STATUS_CONFIG.pending_setup
}
