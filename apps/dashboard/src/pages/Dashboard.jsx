import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { API_BASE } from '../config/api'
import { Link, useNavigate } from 'react-router-dom'
import {
    Bot, MessageSquare, Users, Clock, CheckCircle, AlertCircle,
    TrendingUp, Globe, Send, Phone, ArrowRight, Database,
    Mail, Instagram, Facebook, Inbox
} from 'lucide-react'

const CHANNEL_CONFIG = {
    web: { icon: Globe, label: 'Web', color: '#10b981' },
    telegram: { icon: Send, label: 'Telegram', color: '#0088cc' },
    whatsapp: { icon: Phone, label: 'WhatsApp', color: '#25d366' },
    instagram: { icon: Instagram, label: 'Instagram', color: '#e4405f' },
    facebook: { icon: Facebook, label: 'Facebook', color: '#1877f2' },
    email: { icon: Mail, label: 'Email', color: '#6b7280' }
}

// Active channels (others are "Coming Soon")
const ACTIVE_CHANNELS = new Set(['telegram', 'whatsapp'])

function Dashboard() {
    const { getToken } = useAuth()
    const navigate = useNavigate()
    const [stats, setStats] = useState(null)
    const [bots, setBots] = useState([])
    const [recentConversations, setRecentConversations] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        const token = getToken()

        try {
            const [statsRes, botsRes, convRes] = await Promise.all([
                fetch(`${API_BASE}/v1/conversations/stats`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_BASE}/v1/bots`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_BASE}/v1/conversations?limit=5`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ])

            const [statsData, botsData, convData] = await Promise.all([
                statsRes.json(),
                botsRes.json(),
                convRes.json()
            ])

            setStats(statsData.stats)
            setBots(botsData.bots || [])
            setRecentConversations(convData.conversations || [])
        } catch (err) {
            console.error('Failed to fetch dashboard data:', err)
        } finally {
            setLoading(false)
        }
    }

    const formatResponseTime = (seconds) => {
        if (!seconds) return '—'
        if (seconds < 60) return `${seconds}s`
        return `${Math.round(seconds / 60)}m`
    }

    const formatTime = (dateStr) => {
        if (!dateStr) return ''
        const date = new Date(dateStr)
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">Overview of your customer service operations</p>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="stats-grid mb-6">
                <div className="stat-card">
                    <div className="stat-icon primary">
                        <MessageSquare size={22} />
                    </div>
                    <div className="stat-content">
                        <h3>Total Conversations</h3>
                        <div className="stat-value">{loading ? '—' : stats?.totalConversations || 0}</div>
                        <p className="stat-change positive">
                            {stats?.todayConversations || 0} today
                        </p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon yellow">
                        <AlertCircle size={22} />
                    </div>
                    <div className="stat-content">
                        <h3>Needs Attention</h3>
                        <div className="stat-value" style={{ color: (stats?.conversationsByStatus?.handoff > 0) ? 'var(--warning-600)' : undefined }}>
                            {loading ? '—' : stats?.conversationsByStatus?.handoff || 0}
                        </div>
                        <p className="text-xs text-muted">Handoff requests</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon green">
                        <Users size={22} />
                    </div>
                    <div className="stat-content">
                        <h3>Total Contacts</h3>
                        <div className="stat-value">{loading ? '—' : stats?.totalContacts || 0}</div>
                        <p className="text-xs text-muted">Unique customers</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon blue">
                        <Clock size={22} />
                    </div>
                    <div className="stat-content">
                        <h3>Avg Response</h3>
                        <div className="stat-value">{loading ? '—' : formatResponseTime(stats?.avgResponseTimeSeconds)}</div>
                        <p className="text-xs text-muted">Today's average</p>
                    </div>
                </div>
            </div>

            {/* Two Column Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                {/* Quick Actions / Handoff Alert */}
                {(stats?.conversationsByStatus?.handoff > 0) && (
                    <div className="card" style={{ gridColumn: '1 / -1', background: 'var(--warning-50)', borderColor: 'var(--warning-200)' }}>
                        <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                <div className="stat-icon yellow">
                                    <AlertCircle size={24} />
                                </div>
                                <div>
                                    <h3 style={{ fontWeight: 600, color: 'var(--warning-700)' }}>
                                        {stats?.conversationsByStatus?.handoff} conversation{stats?.conversationsByStatus?.handoff > 1 ? 's' : ''} need attention
                                    </h3>
                                    <p className="text-sm text-muted">Customers are waiting for a human agent</p>
                                </div>
                            </div>
                            <Link to="/inbox?filter=handoff" className="btn btn-primary">
                                Go to Inbox <ArrowRight size={16} />
                            </Link>
                        </div>
                    </div>
                )}

                {/* Conversation Status */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Conversation Status</h2>
                        <Link to="/inbox" className="btn btn-ghost btn-sm">
                            View All <ArrowRight size={14} />
                        </Link>
                    </div>
                    <div className="card-body">
                        {loading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="skeleton" style={{ height: 44, borderRadius: 'var(--radius-md)' }} />
                                ))}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3)', background: 'var(--success-50)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        <CheckCircle size={18} style={{ color: 'var(--success-600)' }} />
                                        <span>Open</span>
                                    </div>
                                    <span style={{ fontWeight: 600 }}>{stats?.conversationsByStatus?.open || 0}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3)', background: 'var(--warning-50)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        <AlertCircle size={18} style={{ color: 'var(--warning-600)' }} />
                                        <span>Handoff</span>
                                    </div>
                                    <span style={{ fontWeight: 600, color: stats?.conversationsByStatus?.handoff > 0 ? 'var(--warning-600)' : undefined }}>
                                        {stats?.conversationsByStatus?.handoff || 0}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3)', background: 'var(--gray-100)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        <Clock size={18} style={{ color: 'var(--gray-500)' }} />
                                        <span>Resolved</span>
                                    </div>
                                    <span style={{ fontWeight: 600 }}>{stats?.conversationsByStatus?.closed || 0}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Channel Distribution */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">By Channel</h2>
                    </div>
                    <div className="card-body">
                        {loading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="skeleton" style={{ height: 28, borderRadius: 'var(--radius-md)' }} />
                                ))}
                            </div>
                        ) : stats?.conversationsByChannel && Object.keys(stats.conversationsByChannel).length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {Object.entries(stats.conversationsByChannel).map(([channel, count]) => {
                                    const config = CHANNEL_CONFIG[channel] || { icon: MessageSquare, label: channel, color: '#6b7280' }
                                    const Icon = config.icon
                                    const total = stats.totalConversations || 1
                                    const percentage = Math.round((count / total) * 100)

                                    return (
                                        <div key={channel}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                    <Icon size={16} style={{ color: config.color }} />
                                                    <span style={{ textTransform: 'capitalize', fontSize: 'var(--font-size-sm)' }}>{config.label}</span>
                                                </div>
                                                <span style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>{count} ({percentage}%)</span>
                                            </div>
                                            <div style={{ height: 6, background: 'var(--gray-100)', borderRadius: 'var(--radius-full)' }}>
                                                <div style={{
                                                    height: '100%',
                                                    width: `${percentage}%`,
                                                    background: config.color,
                                                    borderRadius: 'var(--radius-full)',
                                                    transition: 'width 0.3s ease'
                                                }} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                                <div className="empty-state-icon">
                                    <MessageSquare size={24} />
                                </div>
                                <p className="text-muted text-sm">No conversations yet</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Conversations */}
                <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <div className="card-header">
                        <h2 className="card-title">Recent Conversations</h2>
                        <Link to="/inbox" className="btn btn-ghost btn-sm">
                            View All <ArrowRight size={14} />
                        </Link>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                        {loading ? (
                            <div style={{ padding: 'var(--space-4)' }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="skeleton-card">
                                        <div className="skeleton skeleton-avatar" />
                                        <div style={{ flex: 1 }}>
                                            <div className="skeleton skeleton-text" style={{ width: `${50 + i * 10}%` }} />
                                            <div className="skeleton skeleton-text-sm" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : recentConversations.length > 0 ? (
                            <>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Customer</th>
                                            <th>Channel</th>
                                            <th>Bot</th>
                                            <th>Status</th>
                                            <th>Last Activity</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentConversations.map(conv => {
                                            const config = CHANNEL_CONFIG[conv.channel_type] || CHANNEL_CONFIG.web
                                            const Icon = config.icon
                                            return (
                                                <tr key={conv.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/inbox')} role="link" tabIndex={0} onKeyDown={e => e.key === 'Enter' && navigate('/inbox')}>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                            <div className="avatar avatar-sm">
                                                                <Users size={14} />
                                                            </div>
                                                            <span>{conv.external_thread_id?.slice(0, 15) || 'Guest'}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                            <Icon size={14} style={{ color: config.color }} />
                                                            <span className="text-sm">{config.label}</span>
                                                        </div>
                                                    </td>
                                                    <td className="text-sm text-muted">{conv.bot_name}</td>
                                                    <td>
                                                        <span className={`status-badge ${conv.status}`}>
                                                            {conv.status === 'handoff' ? 'Handoff' : conv.status === 'open' ? 'Open' : 'Resolved'}
                                                        </span>
                                                    </td>
                                                    <td className="text-sm text-muted">{formatTime(conv.last_user_at)}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>

                                <div className="table-mobile">
                                    {recentConversations.map(conv => {
                                        const config = CHANNEL_CONFIG[conv.channel_type] || CHANNEL_CONFIG.web
                                        const Icon = config.icon

                                        return (
                                            <button
                                                key={conv.id}
                                                type="button"
                                                className="table-mobile-card table-mobile-card-button"
                                                onClick={() => navigate('/inbox')}
                                                style={{ textAlign: 'left', width: '100%', border: 'none' }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                                                        <div className="avatar avatar-sm">
                                                            <Users size={14} />
                                                        </div>
                                                        <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {conv.external_thread_id?.slice(0, 15) || 'Guest'}
                                                        </strong>
                                                    </div>
                                                    <span className="text-sm text-muted">{formatTime(conv.last_user_at)}</span>
                                                </div>

                                                <div className="table-mobile-row">
                                                    <span>Channel</span>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                        <Icon size={14} style={{ color: config.color }} />
                                                        {config.label}
                                                    </span>
                                                </div>
                                                <div className="table-mobile-row">
                                                    <span>Bot</span>
                                                    <span>{conv.bot_name || '-'}</span>
                                                </div>
                                                <div className="table-mobile-row">
                                                    <span>Status</span>
                                                    <span className={`status-badge ${conv.status}`}>
                                                        {conv.status === 'handoff' ? 'Handoff' : conv.status === 'open' ? 'Open' : 'Resolved'}
                                                    </span>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </>
                        ) : (
                            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                                <div className="empty-state-icon">
                                    <Inbox size={24} />
                                </div>
                                <h3>No conversations yet</h3>
                                <p className="text-sm text-muted">Conversations will appear here when customers start chatting</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Quick Actions</h2>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <Link to="/bots" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                                <Bot size={18} />
                                <span>Manage AI Bots</span>
                                <ArrowRight size={14} style={{ marginLeft: 'auto' }} />
                            </Link>
                            <Link to="/knowledge-base" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                                <Database size={18} />
                                <span>Update Knowledge Base</span>
                                <ArrowRight size={14} style={{ marginLeft: 'auto' }} />
                            </Link>
                            <Link to="/inbox" className="btn btn-primary" style={{ justifyContent: 'flex-start' }}>
                                <Inbox size={18} />
                                <span>Go to Inbox</span>
                                <ArrowRight size={14} style={{ marginLeft: 'auto' }} />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Getting Started - Show if no bots */}
            {bots.length === 0 && !loading && (
                <div className="card mt-6">
                    <div className="card-header">
                        <h2 className="card-title">Get Started</h2>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)' }}>
                            <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-full)', background: 'var(--primary-100)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, flexShrink: 0 }}>1</div>
                            <div style={{ flex: 1 }}>
                                <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>Create your first AI Bot</h4>
                                <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-2)' }}>Set up an AI assistant with custom instructions and connect it to your channels.</p>
                                <Link to="/bots" className="btn btn-primary btn-sm">
                                    Create Bot <ArrowRight size={14} />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Dashboard
