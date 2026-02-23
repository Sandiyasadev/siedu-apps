import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../App'
import { API_BASE } from '../../config/api'
import {
    Search, RefreshCw, Bot, MessageSquare, FileText,
    BookOpen, Radio, ExternalLink, AlertTriangle, ToggleLeft, ToggleRight
} from 'lucide-react'

const providerColors = {
    openai: { bg: '#ecfdf5', color: '#059669' },
    anthropic: { bg: '#f3e8ff', color: '#9333ea' },
    google: { bg: '#eff6ff', color: '#2563eb' },
}

function SABots() {
    const { getToken } = useAuth()
    const [bots, setBots] = useState([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [workspaces, setWorkspaces] = useState([])
    const [search, setSearch] = useState('')
    const [wsFilter, setWsFilter] = useState('')
    const [error, setError] = useState('')

    const headers = useCallback(() => ({
        Authorization: `Bearer ${getToken()}`
    }), [getToken])

    const fetchBots = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const params = new URLSearchParams()
            if (search) params.set('search', search)
            if (wsFilter) params.set('workspace_id', wsFilter)
            const res = await fetch(`${API_BASE}/v1/admin/bots?${params}`, { headers: headers() })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setBots(data.bots || [])
            setTotal(data.total || 0)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [search, wsFilter, headers])

    const fetchWorkspaces = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/v1/admin/workspaces`, { headers: headers() })
            const data = await res.json()
            if (res.ok) setWorkspaces(data.workspaces || [])
        } catch { }
    }, [headers])

    useEffect(() => { fetchBots() }, [fetchBots])
    useEffect(() => { fetchWorkspaces() }, [fetchWorkspaces])

    const pc = (provider) => providerColors[provider] || { bg: 'var(--gray-100)', color: 'var(--gray-600)' }

    return (
        <div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">Bot Overview</h1>
                    <p className="page-subtitle">Monitor semua bot lintas workspace — {total} bot</p>
                </div>
                <button className="btn btn-secondary" onClick={fetchBots} disabled={loading}>
                    <RefreshCw size={16} className={loading ? 'spinner' : ''} /> Muat Ulang
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

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                    <input className="form-input" placeholder="Cari bot..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 34 }} />
                </div>
                <select className="form-select" value={wsFilter} onChange={(e) => setWsFilter(e.target.value)} style={{ width: 180 }}>
                    <option value="">Semua Workspace</option>
                    {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
            </div>

            {/* Bot List */}
            {loading ? (
                <div style={{ display: 'grid', placeItems: 'center', padding: 'var(--space-8)' }}><div className="spinner" /></div>
            ) : bots.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--gray-400)' }}>
                    <Bot size={32} style={{ marginBottom: 'var(--space-2)', opacity: 0.4 }} />
                    <p className="text-sm">Tidak ada bot ditemukan</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    {bots.map(b => (
                        <div key={b.id} className="card" style={{ transition: 'box-shadow 0.15s' }}>
                            <div className="card-body" style={{ padding: 'var(--space-4) var(--space-5)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                        <div style={{
                                            width: 36, height: 36, borderRadius: 'var(--radius-lg)',
                                            background: pc(b.llm_provider).bg, color: pc(b.llm_provider).color,
                                            display: 'grid', placeItems: 'center', flexShrink: 0
                                        }}>
                                            <Bot size={18} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{b.name}</div>
                                            <span className="text-xs text-muted">{b.workspace_name}</span>
                                        </div>
                                    </div>
                                    <a
                                        href={`/w/${b.workspace_id}/bots/${b.id}`}
                                        className="btn btn-ghost btn-sm"
                                        style={{ gap: 4, fontSize: '12px' }}
                                    >
                                        Buka <ExternalLink size={12} />
                                    </a>
                                </div>

                                {/* Meta row */}
                                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', fontSize: 'var(--font-size-xs)', color: 'var(--gray-500)' }}>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                        background: pc(b.llm_provider).bg, color: pc(b.llm_provider).color,
                                        fontWeight: 500
                                    }}>
                                        {b.llm_provider}/{b.llm_model}
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        {b.handoff_enabled ? <ToggleRight size={14} style={{ color: 'var(--success-500)' }} /> : <ToggleLeft size={14} style={{ color: 'var(--gray-300)' }} />}
                                        Handoff {b.handoff_enabled ? 'ON' : 'OFF'}
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Radio size={12} /> {b.channel_count} channel
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <MessageSquare size={12} /> {b.conversation_count} percakapan
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <FileText size={12} /> {b.template_count} template
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <BookOpen size={12} /> {b.kb_source_count} KB
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default SABots
