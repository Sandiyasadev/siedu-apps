import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../App'
import { API_BASE } from '../../config/api'
import {
    RefreshCw, ScrollText, Search, AlertTriangle, ChevronDown, ChevronRight
} from 'lucide-react'

function relativeTime(iso) {
    if (!iso) return '—'
    const now = new Date()
    const then = new Date(iso)
    const diff = Math.floor((now - then) / 1000)
    if (diff < 60) return 'baru saja'
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`
    if (diff < 172800) return 'kemarin'
    return then.toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' })
}

function SAAuditLogs() {
    const { getToken } = useAuth()
    const [logs, setLogs] = useState([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [workspaces, setWorkspaces] = useState([])
    const [filters, setFilters] = useState({ workspace_id: '', actor: '', action: '' })
    const [error, setError] = useState('')
    const [expandedId, setExpandedId] = useState(null)

    const headers = useCallback(() => ({
        Authorization: `Bearer ${getToken()}`
    }), [getToken])

    const fetchLogs = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const params = new URLSearchParams()
            if (filters.workspace_id) params.set('workspace_id', filters.workspace_id)
            if (filters.actor) params.set('actor', filters.actor)
            if (filters.action) params.set('action', filters.action)
            const res = await fetch(`${API_BASE}/v1/admin/audit-logs?${params}`, { headers: headers() })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setLogs(data.logs || [])
            setTotal(data.total || 0)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [filters, headers])

    const fetchWorkspaces = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/v1/admin/workspaces`, { headers: headers() })
            const data = await res.json()
            if (res.ok) setWorkspaces(data.workspaces || [])
        } catch { }
    }, [headers])

    useEffect(() => { fetchLogs() }, [fetchLogs])
    useEffect(() => { fetchWorkspaces() }, [fetchWorkspaces])

    return (
        <div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">Audit Logs</h1>
                    <p className="page-subtitle">Riwayat aktivitas admin — {total} entries</p>
                </div>
                <button className="btn btn-secondary" onClick={fetchLogs} disabled={loading}>
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

            {/* Filters */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <select className="form-select" value={filters.workspace_id} onChange={(e) => setFilters(f => ({ ...f, workspace_id: e.target.value }))} style={{ width: 180 }}>
                    <option value="">Semua Workspace</option>
                    {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <input className="form-input" placeholder="Filter aktor..." value={filters.actor} onChange={(e) => setFilters(f => ({ ...f, actor: e.target.value }))} style={{ width: 180 }} />
                <input className="form-input" placeholder="Filter aksi..." value={filters.action} onChange={(e) => setFilters(f => ({ ...f, action: e.target.value }))} style={{ width: 180 }} />
            </div>

            {/* Table */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    {loading ? (
                        <div style={{ display: 'grid', placeItems: 'center', padding: 'var(--space-8)' }}><div className="spinner" /></div>
                    ) : logs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--gray-400)' }}>
                            <ScrollText size={32} style={{ marginBottom: 'var(--space-2)', opacity: 0.4 }} />
                            <p className="text-sm">Tidak ada audit log ditemukan</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 30 }} />
                                        <th>Waktu</th>
                                        <th>Aktor</th>
                                        <th>Aksi</th>
                                        <th>Entity</th>
                                        <th>Workspace</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map(log => (
                                        <>
                                            <tr key={log.id} style={{ cursor: log.metadata && Object.keys(log.metadata).length > 0 ? 'pointer' : undefined }}
                                                onClick={() => { if (log.metadata && Object.keys(log.metadata).length > 0) setExpandedId(expandedId === log.id ? null : log.id) }}>
                                                <td>
                                                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                                                        expandedId === log.id ? <ChevronDown size={14} style={{ color: 'var(--gray-400)' }} /> : <ChevronRight size={14} style={{ color: 'var(--gray-400)' }} />
                                                    )}
                                                </td>
                                                <td>
                                                    <span className="text-xs text-muted">{relativeTime(log.created_at)}</span>
                                                </td>
                                                <td className="text-sm">{log.actor || '—'}</td>
                                                <td>
                                                    <span style={{
                                                        display: 'inline-block', padding: '1px 8px', borderRadius: 'var(--radius-full)',
                                                        background: 'var(--gray-100)', fontSize: '11px', fontWeight: 500, color: 'var(--gray-600)'
                                                    }}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="text-sm text-muted">{log.entity_type ? `${log.entity_type}${log.entity_id ? `:${log.entity_id.slice(0, 8)}` : ''}` : '—'}</td>
                                                <td className="text-sm text-muted">{log.workspace_name || '—'}</td>
                                            </tr>
                                            {expandedId === log.id && (
                                                <tr key={`${log.id}-detail`}>
                                                    <td colSpan={6} style={{ background: 'var(--gray-50)', padding: 'var(--space-3) var(--space-4)' }}>
                                                        <pre style={{ fontSize: '11px', color: 'var(--gray-600)', margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>
                                                            {JSON.stringify(log.metadata, null, 2)}
                                                        </pre>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default SAAuditLogs
