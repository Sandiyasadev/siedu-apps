import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../App'
import { API_BASE } from '../../config/api'
import {
    UserPlus, RefreshCw, Search, X, Edit2, KeyRound, AlertTriangle, CheckCircle2
} from 'lucide-react'

const ROLES = ['admin', 'super_admin', 'agent']

function SAUsers() {
    const { getToken } = useAuth()
    const [users, setUsers] = useState([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [workspaces, setWorkspaces] = useState([])
    const [filters, setFilters] = useState({ search: '', workspace_id: '', role: '', is_active: '' })
    const [notice, setNotice] = useState(null)
    const [modal, setModal] = useState(null) // null | 'create' | 'edit' | 'reset'
    const [editUser, setEditUser] = useState(null)
    const [form, setForm] = useState({ email: '', name: '', password: '', role: 'admin', workspace_id: '' })
    const [saving, setSaving] = useState(false)

    const headers = useCallback(() => ({
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
    }), [getToken])

    const fetchUsers = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (filters.search) params.set('search', filters.search)
            if (filters.workspace_id) params.set('workspace_id', filters.workspace_id)
            if (filters.role) params.set('role', filters.role)
            if (filters.is_active) params.set('is_active', filters.is_active)
            const res = await fetch(`${API_BASE}/v1/admin/users?${params}`, { headers: headers() })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setUsers(data.users || [])
            setTotal(data.total || 0)
        } catch (err) {
            setNotice({ type: 'error', message: err.message })
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

    useEffect(() => { fetchUsers() }, [fetchUsers])
    useEffect(() => { fetchWorkspaces() }, [fetchWorkspaces])

    const openCreate = () => {
        setForm({ email: '', name: '', password: '', role: 'admin', workspace_id: '' })
        setEditUser(null)
        setModal('create')
    }
    const openEdit = (u) => {
        setForm({ email: u.email, name: u.name, password: '', role: u.role, workspace_id: u.workspace_id || '' })
        setEditUser(u)
        setModal('edit')
    }
    const openReset = (u) => {
        setForm({ ...form, password: '' })
        setEditUser(u)
        setModal('reset')
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        setNotice(null)
        try {
            if (modal === 'create') {
                const res = await fetch(`${API_BASE}/v1/admin/users`, {
                    method: 'POST', headers: headers(),
                    body: JSON.stringify(form)
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                setNotice({ type: 'success', message: `User ${data.user.email} berhasil dibuat` })
            } else if (modal === 'edit') {
                const payload = { name: form.name, role: form.role, workspace_id: form.workspace_id || undefined }
                const res = await fetch(`${API_BASE}/v1/admin/users/${editUser.id}`, {
                    method: 'PATCH', headers: headers(),
                    body: JSON.stringify(payload)
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                setNotice({ type: 'success', message: `User ${data.user.email} berhasil diperbarui` })
            } else if (modal === 'reset') {
                const res = await fetch(`${API_BASE}/v1/admin/users/${editUser.id}/reset-password`, {
                    method: 'POST', headers: headers(),
                    body: JSON.stringify({ new_password: form.password })
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                setNotice({ type: 'success', message: data.message })
            }
            setModal(null)
            fetchUsers()
        } catch (err) {
            setNotice({ type: 'error', message: err.message })
        } finally {
            setSaving(false)
        }
    }

    const toggleActive = async (u) => {
        try {
            const res = await fetch(`${API_BASE}/v1/admin/users/${u.id}`, {
                method: 'PATCH', headers: headers(),
                body: JSON.stringify({ is_active: !u.is_active })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            fetchUsers()
            setNotice({ type: 'success', message: `User ${data.user.email} ${data.user.is_active ? 'diaktifkan' : 'dinonaktifkan'}` })
        } catch (err) {
            setNotice({ type: 'error', message: err.message })
        }
    }

    const roleBadge = (role) => {
        if (role === 'super_admin') return 'badge badge-info'
        if (role === 'agent') return 'badge badge-warning'
        return 'badge badge-success'
    }

    return (
        <div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">User Management</h1>
                    <p className="page-subtitle">Kelola pengguna platform — {total} user total</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    <UserPlus size={16} /> Tambah User
                </button>
            </header>

            {notice && (
                <div className="card" style={{
                    marginBottom: 'var(--space-4)',
                    borderColor: notice.type === 'success' ? 'var(--success-200)' : 'var(--error-200)',
                    background: notice.type === 'success' ? 'var(--success-50)' : 'var(--error-50)'
                }}>
                    <div className="card-body" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        {notice.type === 'success'
                            ? <CheckCircle2 size={16} style={{ color: 'var(--success-700)' }} />
                            : <AlertTriangle size={16} style={{ color: 'var(--error-700)' }} />}
                        <span className="text-sm" style={{ color: notice.type === 'success' ? 'var(--success-700)' : 'var(--error-700)', flex: 1 }}>
                            {notice.message}
                        </span>
                        <button className="btn btn-ghost btn-sm" onClick={() => setNotice(null)}><X size={14} /></button>
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                    <input
                        className="form-input"
                        placeholder="Cari nama atau email..."
                        value={filters.search}
                        onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                        style={{ paddingLeft: 34 }}
                    />
                </div>
                <select className="form-select" value={filters.workspace_id} onChange={(e) => setFilters(f => ({ ...f, workspace_id: e.target.value }))} style={{ width: 180 }}>
                    <option value="">Semua Workspace</option>
                    {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <select className="form-select" value={filters.role} onChange={(e) => setFilters(f => ({ ...f, role: e.target.value }))} style={{ width: 140 }}>
                    <option value="">Semua Role</option>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select className="form-select" value={filters.is_active} onChange={(e) => setFilters(f => ({ ...f, is_active: e.target.value }))} style={{ width: 120 }}>
                    <option value="">Status</option>
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                </select>
            </div>

            {/* Table */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    {loading ? (
                        <div style={{ display: 'grid', placeItems: 'center', padding: 'var(--space-8)' }}><div className="spinner" /></div>
                    ) : users.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--gray-400)' }}>
                            <Users size={32} style={{ marginBottom: 'var(--space-2)', opacity: 0.4 }} />
                            <p className="text-sm">Tidak ada user ditemukan</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Email</th>
                                        <th>Nama</th>
                                        <th>Role</th>
                                        <th>Workspace</th>
                                        <th>Status</th>
                                        <th style={{ width: 1 }}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u) => (
                                        <tr key={u.id}>
                                            <td>
                                                <div style={{ fontWeight: 500 }}>{u.email}</div>
                                                <div className="text-xs text-muted">{u.id.slice(0, 8)}...</div>
                                            </td>
                                            <td>{u.name}</td>
                                            <td><span className={roleBadge(u.role)}>{u.role}</span></td>
                                            <td className="text-sm text-muted">{u.workspace_name || '—'}</td>
                                            <td>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                    <span style={{
                                                        width: 8, height: 8, borderRadius: '50%',
                                                        background: u.is_active ? 'var(--success-500)' : 'var(--gray-300)'
                                                    }} />
                                                    <span className="text-xs">{u.is_active ? 'Aktif' : 'Off'}</span>
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)} title="Edit"><Edit2 size={14} /></button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => openReset(u)} title="Reset Password"><KeyRound size={14} /></button>
                                                    <button
                                                        className={`btn btn-sm ${u.is_active ? 'btn-ghost' : 'btn-success'}`}
                                                        onClick={() => toggleActive(u)}
                                                        title={u.is_active ? 'Deactivate' : 'Activate'}
                                                        style={{ fontSize: '11px' }}
                                                    >
                                                        {u.is_active ? 'Off' : 'On'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {modal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 'var(--z-modal)',
                    display: 'grid', placeItems: 'center',
                    background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)'
                }} onClick={() => setModal(null)}>
                    <div className="card" style={{ width: '100%', maxWidth: 440, margin: 'var(--space-4)' }} onClick={e => e.stopPropagation()}>
                        <div className="card-header">
                            <h2 className="card-title">
                                {modal === 'create' ? 'Tambah User' : modal === 'edit' ? 'Edit User' : 'Reset Password'}
                            </h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="card-body">
                                {(modal === 'create' || modal === 'edit') && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Email</label>
                                            <input className="form-input" type="email" value={form.email} disabled={modal === 'edit'}
                                                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} required />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Nama</label>
                                            <input className="form-input" value={form.name}
                                                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
                                        </div>
                                        {modal === 'create' && (
                                            <div className="form-group">
                                                <label className="form-label">Password</label>
                                                <input className="form-input" type="password" value={form.password} minLength={6}
                                                    onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} required />
                                                <p className="form-helper">Minimal 6 karakter</p>
                                            </div>
                                        )}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                            <div className="form-group">
                                                <label className="form-label">Role</label>
                                                <select className="form-select" value={form.role}
                                                    onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}>
                                                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Workspace</label>
                                                <select className="form-select" value={form.workspace_id}
                                                    onChange={(e) => setForm(f => ({ ...f, workspace_id: e.target.value }))}>
                                                    <option value="">Default</option>
                                                    {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </>
                                )}
                                {modal === 'reset' && (
                                    <div className="form-group">
                                        <label className="form-label">Password Baru untuk {editUser?.email}</label>
                                        <input className="form-input" type="password" value={form.password} minLength={6}
                                            onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} required />
                                        <p className="form-helper">Minimal 6 karakter</p>
                                    </div>
                                )}
                            </div>
                            <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Batal</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <RefreshCw size={14} className="spinner" /> : null}
                                    {modal === 'reset' ? 'Reset Password' : 'Simpan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default SAUsers
