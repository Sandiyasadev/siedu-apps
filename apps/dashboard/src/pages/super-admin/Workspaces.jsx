import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../App'
import { API_BASE } from '../../config/api'
import {
    Plus, Search, X, Building2, Users, Bot, ChevronRight,
    RefreshCw, Edit2, CheckCircle2, AlertTriangle, Boxes
} from 'lucide-react'

function SAWorkspaces() {
    const { getToken } = useAuth()
    const [workspaces, setWorkspaces] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [notice, setNotice] = useState(null)
    const [modal, setModal] = useState(null)
    const [form, setForm] = useState({ name: '', slug: '' })
    const [editWs, setEditWs] = useState(null)
    const [saving, setSaving] = useState(false)
    const [detail, setDetail] = useState(null)
    const [detailLoading, setDetailLoading] = useState(false)

    const headers = useCallback(() => ({
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
    }), [getToken])

    const fetchWorkspaces = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`${API_BASE}/v1/admin/workspaces`, { headers: headers() })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setWorkspaces(data.workspaces || [])
        } catch (err) {
            setNotice({ type: 'error', message: err.message })
        } finally {
            setLoading(false)
        }
    }, [headers])

    useEffect(() => { fetchWorkspaces() }, [fetchWorkspaces])

    const openCreate = () => {
        setForm({ name: '', slug: '' })
        setEditWs(null)
        setModal('create')
    }
    const openEdit = (ws) => {
        setForm({ name: ws.name, slug: ws.slug || '' })
        setEditWs(ws)
        setModal('edit')
    }

    const openDetail = async (ws) => {
        setDetail(null)
        setDetailLoading(true)
        try {
            const res = await fetch(`${API_BASE}/v1/admin/workspaces/${ws.id}/detail`, { headers: headers() })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setDetail(data)
        } catch (err) {
            setNotice({ type: 'error', message: err.message })
        } finally {
            setDetailLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            const url = modal === 'create' ? `${API_BASE}/v1/admin/workspaces` : `${API_BASE}/v1/admin/workspaces/${editWs.id}`
            const method = modal === 'create' ? 'POST' : 'PATCH'
            const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(form) })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setNotice({ type: 'success', message: `Workspace "${data.workspace.name}" berhasil ${modal === 'create' ? 'dibuat' : 'diperbarui'}` })
            setModal(null)
            fetchWorkspaces()
        } catch (err) {
            setNotice({ type: 'error', message: err.message })
        } finally {
            setSaving(false)
        }
    }

    const filtered = search
        ? workspaces.filter(w => w.name.toLowerCase().includes(search.toLowerCase()) || (w.slug || '').toLowerCase().includes(search.toLowerCase()))
        : workspaces

    return (
        <div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">Workspaces</h1>
                    <p className="page-subtitle">Kelola workspace dan lihat detail tenant</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Tambah Workspace</button>
            </header>

            {notice && (
                <div className="card" style={{ marginBottom: 'var(--space-4)', borderColor: notice.type === 'success' ? 'var(--success-200)' : 'var(--error-200)', background: notice.type === 'success' ? 'var(--success-50)' : 'var(--error-50)' }}>
                    <div className="card-body" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        {notice.type === 'success' ? <CheckCircle2 size={16} style={{ color: 'var(--success-700)' }} /> : <AlertTriangle size={16} style={{ color: 'var(--error-700)' }} />}
                        <span className="text-sm" style={{ color: notice.type === 'success' ? 'var(--success-700)' : 'var(--error-700)', flex: 1 }}>{notice.message}</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => setNotice(null)}><X size={14} /></button>
                    </div>
                </div>
            )}

            {/* Search */}
            <div style={{ position: 'relative', maxWidth: 320, marginBottom: 'var(--space-4)' }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                <input className="form-input" placeholder="Cari workspace..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 34 }} />
            </div>

            {/* Workspace Grid + Detail */}
            <div style={{ display: 'grid', gridTemplateColumns: detail ? '1fr 380px' : '1fr', gap: 'var(--space-4)' }}>
                {/* Cards */}
                <div>
                    {loading ? (
                        <div style={{ display: 'grid', placeItems: 'center', padding: 'var(--space-8)' }}><div className="spinner" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--gray-400)' }}>
                            <Building2 size={32} style={{ marginBottom: 'var(--space-2)', opacity: 0.4 }} />
                            <p className="text-sm">Tidak ada workspace ditemukan</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
                            {filtered.map(ws => (
                                <div key={ws.id} className="card"
                                    style={{ cursor: 'pointer', transition: 'box-shadow 0.15s', border: detail?.workspace?.id === ws.id ? '2px solid var(--primary-400)' : undefined }}
                                    onClick={() => openDetail(ws)}
                                >
                                    <div className="card-body" style={{ padding: 'var(--space-4)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                                            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{ws.name}</div>
                                            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                                <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); openEdit(ws) }} title="Edit">
                                                    <Edit2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                        {ws.slug && <p className="text-xs text-muted" style={{ marginBottom: 'var(--space-2)' }}>/{ws.slug}</p>}
                                        <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--gray-500)' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={12} /> {ws.user_count ?? 0}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Bot size={12} /> {ws.bot_count ?? 0}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Detail Panel */}
                {(detail || detailLoading) && (
                    <div className="card" style={{ position: 'sticky', top: 'var(--space-6)', alignSelf: 'start', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
                        <div className="card-header">
                            <h3 className="card-title">{detail?.workspace?.name || 'Loading...'}</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}><X size={16} /></button>
                        </div>
                        {detailLoading ? (
                            <div className="card-body" style={{ display: 'grid', placeItems: 'center', padding: 'var(--space-6)' }}><div className="spinner" /></div>
                        ) : detail && (
                            <div className="card-body" style={{ padding: 'var(--space-4)' }}>
                                <p className="text-xs text-muted" style={{ marginBottom: 'var(--space-4)' }}>
                                    Slug: {detail.workspace.slug || '—'} · Dibuat: {new Date(detail.workspace.created_at).toLocaleDateString('id')}
                                </p>

                                {/* Assignment */}
                                <div style={{ marginBottom: 'var(--space-4)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-2)' }}>
                                        <Boxes size={14} style={{ color: 'var(--primary-600)' }} />
                                        <span style={{ fontWeight: 600, fontSize: '12px' }}>Preset Assignment</span>
                                    </div>
                                    {detail.assignment ? (
                                        <div className="text-xs text-muted" style={{ lineHeight: 1.6 }}>
                                            Taxonomy: {detail.assignment.taxonomy_preset_name || '—'}<br />
                                            Template: {detail.assignment.template_preset_name || '—'}
                                        </div>
                                    ) : <p className="text-xs" style={{ color: 'var(--warning-600)' }}>Belum ada preset assignment</p>}
                                </div>

                                {/* Users */}
                                <div style={{ marginBottom: 'var(--space-4)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-2)' }}>
                                        <Users size={14} style={{ color: 'var(--primary-600)' }} />
                                        <span style={{ fontWeight: 600, fontSize: '12px' }}>Users ({detail.users?.length || 0})</span>
                                    </div>
                                    {(detail.users || []).map(u => (
                                        <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--gray-100)', fontSize: '12px' }}>
                                            <span>{u.email}</span>
                                            <span className="text-muted">{u.role}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Bots */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-2)' }}>
                                        <Bot size={14} style={{ color: 'var(--primary-600)' }} />
                                        <span style={{ fontWeight: 600, fontSize: '12px' }}>Bots ({detail.bots?.length || 0})</span>
                                    </div>
                                    {(detail.bots || []).map(b => (
                                        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--gray-100)', fontSize: '12px' }}>
                                            <span>{b.name}</span>
                                            <span className="text-muted">{b.llm_provider}/{b.llm_model}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {modal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }} onClick={() => setModal(null)}>
                    <div className="card" style={{ width: '100%', maxWidth: 400, margin: 'var(--space-4)' }} onClick={e => e.stopPropagation()}>
                        <div className="card-header">
                            <h2 className="card-title">{modal === 'create' ? 'Tambah Workspace' : 'Edit Workspace'}</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="card-body">
                                <div className="form-group">
                                    <label className="form-label">Nama Workspace</label>
                                    <input className="form-input" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Slug <span className="form-label-optional">(opsional)</span></label>
                                    <input className="form-input" value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="contoh: my-team" />
                                    <p className="form-helper">Huruf kecil, tanpa spasi. Akan otomatis di-lowercase.</p>
                                </div>
                            </div>
                            <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Batal</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <RefreshCw size={14} className="spinner" /> : null}
                                    Simpan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default SAWorkspaces
