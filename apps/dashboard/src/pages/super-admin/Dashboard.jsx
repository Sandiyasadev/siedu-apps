import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../App'
import { API_BASE } from '../../config/api'
import {
    Building2, Users, Bot, MessageSquare, Mail, BookOpen,
    RefreshCw, UserPlus, Plus, Zap, AlertTriangle
} from 'lucide-react'

function SADashboard() {
    const { getToken } = useAuth()
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const fetchStats = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch(`${API_BASE}/v1/admin/dashboard/stats`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal memuat stats')
            setStats(data)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [getToken])

    useEffect(() => { fetchStats() }, [fetchStats])

    const statCards = stats ? [
        { label: 'Workspaces', value: stats.workspaces?.total ?? 0, icon: Building2, color: 'primary' },
        { label: 'Users', value: `${stats.users?.active ?? 0} aktif`, icon: Users, color: 'green', sub: `${stats.users?.total ?? 0} total` },
        { label: 'Bots', value: stats.bots?.total ?? 0, icon: Bot, color: 'blue' },
        { label: 'Conversations', value: `${stats.conversations?.active ?? 0} aktif`, icon: MessageSquare, color: 'purple', sub: `${stats.conversations?.total ?? 0} total` },
        { label: 'Pesan Hari Ini', value: stats.messages?.today ?? 0, icon: Mail, color: 'yellow', sub: `${stats.messages?.week ?? 0} minggu ini` },
        { label: 'KB Sources', value: stats.kb?.sources ?? 0, icon: BookOpen, color: 'green', sub: `${stats.kb?.chunks ?? 0} chunks` },
    ] : []

    return (
        <div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">Ringkasan platform dan status real-time</p>
                </div>
                <button className="btn btn-secondary" onClick={fetchStats} disabled={loading}>
                    <RefreshCw size={16} className={loading ? 'spinner' : ''} />
                    Muat Ulang
                </button>
            </header>

            {error && (
                <div className="card" style={{ marginBottom: 'var(--space-4)', borderColor: 'var(--error-200)', background: 'var(--error-50)' }}>
                    <div className="card-body" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <AlertTriangle size={16} style={{ color: 'var(--error-600)' }} />
                        <span className="text-sm" style={{ color: 'var(--error-700)' }}>{error}</span>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            {loading && !stats ? (
                <div style={{ display: 'grid', placeItems: 'center', padding: 'var(--space-12)' }}>
                    <div className="spinner" />
                </div>
            ) : (
                <>
                    <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
                        {statCards.map((s) => {
                            const Icon = s.icon
                            return (
                                <div className="stat-card" key={s.label}>
                                    <div className={`stat-icon ${s.color}`}><Icon size={22} /></div>
                                    <div className="stat-content">
                                        <h3>{s.label}</h3>
                                        <div className="stat-value">{s.value}</div>
                                        {s.sub && <p className="text-xs text-muted">{s.sub}</p>}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Quick Actions */}
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--gray-500)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>
                            Quick Actions
                        </h3>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                            <a href="/sa/users" className="btn btn-secondary"><UserPlus size={16} /> Tambah User</a>
                            <a href="/sa/workspaces" className="btn btn-secondary"><Plus size={16} /> Tambah Workspace</a>
                            <a href="/sa/overview" className="btn btn-secondary"><Zap size={16} /> Bootstrap Presets</a>
                        </div>
                    </div>

                    {/* Info Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
                        {/* Handoff Alert */}
                        <div className="card">
                            <div className="card-body" style={{ padding: 'var(--space-4) var(--space-5)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                                    <MessageSquare size={18} style={{ color: 'var(--warning-600)' }} />
                                    <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Handoff Queue</span>
                                </div>
                                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: (stats?.conversations?.handoff_pending || 0) > 0 ? 'var(--warning-600)' : 'var(--gray-400)' }}>
                                    {stats?.conversations?.handoff_pending ?? 0}
                                </div>
                                <p className="text-xs text-muted">percakapan menunggu handoff</p>
                            </div>
                        </div>

                        {/* Presets Summary */}
                        <div className="card">
                            <div className="card-body" style={{ padding: 'var(--space-4) var(--space-5)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                                    <BookOpen size={18} style={{ color: 'var(--primary-600)' }} />
                                    <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Presets</span>
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>{stats?.presets?.taxonomy?.published ?? 0}</div>
                                        <p className="text-xs text-muted">Taxonomy published</p>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>{stats?.presets?.template?.published ?? 0}</div>
                                        <p className="text-xs text-muted">Template published</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* KB Health */}
                        {(stats?.kb?.errors ?? 0) > 0 && (
                            <div className="card" style={{ borderColor: 'var(--warning-200)' }}>
                                <div className="card-body" style={{ padding: 'var(--space-4) var(--space-5)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                        <AlertTriangle size={18} style={{ color: 'var(--warning-600)' }} />
                                        <div>
                                            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>KB Error</span>
                                            <p className="text-xs text-muted">{stats.kb.errors} source gagal diindex</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

export default SADashboard
