import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../App'
import { API_BASE } from '../../config/api'
import {
    Package, ChevronRight, ChevronDown, FolderOpen, Folder, FileText,
    Plus, Trash2, RefreshCw, Download, Upload, AlertTriangle, CheckCircle2, X,
    Edit2, Save, MoreVertical
} from 'lucide-react'

const REPLY_MODES = ['continuation', 'mixed', 'opening']
const GREETING_POLICIES = ['forbidden', 'optional_short', 'required']

function PresetEditor() {
    const { getToken } = useAuth()
    const headers = useCallback(() => ({
        Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json'
    }), [getToken])

    // State
    const [bundles, setBundles] = useState([])
    const [selectedBundleId, setSelectedBundleId] = useState(null)
    const [detail, setDetail] = useState(null)
    const [loading, setLoading] = useState(true)
    const [detailLoading, setDetailLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [notice, setNotice] = useState(null)
    const [expandedCats, setExpandedCats] = useState(new Set())
    const [expandedSubs, setExpandedSubs] = useState(new Set())
    const [importLoading, setImportLoading] = useState(false)
    const [importPreview, setImportPreview] = useState(null)
    const [modal, setModal] = useState(null)
    const [modalForm, setModalForm] = useState({})

    // Fetch bundle list
    const fetchBundles = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/v1/admin/preset-bundles`, { headers: headers() })
            if (!res.ok) throw new Error('Gagal memuat preset bundles')
            const data = await res.json()
            setBundles(data.bundles || [])
        } catch (err) { setNotice({ type: 'error', message: err.message }) }
    }, [headers])

    // Fetch bundle detail
    const fetchDetail = useCallback(async (id) => {
        if (!id) return
        setDetailLoading(true)
        try {
            const res = await fetch(`${API_BASE}/v1/admin/preset-bundles/${id}`, { headers: headers() })
            if (!res.ok) throw new Error('Gagal memuat detail bundle')
            const data = await res.json()
            setDetail(data)
            setExpandedCats(new Set((data.categories || []).map(c => c.key)))
        } catch (err) { setNotice({ type: 'error', message: err.message }) }
        finally { setDetailLoading(false) }
    }, [headers])

    useEffect(() => { fetchBundles().finally(() => setLoading(false)) }, [fetchBundles])
    useEffect(() => {
        if (selectedBundleId) fetchDetail(selectedBundleId)
        else setDetail(null)
    }, [selectedBundleId, fetchDetail])
    useEffect(() => {
        if (notice) { const t = setTimeout(() => setNotice(null), 5000); return () => clearTimeout(t) }
    }, [notice])

    const bundle = detail?.bundle
    const categories = detail?.categories || []
    const subcategories = detail?.subcategories || []
    const items = detail?.items || []
    const getSubsForCat = (catKey) => subcategories.filter(s => s.category_key === catKey)
    const getItemsForSub = (subKey) => items.filter(i => i.sub_category === subKey)

    const toggleCat = (key) => setExpandedCats(prev => {
        const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n
    })
    const toggleSub = (key) => setExpandedSubs(prev => {
        const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n
    })

    // Export bundle
    const handleExport = async () => {
        if (!bundle) return
        setSaving(true)
        try {
            const res = await fetch(`${API_BASE}/v1/admin/preset-bundles/${bundle.id}/export`, { headers: headers() })
            if (!res.ok) throw new Error('Export gagal')
            const data = await res.json()
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `bundle_${bundle.key}_${new Date().toISOString().slice(0, 10)}.json`
            a.click()
            URL.revokeObjectURL(url)
            setNotice({ type: 'success', message: 'Bundle exported!' })
        } catch (err) { setNotice({ type: 'error', message: err.message }) }
        finally { setSaving(false) }
    }

    // Import bundle — file select
    const handleImportFileSelect = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            try {
                const json = JSON.parse(ev.target.result)
                if (!json.bundle || !Array.isArray(json.categories) || !Array.isArray(json.items)) {
                    throw new Error('Format JSON tidak valid: harus memiliki bundle, categories, dan items')
                }
                setImportPreview(json)
                setModal('import-preview')
            } catch (err) { setNotice({ type: 'error', message: err.message }) }
        }
        reader.readAsText(file)
        e.target.value = ''
    }

    // Import bundle — confirm
    const handleImportConfirm = async () => {
        if (!importPreview) return
        setImportLoading(true)
        try {
            const res = await fetch(`${API_BASE}/v1/admin/preset-bundles/import`, {
                method: 'POST', headers: headers(), body: JSON.stringify(importPreview)
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Import gagal')
            setNotice({ type: 'success', message: `Import berhasil: ${data.summary?.categories_created || 0} categories, ${data.summary?.subcategories_created || 0} intents, ${data.summary?.items_created || 0} items` })
            setModal(null)
            setImportPreview(null)
            await fetchBundles()
            if (data.bundle?.id) setSelectedBundleId(data.bundle.id)
        } catch (err) { setNotice({ type: 'error', message: err.message }) }
        finally { setImportLoading(false) }
    }

    // Status change
    const handleStatusChange = async (newStatus) => {
        setSaving(true)
        try {
            const res = await fetch(`${API_BASE}/v1/admin/preset-bundles/${bundle.id}`, {
                method: 'PATCH', headers: headers(), body: JSON.stringify({ status: newStatus })
            })
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Update gagal') }
            setNotice({ type: 'success', message: `Status diubah ke ${newStatus}` })
            await fetchBundles(); await fetchDetail(bundle.id)
        } catch (err) { setNotice({ type: 'error', message: err.message }) }
        finally { setSaving(false) }
    }

    // ==================== CRUD Modals ====================

    // Add Category
    const openAddCategory = () => {
        setModalForm({ key: '', label: '', description: '' })
        setModal('add-category')
    }
    // Edit Category
    const openEditCategory = (cat) => {
        setModalForm({ id: cat.id, key: cat.key, label: cat.label, description: cat.description || '' })
        setModal('edit-category')
    }
    // Add Subcategory
    const openAddSubcategory = (catKey) => {
        setModalForm({ category_key: catKey, key: '', label: '', description: '', reply_mode: 'continuation', greeting_policy: 'forbidden', default_template_count: 3 })
        setModal('add-subcategory')
    }
    // Edit Subcategory
    const openEditSubcategory = (sub) => {
        setModalForm({ id: sub.id, category_key: sub.category_key, key: sub.key, label: sub.label, description: sub.description || '', reply_mode: sub.reply_mode, greeting_policy: sub.greeting_policy, default_template_count: sub.default_template_count || 3 })
        setModal('edit-subcategory')
    }
    // Add Item
    const openAddItem = (subKey, catKey) => {
        setModalForm({ category: catKey, sub_category: subKey, name: '', content: '', shortcut: '', strategy_tag: '' })
        setModal('add-item')
    }
    // Edit Item
    const openEditItem = (item) => {
        setModalForm({ id: item.id, category: item.category, sub_category: item.sub_category, name: item.name, content: item.content, shortcut: item.shortcut || '', strategy_tag: item.strategy_tag || '' })
        setModal('edit-item')
    }

    const handleModalSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            let res
            if (modal === 'add-category') {
                res = await fetch(`${API_BASE}/v1/admin/preset-bundles/${bundle.id}/categories`, {
                    method: 'POST', headers: headers(), body: JSON.stringify(modalForm)
                })
            } else if (modal === 'edit-category') {
                res = await fetch(`${API_BASE}/v1/admin/preset-bundles/categories/${modalForm.id}`, {
                    method: 'PATCH', headers: headers(), body: JSON.stringify({ label: modalForm.label, description: modalForm.description })
                })
            } else if (modal === 'add-subcategory') {
                res = await fetch(`${API_BASE}/v1/admin/preset-bundles/${bundle.id}/subcategories`, {
                    method: 'POST', headers: headers(), body: JSON.stringify(modalForm)
                })
            } else if (modal === 'edit-subcategory') {
                res = await fetch(`${API_BASE}/v1/admin/preset-bundles/subcategories/${modalForm.id}`, {
                    method: 'PATCH', headers: headers(), body: JSON.stringify({ label: modalForm.label, description: modalForm.description, reply_mode: modalForm.reply_mode, greeting_policy: modalForm.greeting_policy, default_template_count: modalForm.default_template_count })
                })
            } else if (modal === 'add-item') {
                res = await fetch(`${API_BASE}/v1/admin/preset-bundles/${bundle.id}/items`, {
                    method: 'POST', headers: headers(), body: JSON.stringify(modalForm)
                })
            } else if (modal === 'edit-item') {
                res = await fetch(`${API_BASE}/v1/admin/preset-bundles/items/${modalForm.id}`, {
                    method: 'PATCH', headers: headers(), body: JSON.stringify({ name: modalForm.name, content: modalForm.content, shortcut: modalForm.shortcut, strategy_tag: modalForm.strategy_tag })
                })
            }
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Operasi gagal')
            setNotice({ type: 'success', message: modal.startsWith('add') ? 'Berhasil ditambahkan' : 'Berhasil diperbarui' })
            setModal(null)
            await fetchDetail(bundle.id)
            await fetchBundles()
        } catch (err) { setNotice({ type: 'error', message: err.message }) }
        finally { setSaving(false) }
    }

    // Delete
    const handleDelete = async (type, id, label) => {
        if (!confirm(`Hapus ${type} "${label}"?`)) return
        setSaving(true)
        try {
            const res = await fetch(`${API_BASE}/v1/admin/preset-bundles/${type}/${id}`, {
                method: 'DELETE', headers: headers()
            })
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Hapus gagal') }
            setNotice({ type: 'success', message: `${type} "${label}" dihapus` })
            await fetchDetail(bundle.id)
            await fetchBundles()
        } catch (err) { setNotice({ type: 'error', message: err.message }) }
        finally { setSaving(false) }
    }

    // ==================== Status Badge ====================
    const statusBadge = (status) => {
        if (status === 'published') return 'badge badge-success'
        if (status === 'archived') return 'badge badge-default'
        return 'badge badge-warning'
    }

    return (
        <div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">Preset Editor</h1>
                    <p className="page-subtitle">Kelola bundle preset — categories, intents, dan template items</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <input type="file" id="import-file" accept=".json" style={{ display: 'none' }} onChange={handleImportFileSelect} />
                    <button className="btn btn-primary" onClick={() => document.getElementById('import-file').click()}>
                        <Upload size={14} /> Import JSON
                    </button>
                    <button className="btn btn-secondary" onClick={() => fetchBundles()} disabled={loading}>
                        <RefreshCw size={14} className={loading ? 'spinner' : ''} />
                    </button>
                </div>
            </header>

            {/* Notice */}
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

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--space-4)', alignItems: 'start' }}>
                {/* Sidebar: Bundle list */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title" style={{ fontSize: 'var(--font-size-sm)' }}>Preset Bundles</h2>
                    </div>
                    <div className="card-body" style={{ padding: 'var(--space-2)' }}>
                        {loading ? (
                            <div style={{ display: 'grid', placeItems: 'center', padding: 'var(--space-6)' }}><div className="spinner" /></div>
                        ) : bundles.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--gray-400)' }}>
                                <Package size={28} style={{ marginBottom: 'var(--space-2)', opacity: 0.4 }} />
                                <p className="text-sm">Belum ada bundle. Klik Import JSON.</p>
                            </div>
                        ) : bundles.map(b => (
                            <div key={b.id} onClick={() => setSelectedBundleId(b.id)}
                                style={{
                                    padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                    background: selectedBundleId === b.id ? 'var(--primary-50)' : 'transparent',
                                    border: selectedBundleId === b.id ? '1px solid var(--primary-200)' : '1px solid transparent',
                                    marginBottom: 'var(--space-1)', transition: 'all 0.15s'
                                }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <Package size={16} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {b.name}
                                        </div>
                                        <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                                            v{b.version} · {b.categories_count || 0}C · {b.subcategories_count || 0}S · {b.items_count || 0}I
                                        </div>
                                    </div>
                                    <span className={statusBadge(b.status)}>{b.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main: Detail tree view */}
                <div>
                    {!selectedBundleId ? (
                        <div className="card">
                            <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--gray-400)' }}>
                                <Package size={40} style={{ marginBottom: 'var(--space-3)', opacity: 0.3 }} />
                                <p className="text-sm">Pilih bundle di sidebar untuk melihat detail</p>
                            </div>
                        </div>
                    ) : detailLoading ? (
                        <div className="card">
                            <div className="card-body" style={{ display: 'grid', placeItems: 'center', padding: 'var(--space-8)' }}>
                                <div className="spinner" />
                            </div>
                        </div>
                    ) : bundle ? (
                        <>
                            {/* Bundle header card */}
                            <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                                <div className="card-body" style={{ padding: 'var(--space-4) var(--space-5)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                                        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: 0 }}>{bundle.name}</h2>
                                        <span className={statusBadge(bundle.status)}>{bundle.status}</span>
                                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)' }}>
                                            <button className="btn btn-ghost btn-sm" onClick={handleExport} disabled={saving} title="Export JSON">
                                                <Download size={12} /> Export
                                            </button>
                                            {bundle.status !== 'published' && (
                                                <button className="btn btn-success btn-sm" onClick={() => handleStatusChange('published')} disabled={saving}>
                                                    <CheckCircle2 size={12} /> Publish
                                                </button>
                                            )}
                                            {bundle.status !== 'archived' && (
                                                <button className="btn btn-secondary btn-sm" onClick={() => handleStatusChange('archived')} disabled={saving}>Archive</button>
                                            )}
                                            {bundle.status !== 'draft' && (
                                                <button className="btn btn-ghost btn-sm" onClick={() => handleStatusChange('draft')} disabled={saving}>Draft</button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted">
                                        Key: <code>{bundle.key}</code> · v{bundle.version} · {categories.length} categories · {subcategories.length} intents · {items.length} items
                                    </div>
                                    {bundle.description && <p className="text-sm text-muted" style={{ marginTop: 'var(--space-1)' }}>{bundle.description}</p>}
                                </div>
                            </div>

                            {/* Add category button */}
                            <div style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="btn btn-primary btn-sm" onClick={openAddCategory}>
                                    <Plus size={14} /> Tambah Category
                                </button>
                            </div>

                            {/* Tree view */}
                            {categories.length === 0 ? (
                                <div className="card">
                                    <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--gray-400)' }}>
                                        <p className="text-sm">Belum ada category. Klik "Tambah Category" atau import bundle dari JSON.</p>
                                    </div>
                                </div>
                            ) : categories.map(cat => {
                                const catExpanded = expandedCats.has(cat.key)
                                const subs = getSubsForCat(cat.key)
                                return (
                                    <div key={cat.id} className="card" style={{ marginBottom: 'var(--space-3)' }}>
                                        {/* Category header */}
                                        <div className="card-header" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleCat(cat.key)}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1 }}>
                                                {catExpanded ? <ChevronDown size={16} style={{ color: 'var(--primary-600)' }} /> : <ChevronRight size={16} style={{ color: 'var(--gray-400)' }} />}
                                                {catExpanded ? <FolderOpen size={16} style={{ color: 'var(--warning-500)' }} /> : <Folder size={16} style={{ color: 'var(--warning-500)' }} />}
                                                <span style={{ fontWeight: 600 }}>{cat.label}</span>
                                                <span className="text-xs text-muted">({cat.key})</span>
                                                <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>{subs.length} intent{subs.length !== 1 ? 's' : ''}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 'var(--space-1)' }} onClick={e => e.stopPropagation()}>
                                                <button className="btn btn-ghost btn-sm" onClick={() => openEditCategory(cat)} title="Edit"><Edit2 size={12} /></button>
                                                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete('categories', cat.id, cat.label)} title="Hapus">
                                                    <Trash2 size={12} style={{ color: 'var(--error-500)' }} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Subcategories */}
                                        {catExpanded && (
                                            <div className="card-body" style={{ padding: 'var(--space-2) var(--space-4) var(--space-4)' }}>
                                                {/* Add subcategory button */}
                                                <div style={{ marginBottom: 'var(--space-2)', display: 'flex', justifyContent: 'flex-end' }}>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => openAddSubcategory(cat.key)} style={{ color: 'var(--primary-600)' }}>
                                                        <Plus size={12} /> Tambah Intent
                                                    </button>
                                                </div>

                                                {subs.length === 0 ? (
                                                    <p className="text-xs text-muted" style={{ padding: 'var(--space-3)', textAlign: 'center' }}>Belum ada intent</p>
                                                ) : subs.map(sub => {
                                                    const subExpanded = expandedSubs.has(sub.key)
                                                    const subItems = getItemsForSub(sub.key)
                                                    return (
                                                        <div key={sub.id} style={{
                                                            border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)',
                                                            marginBottom: 'var(--space-2)', background: 'var(--gray-50)'
                                                        }}>
                                                            {/* Subcategory row */}
                                                            <div style={{
                                                                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                                                                padding: 'var(--space-2) var(--space-3)', cursor: 'pointer'
                                                            }} onClick={() => toggleSub(sub.key)}>
                                                                {subExpanded ? <ChevronDown size={14} style={{ color: 'var(--primary-500)' }} /> : <ChevronRight size={14} style={{ color: 'var(--gray-400)' }} />}
                                                                <span className="text-sm" style={{ fontWeight: 600 }}>{sub.label}</span>
                                                                <span className="text-xs text-muted">({sub.key})</span>
                                                                <span className="badge badge-default" style={{ fontSize: 10 }}>{sub.reply_mode}</span>
                                                                <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>{subItems.length} template{subItems.length !== 1 ? 's' : ''}</span>
                                                                <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                                                                    <button className="btn btn-ghost btn-sm" onClick={() => openEditSubcategory(sub)} title="Edit"><Edit2 size={11} /></button>
                                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete('subcategories', sub.id, sub.label)} title="Hapus">
                                                                        <Trash2 size={11} style={{ color: 'var(--error-500)' }} />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Items */}
                                                            {subExpanded && (
                                                                <div style={{ padding: '0 var(--space-3) var(--space-3)', borderTop: '1px solid var(--gray-200)' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 'var(--space-2) 0' }}>
                                                                        <button className="btn btn-ghost btn-sm" onClick={() => openAddItem(sub.key, sub.category_key)} style={{ color: 'var(--primary-600)', fontSize: 11 }}>
                                                                            <Plus size={11} /> Tambah Template
                                                                        </button>
                                                                    </div>
                                                                    {subItems.length === 0 ? (
                                                                        <p className="text-xs text-muted" style={{ textAlign: 'center', padding: 'var(--space-2)' }}>Belum ada template</p>
                                                                    ) : (
                                                                        <div className="table-container">
                                                                            <table className="table" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                                                <thead>
                                                                                    <tr>
                                                                                        <th>Nama</th>
                                                                                        <th>Konten</th>
                                                                                        <th>Shortcut</th>
                                                                                        <th style={{ width: 1 }}>Aksi</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {subItems.map(item => (
                                                                                        <tr key={item.id}>
                                                                                            <td style={{ fontWeight: 500 }}>{item.name}</td>
                                                                                            <td>
                                                                                                <div style={{ maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                                                    {item.content}
                                                                                                </div>
                                                                                            </td>
                                                                                            <td>{item.shortcut ? <code>/{item.shortcut}</code> : '—'}</td>
                                                                                            <td>
                                                                                                <div style={{ display: 'flex', gap: 2 }}>
                                                                                                    <button className="btn btn-ghost btn-sm" onClick={() => openEditItem(item)} title="Edit"><Edit2 size={12} /></button>
                                                                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete('items', item.id, item.name)} title="Hapus">
                                                                                                        <Trash2 size={12} style={{ color: 'var(--error-500)' }} />
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
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </>
                    ) : null}
                </div>
            </div>

            {/* ==================== MODAL ==================== */}
            {modal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 'var(--z-modal)',
                    display: 'grid', placeItems: 'center',
                    background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)'
                }} onClick={() => setModal(null)}>
                    <div className="card" style={{ width: '100%', maxWidth: modal.includes('item') || modal === 'import-preview' ? 560 : 440, margin: 'var(--space-4)' }} onClick={e => e.stopPropagation()}>
                        <div className="card-header">
                            <h2 className="card-title">
                                {modal === 'add-category' && 'Tambah Category'}
                                {modal === 'edit-category' && 'Edit Category'}
                                {modal === 'add-subcategory' && 'Tambah Intent (Subcategory)'}
                                {modal === 'edit-subcategory' && 'Edit Intent (Subcategory)'}
                                {modal === 'add-item' && 'Tambah Template Item'}
                                {modal === 'edit-item' && 'Edit Template Item'}
                                {modal === 'import-preview' && 'Import Bundle Preview'}
                            </h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleModalSubmit}>
                            <div className="card-body">
                                {/* Category form */}
                                {(modal === 'add-category' || modal === 'edit-category') && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Key</label>
                                            <input className="form-input" value={modalForm.key || ''} disabled={modal === 'edit-category'}
                                                onChange={e => setModalForm(f => ({ ...f, key: e.target.value }))} required placeholder="contoh: greeting" />
                                            <p className="form-helper">Identifier unik, huruf kecil tanpa spasi</p>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Label</label>
                                            <input className="form-input" value={modalForm.label || ''}
                                                onChange={e => setModalForm(f => ({ ...f, label: e.target.value }))} required placeholder="contoh: Greeting" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Deskripsi</label>
                                            <input className="form-input" value={modalForm.description || ''}
                                                onChange={e => setModalForm(f => ({ ...f, description: e.target.value }))} placeholder="Opsional" />
                                        </div>
                                    </>
                                )}

                                {/* Subcategory form */}
                                {(modal === 'add-subcategory' || modal === 'edit-subcategory') && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Key</label>
                                            <input className="form-input" value={modalForm.key || ''} disabled={modal === 'edit-subcategory'}
                                                onChange={e => setModalForm(f => ({ ...f, key: e.target.value }))} required placeholder="contoh: sapaan_awal" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Label</label>
                                            <input className="form-input" value={modalForm.label || ''}
                                                onChange={e => setModalForm(f => ({ ...f, label: e.target.value }))} required placeholder="contoh: Sapaan Awal" />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                            <div className="form-group">
                                                <label className="form-label">Reply Mode</label>
                                                <select className="form-select" value={modalForm.reply_mode || 'continuation'}
                                                    onChange={e => setModalForm(f => ({ ...f, reply_mode: e.target.value }))}>
                                                    {REPLY_MODES.map(r => <option key={r} value={r}>{r}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Greeting Policy</label>
                                                <select className="form-select" value={modalForm.greeting_policy || 'forbidden'}
                                                    onChange={e => setModalForm(f => ({ ...f, greeting_policy: e.target.value }))}>
                                                    {GREETING_POLICIES.map(g => <option key={g} value={g}>{g}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Deskripsi</label>
                                            <input className="form-input" value={modalForm.description || ''}
                                                onChange={e => setModalForm(f => ({ ...f, description: e.target.value }))} placeholder="Opsional" />
                                        </div>
                                    </>
                                )}

                                {/* Item form */}
                                {(modal === 'add-item' || modal === 'edit-item') && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Nama Template</label>
                                            <input className="form-input" value={modalForm.name || ''}
                                                onChange={e => setModalForm(f => ({ ...f, name: e.target.value }))} required placeholder="contoh: greeting_001" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Konten</label>
                                            <textarea className="form-input" value={modalForm.content || ''} rows={4}
                                                onChange={e => setModalForm(f => ({ ...f, content: e.target.value }))} required
                                                placeholder="Halo! Selamat datang di layanan kami..." style={{ resize: 'vertical' }} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                            <div className="form-group">
                                                <label className="form-label">Shortcut</label>
                                                <input className="form-input" value={modalForm.shortcut || ''}
                                                    onChange={e => setModalForm(f => ({ ...f, shortcut: e.target.value }))} placeholder="Opsional, contoh: sapa1" />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Strategy Tag</label>
                                                <input className="form-input" value={modalForm.strategy_tag || ''}
                                                    onChange={e => setModalForm(f => ({ ...f, strategy_tag: e.target.value }))} placeholder="Opsional" />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Import preview */}
                            {modal === 'import-preview' && importPreview && (
                                <div className="card-body">
                                    <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--gray-50)', border: '1px solid var(--gray-200)' }}>
                                        <div style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>{importPreview.bundle?.name || 'Unnamed'}</div>
                                        <div className="text-xs text-muted" style={{ marginBottom: 'var(--space-1)' }}>Key: <code>{importPreview.bundle?.key || '-'}</code> · v{importPreview.bundle?.version || 1}</div>
                                        {importPreview.bundle?.description && <p className="text-sm text-muted">{importPreview.bundle.description}</p>}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                                        <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--primary-50)', textAlign: 'center' }}>
                                            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--primary-700)' }}>{importPreview.categories?.length || 0}</div>
                                            <div className="text-xs text-muted">Categories</div>
                                        </div>
                                        <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--primary-50)', textAlign: 'center' }}>
                                            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--primary-700)' }}>{importPreview.subcategories?.length || 0}</div>
                                            <div className="text-xs text-muted">Intents</div>
                                        </div>
                                        <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--primary-50)', textAlign: 'center' }}>
                                            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--primary-700)' }}>{importPreview.items?.length || 0}</div>
                                            <div className="text-xs text-muted">Templates</div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted" style={{ marginTop: 'var(--space-3)' }}>Bundle baru akan dibuat dengan status <strong>draft</strong>. Anda bisa publish setelah review.</p>
                                </div>
                            )}

                            <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => { setModal(null); setImportPreview(null) }}>Batal</button>
                                {modal === 'import-preview' ? (
                                    <button type="button" className="btn btn-primary" onClick={handleImportConfirm} disabled={importLoading}>
                                        {importLoading ? <RefreshCw size={14} className="spinner" /> : <Upload size={14} />}
                                        Import Bundle
                                    </button>
                                ) : (
                                    <button type="submit" className="btn btn-primary" disabled={saving}>
                                        {saving ? <RefreshCw size={14} className="spinner" /> : null}
                                        Simpan
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default PresetEditor
