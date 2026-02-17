import { useState, useEffect } from 'react'
import { useParams, useNavigate, useOutletContext } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE } from '../config/api'
import { ArrowLeft, Save, Copy, Check, Eye, EyeOff, Trash2, Loader2, RefreshCw } from 'lucide-react'
import { CHANNEL_TYPES, getChannelType, getStatusConfig } from '../config/channels'
import ConfirmModal from '../components/ConfirmModal'

function ChannelDetail() {
    const { botId, channelId } = useParams()
    const { bot } = useOutletContext()
    const { getToken } = useAuth()
    const navigate = useNavigate()

    const [channel, setChannel] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [name, setName] = useState('')
    const [config, setConfig] = useState({})
    const [showPasswords, setShowPasswords] = useState({})
    const [copiedId, setCopiedId] = useState(null)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [loadingConfig, setLoadingConfig] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        fetchChannel()
    }, [channelId])

    const fetchChannel = async () => {
        const token = getToken()
        try {
            const res = await fetch(`${API_BASE}/v1/bots/${botId}/channels/${channelId}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (!res.ok) {
                navigate(`/bots/${botId}/channels`)
                return
            }
            const data = await res.json()
            setChannel(data.channel)
            setName(data.channel.name || '')
        } catch (err) {
            console.error('Failed to fetch channel:', err)
            navigate(`/bots/${botId}/channels`)
        } finally {
            setLoading(false)
        }
    }

    const fetchConfig = async () => {
        setLoadingConfig(true)
        const token = getToken()
        try {
            const res = await fetch(`${API_BASE}/v1/bots/${botId}/channels/${channelId}/config`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            setConfig(data.config || {})
        } catch (err) {
            console.error('Failed to fetch config:', err)
        } finally {
            setLoadingConfig(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        setError('')
        setSuccess('')
        const token = getToken()

        try {
            const body = { name }
            if (Object.keys(config).length > 0) {
                body.config = config
            }

            const res = await fetch(`${API_BASE}/v1/bots/${botId}/channels/${channelId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(body)
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Failed to save changes')
                return
            }

            setChannel(data.channel)
            setSuccess('Changes saved successfully')
            setConfig({})
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError('Failed to save changes')
            console.error(err)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        setDeleting(true)
        const token = getToken()
        try {
            const res = await fetch(`${API_BASE}/v1/bots/${botId}/channels/${channelId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })

            if (!res.ok) {
                const data = await res.json()
                setError(data.error || 'Failed to delete channel')
                return
            }

            navigate(`/bots/${botId}/channels`)
        } catch (err) {
            setError('Failed to delete channel')
            console.error(err)
        } finally {
            setDeleting(false)
            setShowDeleteConfirm(false)
        }
    }

    const handleToggle = async () => {
        const token = getToken()
        try {
            const res = await fetch(`${API_BASE}/v1/bots/${botId}/channels/${channelId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ is_enabled: !channel.is_enabled })
            })
            const data = await res.json()
            setChannel(data.channel)
        } catch (err) {
            console.error('Failed to toggle channel:', err)
        }
    }

    const handleConfigChange = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }))
    }

    const toggleShowPassword = (key) => {
        setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const getWebhookUrl = () => {
        if (!channel) return ''
        return `${API_BASE}/v1/hooks/${channel.channel_type}/${channel.public_id}`
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
                <Loader2 size={32} className="spinner" />
            </div>
        )
    }

    if (!channel) return null

    const channelType = getChannelType(channel.channel_type)
    const statusConfig = getStatusConfig(channel.status)
    const Icon = channelType.icon
    const webhookUrl = getWebhookUrl()

    return (
        <div>
            {/* Back Button */}
            <button
                onClick={() => navigate(`/bots/${botId}/channels`)}
                className="btn btn-ghost"
                style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-1) var(--space-2)' }}
            >
                <ArrowLeft size={16} />
                Back to Channels
            </button>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <div style={{
                        width: 56,
                        height: 56,
                        background: channel.is_enabled ? channelType.color : 'var(--gray-300)',
                        borderRadius: 'var(--radius-lg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                    }}>
                        <Icon size={28} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>
                                {channel.name || `${channelType.label} Channel`}
                            </h2>
                            <span style={{
                                fontSize: 'var(--font-size-xs)',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-full)',
                                background: statusConfig.bgColor,
                                color: statusConfig.color
                            }}>
                                {statusConfig.label}
                            </span>
                        </div>
                        <p style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)' }}>
                            {channelType.description}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                        className={`btn ${channel.is_enabled ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={handleToggle}
                    >
                        {channel.is_enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                        className="btn btn-ghost"
                        onClick={() => setShowDeleteConfirm(true)}
                        style={{ color: 'var(--error-500)' }}
                    >
                        <Trash2 size={16} />
                        Delete
                    </button>
                </div>
            </div>

            {/* Messages */}
            {error && (
                <div style={{
                    background: 'var(--error-50)',
                    color: 'var(--error-700)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-4)'
                }}>
                    {error}
                </div>
            )}
            {success && (
                <div style={{
                    background: 'var(--success-50)',
                    color: 'var(--success-700)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-4)'
                }}>
                    {success}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
                {/* Left Column - Settings */}
                <div>
                    <div className="card">
                        <div className="card-body">
                            <h3 style={{ fontWeight: 600, marginBottom: 'var(--space-4)' }}>Channel Settings</h3>

                            {/* Name */}
                            <div className="form-group">
                                <label className="form-label">Channel Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                />
                            </div>

                            {/* Config Fields */}
                            {channelType.configFields.length > 0 && (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
                                        <h4 style={{ fontWeight: 600 }}>Credentials</h4>
                                        <button
                                            className="btn btn-ghost"
                                            onClick={fetchConfig}
                                            disabled={loadingConfig}
                                            style={{ padding: '4px 8px', fontSize: 'var(--font-size-sm)' }}
                                        >
                                            {loadingConfig ? <Loader2 size={14} className="spinner" /> : <RefreshCw size={14} />}
                                            {Object.keys(config).length === 0 ? 'Load to Edit' : 'Refresh'}
                                        </button>
                                    </div>

                                    {channelType.configFields.map(field => {
                                        const currentValue = config[field.key] !== undefined 
                                            ? config[field.key] 
                                            : (channel.config?.[field.key] || '')
                                        const isEditing = config[field.key] !== undefined

                                        return (
                                            <div key={field.key} className="form-group">
                                                <label className="form-label">
                                                    {field.label}
                                                    {field.required && <span style={{ color: 'var(--error-500)' }}> *</span>}
                                                </label>
                                                <div style={{ position: 'relative' }}>
                                                    <input
                                                        type={field.type === 'password' && !showPasswords[field.key] ? 'password' : 'text'}
                                                        className="form-input"
                                                        value={currentValue}
                                                        onChange={e => handleConfigChange(field.key, e.target.value)}
                                                        placeholder={field.placeholder}
                                                        disabled={Object.keys(config).length === 0 && !isEditing}
                                                        style={{ 
                                                            paddingRight: field.type === 'password' ? 40 : undefined,
                                                            opacity: Object.keys(config).length === 0 ? 0.7 : 1
                                                        }}
                                                    />
                                                    {field.type === 'password' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleShowPassword(field.key)}
                                                            style={{
                                                                position: 'absolute',
                                                                right: 8,
                                                                top: '50%',
                                                                transform: 'translateY(-50%)',
                                                                background: 'none',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                color: 'var(--gray-400)'
                                                            }}
                                                        >
                                                            {showPasswords[field.key] ? <EyeOff size={18} /> : <Eye size={18} />}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </>
                            )}

                            {/* Save Button */}
                            <button
                                className="btn btn-primary"
                                onClick={handleSave}
                                disabled={saving}
                                style={{ marginTop: 'var(--space-4)' }}
                            >
                                {saving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column - Webhook Info */}
                <div>
                    <div className="card">
                        <div className="card-body">
                            <h3 style={{ fontWeight: 600, marginBottom: 'var(--space-4)' }}>Webhook Configuration</h3>

                            {/* Webhook URL */}
                            <div className="form-group">
                                <label className="form-label">Webhook URL</label>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={webhookUrl}
                                        readOnly
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                                    >
                                        {copiedId === 'webhook' ? <Check size={16} /> : <Copy size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Secret */}
                            <div className="form-group">
                                <label className="form-label">Webhook Secret</label>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={channel.secret}
                                        readOnly
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => copyToClipboard(channel.secret, 'secret')}
                                    >
                                        {copiedId === 'secret' ? <Check size={16} /> : <Copy size={16} />}
                                    </button>
                                </div>
                                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--gray-500)', marginTop: 'var(--space-1)' }}>
                                    Use this for webhook signature verification
                                </p>
                            </div>

                            {/* Public ID */}
                            <div className="form-group">
                                <label className="form-label">Public ID</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={channel.public_id || ''}
                                    readOnly
                                />
                            </div>
                        </div>
                    </div>

                    {/* Setup Instructions */}
                    {channelType.setupInstructions && (
                        <div className="card" style={{ marginTop: 'var(--space-4)' }}>
                            <div className="card-body">
                                <h3 style={{ fontWeight: 600, marginBottom: 'var(--space-4)' }}>Setup Instructions</h3>
                                <ol style={{ paddingLeft: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--gray-600)' }}>
                                    {channelType.setupInstructions.map((instruction, i) => (
                                        <li key={i} style={{ marginBottom: 'var(--space-2)' }}>{instruction}</li>
                                    ))}
                                </ol>

                                {/* Webhook Command */}
                                {channelType.webhookSetup && (
                                    <div style={{
                                        background: 'var(--gray-900)',
                                        padding: 'var(--space-3)',
                                        borderRadius: 'var(--radius-md)',
                                        marginTop: 'var(--space-4)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                            <span style={{ color: 'var(--gray-400)', fontSize: 'var(--font-size-xs)' }}>
                                                Webhook registration command
                                            </span>
                                            <button
                                                className="btn btn-ghost"
                                                style={{ color: 'var(--gray-400)', padding: '2px 6px' }}
                                                onClick={() => copyToClipboard(
                                                    channelType.webhookSetup
                                                        .replace('{WEBHOOK_URL}', webhookUrl)
                                                        .replace('{SECRET}', channel.secret)
                                                        .replace('{BOT_TOKEN}', '<YOUR_BOT_TOKEN>'),
                                                    'command'
                                                )}
                                            >
                                                {copiedId === 'command' ? <Check size={12} /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                        <code style={{
                                            display: 'block',
                                            color: 'var(--success-400)',
                                            fontSize: 'var(--font-size-xs)',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-all'
                                        }}>
                                            {channelType.webhookSetup
                                                .replace('{WEBHOOK_URL}', webhookUrl)
                                                .replace('{SECRET}', channel.secret)
                                                .replace('{BOT_TOKEN}', '<YOUR_BOT_TOKEN>')}
                                        </code>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                open={showDeleteConfirm}
                title="Delete channel permanently?"
                description={`Delete "${channel.name || `${channelType.label} Channel`}" and disconnect all incoming messages.`}
                confirmLabel="Delete Channel"
                loading={deleting}
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </div>
    )
}

export default ChannelDetail
