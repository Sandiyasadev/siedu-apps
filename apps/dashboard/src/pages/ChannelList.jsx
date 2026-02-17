import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE } from '../config/api'
import { Plus, Radio, Trash2, Copy, Check, Settings } from 'lucide-react'
import { getChannelType, getStatusConfig } from '../config/channels'
import ConfirmModal from '../components/ConfirmModal'

function ChannelList() {
    const { botId } = useParams()
    const { getToken } = useAuth()
    const navigate = useNavigate()
    const [channels, setChannels] = useState([])
    const [loading, setLoading] = useState(true)
    const [copiedId, setCopiedId] = useState(null)
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        fetchChannels()
    }, [botId])

    const fetchChannels = async () => {
        const token = getToken()
        try {
            const res = await fetch(`${API_BASE}/v1/bots/${botId}/channels`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            setChannels(data.channels || [])
        } catch (err) {
            console.error('Failed to fetch channels:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleToggleChannel = async (channel, e) => {
        e.stopPropagation()
        const token = getToken()
        try {
            await fetch(`${API_BASE}/v1/bots/${botId}/channels/${channel.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ is_enabled: !channel.is_enabled })
            })
            fetchChannels()
        } catch (err) {
            console.error('Failed to toggle channel:', err)
        }
    }

    const handleDeleteChannel = async () => {
        if (!deleteTarget) return
        setDeleting(true)
        const token = getToken()
        try {
            await fetch(`${API_BASE}/v1/bots/${botId}/channels/${deleteTarget.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })
            fetchChannels()
        } catch (err) {
            console.error('Failed to delete channel:', err)
        } finally {
            setDeleteTarget(null)
            setDeleting(false)
        }
    }

    const copyToClipboard = (text, id, e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(text)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const getWebhookUrl = (channel) => {
        return `${API_BASE}/v1/hooks/${channel.channel_type}/${channel.public_id}`
    }

    if (loading) {
        return (
            <div className="card" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto' }}></div>
            </div>
        )
    }

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <div>
                    <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                        Channels
                    </h2>
                    <p style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)' }}>
                        Connect your bot to messaging platforms
                    </p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => navigate(`/bots/${botId}/channels/new`)}
                >
                    <Plus size={20} />
                    Add Channel
                </button>
            </div>

            {/* Channel Grid */}
            {channels.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <Radio size={32} />
                        </div>
                        <h3>No channels yet</h3>
                        <p>Add a channel to connect your bot to messaging platforms</p>
                        <button
                            className="btn btn-primary"
                            onClick={() => navigate(`/bots/${botId}/channels/new`)}
                        >
                            <Plus size={20} />
                            Add Channel
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                    {channels.map(channel => {
                        const channelType = getChannelType(channel.channel_type)
                        const statusConfig = getStatusConfig(channel.status)
                        const Icon = channelType.icon

                        return (
                            <div
                                key={channel.id}
                                className="card"
                                style={{ cursor: 'pointer', transition: 'box-shadow 0.15s ease' }}
                                onClick={() => navigate(`/bots/${botId}/channels/${channel.id}`)}
                                onKeyDown={e => e.key === 'Enter' && navigate(`/bots/${botId}/channels/${channel.id}`)}
                                role="button"
                                tabIndex={0}
                                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                            >
                                <div className="card-body">
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
                                        {/* Icon */}
                                        <div style={{
                                            width: 48,
                                            height: 48,
                                            background: channel.is_enabled ? channelType.color : 'var(--gray-200)',
                                            borderRadius: 'var(--radius-lg)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: channel.is_enabled ? 'white' : 'var(--gray-500)',
                                            flexShrink: 0
                                        }}>
                                            <Icon size={24} />
                                        </div>

                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                                                <h3 style={{ fontWeight: 600 }}>
                                                    {channel.name || `${channelType.label} Channel`}
                                                </h3>
                                                <span style={{
                                                    fontSize: 'var(--font-size-xs)',
                                                    padding: '2px 8px',
                                                    borderRadius: 'var(--radius-full)',
                                                    background: statusConfig.bgColor,
                                                    color: statusConfig.color
                                                }}>
                                                    {statusConfig.label}
                                                </span>
                                                {!channel.is_enabled && (
                                                    <span style={{
                                                        fontSize: 'var(--font-size-xs)',
                                                        padding: '2px 8px',
                                                        borderRadius: 'var(--radius-full)',
                                                        background: 'var(--gray-100)',
                                                        color: 'var(--gray-500)'
                                                    }}>
                                                        Disabled
                                                    </span>
                                                )}
                                            </div>

                                            <p style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
                                                {channelType.description}
                                            </p>

                                            {/* Webhook URL */}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--space-2)',
                                                fontSize: 'var(--font-size-sm)'
                                            }}>
                                                <code style={{
                                                    background: 'var(--gray-100)',
                                                    padding: '4px 8px',
                                                    borderRadius: 'var(--radius-sm)',
                                                    fontSize: 'var(--font-size-xs)',
                                                    maxWidth: 400,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {getWebhookUrl(channel)}
                                                </code>
                                                <button
                                                    onClick={(e) => copyToClipboard(getWebhookUrl(channel), `url-${channel.id}`, e)}
                                                    className="btn btn-ghost"
                                                    style={{ padding: '4px 8px' }}
                                                >
                                                    {copiedId === `url-${channel.id}` ? <Check size={14} /> : <Copy size={14} />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                                            <button
                                                className="btn btn-ghost"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    navigate(`/bots/${botId}/channels/${channel.id}`)
                                                }}
                                                title="Settings"
                                            >
                                                <Settings size={16} />
                                            </button>
                                            <button
                                                className={`btn ${channel.is_enabled ? 'btn-secondary' : 'btn-primary'}`}
                                                onClick={(e) => handleToggleChannel(channel, e)}
                                                style={{ minWidth: 80 }}
                                            >
                                                {channel.is_enabled ? 'Disable' : 'Enable'}
                                            </button>
                                            <button
                                                className="btn btn-ghost"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setDeleteTarget(channel)
                                                }}
                                                style={{ color: 'var(--error-500)' }}
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <ConfirmModal
                open={Boolean(deleteTarget)}
                title="Delete channel?"
                description={`Delete "${deleteTarget?.name || 'this channel'}". This action cannot be undone.`}
                confirmLabel="Delete Permanently"
                loading={deleting}
                onConfirm={handleDeleteChannel}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    )
}

export default ChannelList
