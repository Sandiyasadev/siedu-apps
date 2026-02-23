import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../App'
import { API_BASE } from '../../config/api'
import {
    Package, ChevronRight, ChevronDown, FolderOpen, Folder, FileText,
    Plus, Trash2, RefreshCw, Zap, AlertCircle, CheckCircle2, Loader2,
    Edit3, Save, X
} from 'lucide-react'

const statusColors = { draft: '#f59e0b', published: '#22c55e', archived: '#94a3b8' }

function PresetEditor() {
    const { getToken } = useAuth()
    const authHeaders = useCallback(() => {
        const token = getToken()
        return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    }, [getToken])

    // State
    const [bundles, setBundles] = useState([])
    const [selectedBundleId, setSelectedBundleId] = useState(null)
    const [bundleDetail, setBundleDetail] = useState(null)
    const [loading, setLoading] = useState(true)
    const [detailLoading, setDetailLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [expandedCats, setExpandedCats] = useState(new Set())
    const [expandedSubs, setExpandedSubs] = useState(new Set())
    const [bootstrapLoading, setBootstrapLoading] = useState(false)

    // Fetch bundle list
    const fetchBundles = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/v1/admin/preset-bundles`, { headers: authHeaders() })
            if (!res.ok) throw new Error('Failed to fetch preset bundles')
            const data = await res.json()
            setBundles(data.bundles || [])
        } catch (err) {
            setError(err.message)
        }
    }, [authHeaders])

    // Fetch bundle detail
    const fetchDetail = useCallback(async (id) => {
        if (!id) return
        setDetailLoading(true)
        try {
            const res = await fetch(`${API_BASE}/v1/admin/preset-bundles/${id}`, { headers: authHeaders() })
            if (!res.ok) throw new Error('Failed to fetch bundle detail')
            const data = await res.json()
            setBundleDetail(data)
            // Auto-expand all categories
            const catKeys = new Set((data.categories || []).map(c => c.key))
            setExpandedCats(catKeys)
        } catch (err) {
            setError(err.message)
        } finally {
            setDetailLoading(false)
        }
    }, [authHeaders])

    useEffect(() => {
        fetchBundles().finally(() => setLoading(false))
    }, [fetchBundles])

    useEffect(() => {
        if (selectedBundleId) fetchDetail(selectedBundleId)
        else setBundleDetail(null)
    }, [selectedBundleId, fetchDetail])

    // Auto-clear notices
    useEffect(() => {
        if (notice) { const t = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(t) }
    }, [notice])

    const selectBundle = (id) => {
        setSelectedBundleId(id)
        setError('')
    }

    // Bootstrap defaults
    const handleBootstrap = async () => {
        setBootstrapLoading(true)
        setError('')
        try {
            const res = await fetch(`${API_BASE}/v1/admin/presets/bootstrap-defaults`, {
                method: 'POST', headers: authHeaders(), body: JSON.stringify({})
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Bootstrap failed')
            setNotice(`Bootstrap OK: ${data.summary?.categories_count || 0} categories, ${data.summary?.subcategories_count || 0} subcategories, ${data.summary?.items_count || 0} items`)
            await fetchBundles()
            if (data.summary?.bundle?.id) setSelectedBundleId(data.summary.bundle.id)
        } catch (err) {
            setError(err.message)
        } finally {
            setBootstrapLoading(false)
        }
    }

    // Toggle category/subcategory expand
    const toggleCat = (key) => {
        setExpandedCats(prev => {
            const next = new Set(prev)
            next.has(key) ? next.delete(key) : next.add(key)
            return next
        })
    }
    const toggleSub = (key) => {
        setExpandedSubs(prev => {
            const next = new Set(prev)
            next.has(key) ? next.delete(key) : next.add(key)
            return next
        })
    }

    // Update bundle status
    const handleStatusChange = async (bundleId, newStatus) => {
        setSaving(true)
        try {
            const res = await fetch(`${API_BASE}/v1/admin/preset-bundles/${bundleId}`, {
                method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status: newStatus })
            })
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Update failed') }
            setNotice(`Status updated to ${newStatus}`)
            await fetchBundles()
            await fetchDetail(bundleId)
        } catch (err) { setError(err.message) }
        finally { setSaving(false) }
    }

    // Delete item
    const handleDeleteItem = async (itemId) => {
        if (!confirm('Delete this template item?')) return
        setSaving(true)
        try {
            const res = await fetch(`${API_BASE}/v1/admin/preset-bundles/items/${itemId}`, {
                method: 'DELETE', headers: authHeaders()
            })
            if (!res.ok) throw new Error('Delete failed')
            setNotice('Item deleted')
            await fetchDetail(selectedBundleId)
        } catch (err) { setError(err.message) }
        finally { setSaving(false) }
    }

    // Helpers
    const bundle = bundleDetail?.bundle
    const categories = bundleDetail?.categories || []
    const subcategories = bundleDetail?.subcategories || []
    const items = bundleDetail?.items || []

    const getSubsForCat = (catKey) => subcategories.filter(s => s.category_key === catKey)
    const getItemsForSub = (subKey) => items.filter(i => i.sub_category === subKey)
    const getOrphanItems = () => items.filter(i => !i.sub_category)

    return (
        <div style={{ display: 'flex', height: '100%', background: '#0f172a', color: '#e2e8f0', fontFamily: "'Inter', sans-serif" }}>
            {/* Sidebar: Bundle list */}
            <div style={{ width: 280, borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
                <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>Preset Bundles</h2>
                        <button onClick={() => fetchBundles()} style={iconBtnStyle} title="Refresh">
                            <RefreshCw size={14} />
                        </button>
                    </div>
                    <button onClick={handleBootstrap} disabled={bootstrapLoading}
                        style={{ ...actionBtnStyle, width: '100%', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', opacity: bootstrapLoading ? 0.6 : 1 }}>
                        {bootstrapLoading ? <Loader2 size={14} className="spin" /> : <Zap size={14} />}
                        <span style={{ marginLeft: 6 }}>Bootstrap Defaults</span>
                    </button>
                </div>

                <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>
                            <Loader2 size={20} className="spin" />
                        </div>
                    ) : bundles.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#64748b', fontSize: 13, padding: 16 }}>
                            No bundles yet. Click "Bootstrap Defaults" to seed.
                        </p>
                    ) : bundles.map(b => (
                        <div key={b.id} onClick={() => selectBundle(b.id)}
                            style={{
                                padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 4,
                                background: selectedBundleId === b.id ? '#1e293b' : 'transparent',
                                border: selectedBundleId === b.id ? '1px solid #334155' : '1px solid transparent',
                                transition: 'all 0.15s'
                            }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Package size={16} style={{ color: '#7c3aed', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {b.name}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                        v{b.version} · {b.categories_count || 0}C · {b.subcategories_count || 0}S · {b.items_count || 0}I
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                                    background: statusColors[b.status] + '22', color: statusColors[b.status],
                                    textTransform: 'uppercase', letterSpacing: 0.5
                                }}>
                                    {b.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main: Detail tree view */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Notices */}
                {error && (
                    <div style={{ padding: '10px 16px', background: '#7f1d1d', color: '#fca5a5', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertCircle size={14} /> {error}
                        <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}><X size={14} /></button>
                    </div>
                )}
                {notice && (
                    <div style={{ padding: '10px 16px', background: '#14532d', color: '#86efac', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle2 size={14} /> {notice}
                    </div>
                )}

                {!selectedBundleId ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                        <div style={{ textAlign: 'center' }}>
                            <Package size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
                            <p style={{ fontSize: 14 }}>Select a bundle from the sidebar to view details</p>
                        </div>
                    </div>
                ) : detailLoading ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                        <Loader2 size={24} className="spin" />
                    </div>
                ) : bundle ? (
                    <>
                        {/* Bundle header */}
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e293b', background: '#0f172a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#f1f5f9' }}>{bundle.name}</h1>
                                <span style={{
                                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                                    background: statusColors[bundle.status] + '22', color: statusColors[bundle.status],
                                    textTransform: 'uppercase'
                                }}>
                                    {bundle.status}
                                </span>
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                                    {bundle.status !== 'published' && (
                                        <button onClick={() => handleStatusChange(bundle.id, 'published')} disabled={saving}
                                            style={{ ...actionBtnStyle, background: '#166534', fontSize: 12 }}>
                                            <CheckCircle2 size={12} /> Publish
                                        </button>
                                    )}
                                    {bundle.status !== 'archived' && (
                                        <button onClick={() => handleStatusChange(bundle.id, 'archived')} disabled={saving}
                                            style={{ ...actionBtnStyle, background: '#334155', fontSize: 12 }}>
                                            Archive
                                        </button>
                                    )}
                                    {bundle.status !== 'draft' && (
                                        <button onClick={() => handleStatusChange(bundle.id, 'draft')} disabled={saving}
                                            style={{ ...actionBtnStyle, background: '#1e293b', border: '1px solid #334155', fontSize: 12 }}>
                                            Draft
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                                Key: <code style={{ color: '#94a3b8' }}>{bundle.key}</code> · Version: {bundle.version} ·
                                {' '}{categories.length} categories · {subcategories.length} subcategories · {items.length} items
                            </div>
                            {bundle.description && <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 6, margin: '6px 0 0' }}>{bundle.description}</p>}
                        </div>

                        {/* Tree view */}
                        <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
                            {categories.length === 0 ? (
                                <p style={{ color: '#64748b', fontSize: 13 }}>No categories in this bundle. Run Bootstrap to seed defaults.</p>
                            ) : categories.map(cat => {
                                const catExpanded = expandedCats.has(cat.key)
                                const subs = getSubsForCat(cat.key)
                                return (
                                    <div key={cat.id} style={{ marginBottom: 8 }}>
                                        {/* Category header */}
                                        <div onClick={() => toggleCat(cat.key)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                                                borderRadius: 8, cursor: 'pointer', background: '#1e293b',
                                                border: '1px solid #334155', transition: 'all 0.15s'
                                            }}>
                                            {catExpanded ? <ChevronDown size={14} style={{ color: '#7c3aed' }} /> : <ChevronRight size={14} style={{ color: '#64748b' }} />}
                                            {catExpanded ? <FolderOpen size={16} style={{ color: '#f59e0b' }} /> : <Folder size={16} style={{ color: '#f59e0b' }} />}
                                            <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{cat.label}</span>
                                            <span style={{ fontSize: 11, color: '#64748b' }}>({cat.key})</span>
                                            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>
                                                {subs.length} intent{subs.length !== 1 ? 's' : ''}
                                            </span>
                                            {!cat.is_active && <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>INACTIVE</span>}
                                        </div>

                                        {/* Subcategories */}
                                        {catExpanded && subs.length > 0 && (
                                            <div style={{ marginLeft: 24, borderLeft: '2px solid #1e293b', paddingLeft: 12, marginTop: 4 }}>
                                                {subs.map(sub => {
                                                    const subExpanded = expandedSubs.has(sub.key)
                                                    const subItems = getItemsForSub(sub.key)
                                                    return (
                                                        <div key={sub.id} style={{ marginBottom: 4 }}>
                                                            <div onClick={() => toggleSub(sub.key)}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                                                                    borderRadius: 6, cursor: 'pointer', background: '#0f172a',
                                                                    border: '1px solid #1e293b', transition: 'all 0.15s'
                                                                }}>
                                                                {subExpanded ? <ChevronDown size={12} style={{ color: '#7c3aed' }} /> : <ChevronRight size={12} style={{ color: '#64748b' }} />}
                                                                <span style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>{sub.label}</span>
                                                                <span style={{ fontSize: 10, color: '#64748b' }}>({sub.key})</span>
                                                                <span style={{
                                                                    fontSize: 9, padding: '1px 5px', borderRadius: 3,
                                                                    background: '#1e293b', color: '#94a3b8', fontWeight: 600
                                                                }}>
                                                                    {sub.reply_mode}
                                                                </span>
                                                                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>
                                                                    {subItems.length} template{subItems.length !== 1 ? 's' : ''}
                                                                </span>
                                                                {!sub.is_active && <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>INACTIVE</span>}
                                                            </div>

                                                            {/* Items */}
                                                            {subExpanded && subItems.length > 0 && (
                                                                <div style={{ marginLeft: 20, borderLeft: '2px solid #1e293b', paddingLeft: 10, marginTop: 2 }}>
                                                                    {subItems.map(item => (
                                                                        <div key={item.id}
                                                                            style={{
                                                                                display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px',
                                                                                borderRadius: 4, marginBottom: 2, background: '#0f172a',
                                                                                border: '1px solid transparent', transition: 'all 0.15s'
                                                                            }}
                                                                            onMouseEnter={e => e.currentTarget.style.borderColor = '#334155'}
                                                                            onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
                                                                            <FileText size={12} style={{ color: '#3b82f6', marginTop: 2, flexShrink: 0 }} />
                                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                                <div style={{ fontSize: 12, fontWeight: 500, color: '#e2e8f0' }}>{item.name}</div>
                                                                                <div style={{
                                                                                    fontSize: 11, color: '#64748b', marginTop: 2,
                                                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 500
                                                                                }}>
                                                                                    {item.content?.substring(0, 120)}{item.content?.length > 120 ? '…' : ''}
                                                                                </div>
                                                                            </div>
                                                                            {item.shortcut && <code style={{ fontSize: 10, color: '#7c3aed', background: '#1e1b4b', padding: '1px 4px', borderRadius: 3 }}>/{item.shortcut}</code>}
                                                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id) }}
                                                                                style={{ ...iconBtnStyle, color: '#64748b', opacity: 0.5 }} title="Delete">
                                                                                <Trash2 size={12} />
                                                                            </button>
                                                                        </div>
                                                                    ))}
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

                            {/* Orphan items (items without subcategory) */}
                            {getOrphanItems().length > 0 && (
                                <div style={{ marginTop: 16 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, padding: '4px 0' }}>
                                        Uncategorized Items ({getOrphanItems().length})
                                    </div>
                                    {getOrphanItems().map(item => (
                                        <div key={item.id}
                                            style={{
                                                display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px',
                                                borderRadius: 4, marginBottom: 2, background: '#0f172a', border: '1px solid #1e293b'
                                            }}>
                                            <FileText size={12} style={{ color: '#94a3b8', marginTop: 2, flexShrink: 0 }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 12, fontWeight: 500, color: '#e2e8f0' }}>{item.name}</div>
                                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 500 }}>
                                                    {item.content?.substring(0, 120)}{item.content?.length > 120 ? '…' : ''}
                                                </div>
                                            </div>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id) }}
                                                style={{ ...iconBtnStyle, color: '#64748b', opacity: 0.5 }} title="Delete">
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : null}
            </div>

            {/* CSS spin animation */}
            <style>{`
                @keyframes spin { to { transform: rotate(360deg) } }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    )
}

// Shared styles
const iconBtnStyle = {
    background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer',
    padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center'
}

const actionBtnStyle = {
    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px',
    borderRadius: 6, border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600,
    fontSize: 13, transition: 'all 0.15s'
}

export default PresetEditor
