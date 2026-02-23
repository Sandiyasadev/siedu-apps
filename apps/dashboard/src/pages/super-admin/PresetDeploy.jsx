import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../App'
import { API_BASE } from '../../config/api'
import {
    Rocket, Building2, Package, Eye, CheckCircle2, AlertCircle,
    Loader2, ChevronRight, X, ArrowRight, ArrowLeft, RefreshCw,
    FileText, FolderOpen, Plus, Minus, RotateCcw
} from 'lucide-react'

const STEPS = [
    { key: 'workspace', label: 'Select Workspace', icon: Building2 },
    { key: 'bundle', label: 'Select Bundle', icon: Package },
    { key: 'preview', label: 'Preview Changes', icon: Eye },
    { key: 'apply', label: 'Apply', icon: Rocket },
]

function PresetDeploy() {
    const { getToken } = useAuth()
    const authHeaders = useCallback(() => {
        const token = getToken()
        return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    }, [getToken])

    const [step, setStep] = useState(0)
    const [workspaces, setWorkspaces] = useState([])
    const [bundles, setBundles] = useState([])
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('')
    const [selectedBundleId, setSelectedBundleId] = useState('')
    const [existingAssignment, setExistingAssignment] = useState(null)
    const [applyMode, setApplyMode] = useState('skip_existing')
    const [previewData, setPreviewData] = useState(null)
    const [applyResult, setApplyResult] = useState(null)
    const [loading, setLoading] = useState(true)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [applyLoading, setApplyLoading] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    // Fetch workspaces + bundles
    useEffect(() => {
        const load = async () => {
            try {
                const [wsRes, bRes] = await Promise.all([
                    fetch(`${API_BASE}/v1/admin/workspaces`, { headers: authHeaders() }),
                    fetch(`${API_BASE}/v1/admin/preset-bundles`, { headers: authHeaders() }),
                ])
                if (!wsRes.ok || !bRes.ok) throw new Error('Failed to load data')
                const wsData = await wsRes.json()
                const bData = await bRes.json()
                setWorkspaces(wsData.workspaces || [])
                setBundles((bData.bundles || []).filter(b => b.status === 'published'))
            } catch (err) { setError(err.message) }
            finally { setLoading(false) }
        }
        load()
    }, [authHeaders])

    // Auto-clear notices
    useEffect(() => {
        if (notice) { const t = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(t) }
    }, [notice])

    // When workspace changes, fetch its current assignment
    useEffect(() => {
        if (!selectedWorkspaceId) { setExistingAssignment(null); return }
        const fetchAssignment = async () => {
            try {
                const res = await fetch(`${API_BASE}/v1/admin/workspaces/${selectedWorkspaceId}/preset-assignment`, { headers: authHeaders() })
                if (res.ok) {
                    const data = await res.json()
                    setExistingAssignment(data.assignment || null)
                    if (data.assignment?.bundle_id) setSelectedBundleId(data.assignment.bundle_id)
                }
            } catch { /* ignore */ }
        }
        fetchAssignment()
    }, [selectedWorkspaceId, authHeaders])

    // Navigation
    const canNext = () => {
        if (step === 0) return !!selectedWorkspaceId
        if (step === 1) return !!selectedBundleId
        if (step === 2) return !!previewData
        return false
    }

    const goNext = async () => {
        if (step === 1) {
            // Save assignment + trigger preview on step 1→2
            setPreviewLoading(true)
            setError('')
            try {
                // Save assignment first
                await fetch(`${API_BASE}/v1/admin/workspaces/${selectedWorkspaceId}/preset-assignment`, {
                    method: 'PUT', headers: authHeaders(),
                    body: JSON.stringify({ bundle_id: selectedBundleId })
                })
                // Run preview
                const res = await fetch(`${API_BASE}/v1/admin/workspaces/${selectedWorkspaceId}/preview-apply-bundle`, {
                    method: 'POST', headers: authHeaders(),
                    body: JSON.stringify({ bundle_id: selectedBundleId, mode: applyMode })
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || 'Preview failed')
                setPreviewData(data.summary)
                setStep(2)
            } catch (err) { setError(err.message) }
            finally { setPreviewLoading(false) }
            return
        }
        setStep(s => Math.min(s + 1, 3))
    }

    const goBack = () => {
        setStep(s => Math.max(s - 1, 0))
        if (step === 3) setApplyResult(null)
    }

    // Apply
    const handleApply = async () => {
        setApplyLoading(true)
        setError('')
        try {
            const res = await fetch(`${API_BASE}/v1/admin/workspaces/${selectedWorkspaceId}/apply-bundle`, {
                method: 'POST', headers: authHeaders(),
                body: JSON.stringify({ bundle_id: selectedBundleId, mode: applyMode })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Apply failed')
            setApplyResult(data.summary)
            setStep(3)
            setNotice('Bundle applied successfully!')
        } catch (err) { setError(err.message) }
        finally { setApplyLoading(false) }
    }

    // Reset
    const handleReset = () => {
        setStep(0); setSelectedWorkspaceId(''); setSelectedBundleId('')
        setPreviewData(null); setApplyResult(null); setError(''); setNotice('')
        setExistingAssignment(null); setApplyMode('skip_existing')
    }

    const selectedWorkspace = workspaces.find(w => w.id === selectedWorkspaceId)
    const selectedBundle = bundles.find(b => b.id === selectedBundleId)

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#0f172a', color: '#64748b' }}>
                <Loader2 size={24} className="spin" />
            </div>
        )
    }

    return (
        <div style={{ height: '100%', background: '#0f172a', color: '#e2e8f0', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}>
            {/* Stepper header */}
            <div style={{ padding: '20px 32px 16px', borderBottom: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {STEPS.map((s, i) => {
                        const Icon = s.icon
                        const isActive = i === step
                        const isDone = i < step
                        return (
                            <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                                    borderRadius: 8, background: isActive ? '#1e293b' : 'transparent',
                                    border: isActive ? '1px solid #334155' : '1px solid transparent',
                                    opacity: isDone ? 0.6 : isActive ? 1 : 0.4,
                                    transition: 'all 0.2s'
                                }}>
                                    <div style={{
                                        width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: isDone ? '#166534' : isActive ? '#7c3aed' : '#334155', fontSize: 11, fontWeight: 700
                                    }}>
                                        {isDone ? <CheckCircle2 size={14} /> : <Icon size={12} />}
                                    </div>
                                    <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? '#e2e8f0' : '#94a3b8' }}>
                                        {s.label}
                                    </span>
                                </div>
                                {i < STEPS.length - 1 && <ChevronRight size={16} style={{ color: '#334155', margin: '0 4px' }} />}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Notices */}
            {error && (
                <div style={{ padding: '10px 32px', background: '#7f1d1d', color: '#fca5a5', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={14} /> {error}
                    <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}><X size={14} /></button>
                </div>
            )}
            {notice && (
                <div style={{ padding: '10px 32px', background: '#14532d', color: '#86efac', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={14} /> {notice}
                </div>
            )}

            {/* Step content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
                {/* Step 0: Select Workspace */}
                {step === 0 && (
                    <div>
                        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#f1f5f9' }}>Select Workspace</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                            {workspaces.map(ws => (
                                <div key={ws.id} onClick={() => setSelectedWorkspaceId(ws.id)}
                                    style={{
                                        padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                                        background: selectedWorkspaceId === ws.id ? '#1e293b' : '#0f172a',
                                        border: selectedWorkspaceId === ws.id ? '2px solid #7c3aed' : '1px solid #1e293b',
                                        transition: 'all 0.15s'
                                    }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <Building2 size={18} style={{ color: selectedWorkspaceId === ws.id ? '#7c3aed' : '#64748b' }} />
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{ws.name}</div>
                                            {ws.slug && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{ws.slug}</div>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {existingAssignment && (
                            <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155', fontSize: 13 }}>
                                <span style={{ color: '#94a3b8' }}>Current assignment:</span>{' '}
                                <strong style={{ color: '#e2e8f0' }}>{existingAssignment.bundle_name || existingAssignment.bundle_id || 'None'}</strong>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 1: Select Bundle + Mode */}
                {step === 1 && (
                    <div>
                        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: '#f1f5f9' }}>
                            Select Bundle for {selectedWorkspace?.name}
                        </h2>
                        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Only published bundles are shown.</p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
                            {bundles.length === 0 ? (
                                <p style={{ color: '#64748b', fontSize: 13 }}>No published bundles. Go to Preset Editor to publish one.</p>
                            ) : bundles.map(b => (
                                <div key={b.id} onClick={() => setSelectedBundleId(b.id)}
                                    style={{
                                        padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                                        background: selectedBundleId === b.id ? '#1e293b' : '#0f172a',
                                        border: selectedBundleId === b.id ? '2px solid #7c3aed' : '1px solid #1e293b',
                                        transition: 'all 0.15s'
                                    }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <Package size={18} style={{ color: selectedBundleId === b.id ? '#7c3aed' : '#64748b' }} />
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{b.name}</div>
                                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                                v{b.version} · {b.categories_count || 0}C · {b.subcategories_count || 0}S · {b.items_count || 0}I
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Apply mode */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 8 }}>Apply Mode</label>
                            <div style={{ display: 'flex', gap: 12 }}>
                                {[
                                    { value: 'skip_existing', label: 'Skip Existing', desc: 'Only add new items, skip duplicates' },
                                    { value: 'reactivate_existing', label: 'Reactivate', desc: 'Add new + reactivate inactive duplicates' },
                                ].map(opt => (
                                    <div key={opt.value} onClick={() => setApplyMode(opt.value)}
                                        style={{
                                            padding: '12px 16px', borderRadius: 8, cursor: 'pointer', flex: 1,
                                            background: applyMode === opt.value ? '#1e293b' : '#0f172a',
                                            border: applyMode === opt.value ? '2px solid #7c3aed' : '1px solid #1e293b',
                                        }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{opt.label}</div>
                                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{opt.desc}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Preview */}
                {step === 2 && previewData && (
                    <div>
                        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: '#f1f5f9' }}>
                            Preview: {selectedBundle?.name} → {selectedWorkspace?.name}
                        </h2>
                        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
                            Mode: <strong style={{ color: '#94a3b8' }}>{applyMode}</strong> · {previewData.bots?.length || 0} bot(s) affected
                        </p>

                        {(previewData.bots || []).map((bot, idx) => (
                            <div key={idx} style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 10, background: '#1e293b', border: '1px solid #334155' }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 10 }}>
                                    🤖 {bot.bot_name || bot.bot_id}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                                    <PreviewStat label="Categories" toCreate={bot.categories?.to_create} existing={bot.categories?.already_exist} />
                                    <PreviewStat label="Subcategories" toCreate={bot.subcategories?.to_create} existing={bot.subcategories?.already_exist} />
                                    <PreviewStat label="Items" toCreate={bot.items?.to_create} existing={bot.items?.already_exist} skipped={bot.items?.skipped_existing} />
                                </div>
                            </div>
                        ))}

                        {(previewData.bots || []).length === 0 && (
                            <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                                No bots found in this workspace.
                            </div>
                        )}
                    </div>
                )}

                {/* Step 3: Applied */}
                {step === 3 && (
                    <div style={{ textAlign: 'center', paddingTop: 32 }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: '50%', background: '#166534',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
                        }}>
                            <CheckCircle2 size={32} style={{ color: '#86efac' }} />
                        </div>
                        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Bundle Applied!</h2>
                        <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>
                            <strong>{selectedBundle?.name}</strong> has been applied to <strong>{selectedWorkspace?.name}</strong>
                        </p>

                        {applyResult && (
                            <div style={{ display: 'inline-block', textAlign: 'left', padding: '16px 24px', borderRadius: 10, background: '#1e293b', border: '1px solid #334155', marginBottom: 24 }}>
                                {(applyResult.bots || []).map((bot, idx) => (
                                    <div key={idx} style={{ marginBottom: idx < (applyResult.bots || []).length - 1 ? 12 : 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>🤖 {bot.bot_name || bot.bot_id}</div>
                                        <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', gap: 16 }}>
                                            <span><Plus size={10} style={{ color: '#22c55e' }} /> {bot.categories?.created || 0} cat</span>
                                            <span><Plus size={10} style={{ color: '#22c55e' }} /> {bot.subcategories?.created || 0} sub</span>
                                            <span><Plus size={10} style={{ color: '#22c55e' }} /> {bot.items?.created || 0} items</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div>
                            <button onClick={handleReset} style={{ ...actionBtnStyle, background: '#334155' }}>
                                <RotateCcw size={14} /> Deploy Another
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer nav */}
            {step < 3 && (
                <div style={{ padding: '16px 32px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={step === 0 ? handleReset : goBack} disabled={step === 0}
                        style={{ ...actionBtnStyle, background: '#1e293b', border: '1px solid #334155', opacity: step === 0 ? 0.4 : 1 }}>
                        <ArrowLeft size={14} /> Back
                    </button>

                    <div style={{ display: 'flex', gap: 12 }}>
                        {step === 2 && (
                            <button onClick={handleApply} disabled={applyLoading}
                                style={{ ...actionBtnStyle, background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', opacity: applyLoading ? 0.6 : 1 }}>
                                {applyLoading ? <Loader2 size={14} className="spin" /> : <Rocket size={14} />}
                                <span>Apply Now</span>
                            </button>
                        )}
                        {step < 2 && (
                            <button onClick={goNext} disabled={!canNext() || previewLoading}
                                style={{ ...actionBtnStyle, background: '#7c3aed', opacity: !canNext() || previewLoading ? 0.4 : 1 }}>
                                {previewLoading ? <Loader2 size={14} className="spin" /> : null}
                                <span>{step === 1 ? 'Preview' : 'Next'}</span>
                                <ArrowRight size={14} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg) } }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    )
}

// Preview stat card
function PreviewStat({ label, toCreate = 0, existing = 0, skipped = 0 }) {
    return (
        <div style={{ padding: '10px 12px', borderRadius: 8, background: '#0f172a', border: '1px solid #1e293b' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 12, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Plus size={10} /> {toCreate} to create
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Minus size={10} /> {existing} existing
                </div>
                {skipped > 0 && (
                    <div style={{ fontSize: 12, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Minus size={10} /> {skipped} skipped
                    </div>
                )}
            </div>
        </div>
    )
}

const actionBtnStyle = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
    borderRadius: 8, border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600,
    fontSize: 13, transition: 'all 0.15s'
}

export default PresetDeploy
