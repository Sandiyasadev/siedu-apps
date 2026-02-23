import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../App'
import { API_BASE } from '../../config/api'
import {
    Rocket, Building2, Package, Eye, CheckCircle2, AlertTriangle,
    X, ArrowRight, ArrowLeft, RefreshCw, Plus, RotateCcw
} from 'lucide-react'

const STEPS = [
    { label: 'Pilih Workspace', icon: Building2 },
    { label: 'Pilih Bundle', icon: Package },
    { label: 'Preview', icon: Eye },
    { label: 'Apply', icon: Rocket },
]

function PresetDeploy() {
    const { getToken } = useAuth()
    const headers = useCallback(() => ({
        Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json'
    }), [getToken])

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
    const [notice, setNotice] = useState(null)

    useEffect(() => {
        const load = async () => {
            try {
                const [wsRes, bRes] = await Promise.all([
                    fetch(`${API_BASE}/v1/admin/workspaces`, { headers: headers() }),
                    fetch(`${API_BASE}/v1/admin/preset-bundles`, { headers: headers() }),
                ])
                if (!wsRes.ok || !bRes.ok) throw new Error('Gagal memuat data')
                const wsData = await wsRes.json()
                const bData = await bRes.json()
                setWorkspaces(wsData.workspaces || [])
                setBundles((bData.bundles || []).filter(b => b.status === 'published'))
            } catch (err) { setNotice({ type: 'error', message: err.message }) }
            finally { setLoading(false) }
        }
        load()
    }, [headers])

    useEffect(() => {
        if (notice) { const t = setTimeout(() => setNotice(null), 5000); return () => clearTimeout(t) }
    }, [notice])

    useEffect(() => {
        if (!selectedWorkspaceId) { setExistingAssignment(null); return }
        const fetchAssignment = async () => {
            try {
                const res = await fetch(`${API_BASE}/v1/admin/workspaces/${selectedWorkspaceId}/preset-assignment`, { headers: headers() })
                if (res.ok) {
                    const data = await res.json()
                    setExistingAssignment(data.assignment || null)
                    if (data.assignment?.bundle_id) setSelectedBundleId(data.assignment.bundle_id)
                }
            } catch { /* ignore */ }
        }
        fetchAssignment()
    }, [selectedWorkspaceId, headers])

    const canNext = () => {
        if (step === 0) return !!selectedWorkspaceId
        if (step === 1) return !!selectedBundleId
        if (step === 2) return !!previewData
        return false
    }

    const goNext = async () => {
        if (step === 1) {
            setPreviewLoading(true)
            setNotice(null)
            try {
                await fetch(`${API_BASE}/v1/admin/workspaces/${selectedWorkspaceId}/preset-assignment`, {
                    method: 'PUT', headers: headers(), body: JSON.stringify({ bundle_id: selectedBundleId })
                })
                const res = await fetch(`${API_BASE}/v1/admin/workspaces/${selectedWorkspaceId}/preview-apply-bundle`, {
                    method: 'POST', headers: headers(), body: JSON.stringify({ bundle_id: selectedBundleId, mode: applyMode })
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || 'Preview gagal')
                setPreviewData(data.summary)
                setStep(2)
            } catch (err) { setNotice({ type: 'error', message: err.message }) }
            finally { setPreviewLoading(false) }
            return
        }
        setStep(s => Math.min(s + 1, 3))
    }

    const goBack = () => {
        setStep(s => Math.max(s - 1, 0))
        if (step === 3) setApplyResult(null)
    }

    const handleApply = async () => {
        setApplyLoading(true)
        setNotice(null)
        try {
            const res = await fetch(`${API_BASE}/v1/admin/workspaces/${selectedWorkspaceId}/apply-bundle`, {
                method: 'POST', headers: headers(), body: JSON.stringify({ bundle_id: selectedBundleId, mode: applyMode })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Apply gagal')
            setApplyResult(data.summary)
            setStep(3)
            setNotice({ type: 'success', message: 'Bundle berhasil di-apply!' })
        } catch (err) { setNotice({ type: 'error', message: err.message }) }
        finally { setApplyLoading(false) }
    }

    const handleReset = () => {
        setStep(0); setSelectedWorkspaceId(''); setSelectedBundleId('')
        setPreviewData(null); setApplyResult(null); setNotice(null)
        setExistingAssignment(null); setApplyMode('skip_existing')
    }

    const selectedWorkspace = workspaces.find(w => w.id === selectedWorkspaceId)
    const selectedBundle = bundles.find(b => b.id === selectedBundleId)

    if (loading) {
        return <div style={{ display: 'grid', placeItems: 'center', padding: 'var(--space-12)' }}><div className="spinner" /></div>
    }

    return (
        <div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">Deploy Preset</h1>
                    <p className="page-subtitle">Assign dan apply bundle preset ke workspace</p>
                </div>
            </header>

            {/* Stepper */}
            <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                <div className="card-body" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                        {STEPS.map((s, i) => {
                            const Icon = s.icon
                            const isActive = i === step
                            const isDone = i < step
                            return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                                        padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)',
                                        background: isActive ? 'var(--primary-50)' : 'transparent',
                                        border: isActive ? '1px solid var(--primary-200)' : '1px solid transparent',
                                        opacity: isDone ? 0.6 : isActive ? 1 : 0.4
                                    }}>
                                        <div style={{
                                            width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: isDone ? 'var(--success-500)' : isActive ? 'var(--primary-600)' : 'var(--gray-200)',
                                            color: isDone || isActive ? 'white' : 'var(--gray-500)', fontSize: 11, fontWeight: 700
                                        }}>
                                            {isDone ? <CheckCircle2 size={14} /> : <Icon size={12} />}
                                        </div>
                                        <span className="text-sm" style={{ fontWeight: isActive ? 600 : 400 }}>{s.label}</span>
                                    </div>
                                    {i < STEPS.length - 1 && <ArrowRight size={14} style={{ color: 'var(--gray-300)', margin: '0 var(--space-1)' }} />}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

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

            {/* Step content */}
            <div className="card">
                <div className="card-body" style={{ padding: 'var(--space-5)' }}>
                    {/* Step 0: Select Workspace */}
                    {step === 0 && (
                        <div>
                            <h3 style={{ fontWeight: 600, marginBottom: 'var(--space-4)' }}>Pilih Workspace</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--space-3)' }}>
                                {workspaces.map(ws => (
                                    <div key={ws.id} onClick={() => setSelectedWorkspaceId(ws.id)}
                                        style={{
                                            padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                            background: selectedWorkspaceId === ws.id ? 'var(--primary-50)' : 'white',
                                            border: selectedWorkspaceId === ws.id ? '2px solid var(--primary-500)' : '1px solid var(--gray-200)',
                                            transition: 'all 0.15s'
                                        }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                            <Building2 size={18} style={{ color: selectedWorkspaceId === ws.id ? 'var(--primary-600)' : 'var(--gray-400)' }} />
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{ws.name}</div>
                                                {ws.slug && <div className="text-xs text-muted">{ws.slug}</div>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {existingAssignment && (
                                <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--gray-50)', border: '1px solid var(--gray-200)' }}>
                                    <span className="text-sm text-muted">Assignment saat ini: </span>
                                    <strong className="text-sm">{existingAssignment.bundle_name || 'None'}</strong>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 1: Select Bundle + Mode */}
                    {step === 1 && (
                        <div>
                            <h3 style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>Pilih Bundle untuk {selectedWorkspace?.name}</h3>
                            <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-4)' }}>Hanya bundle published yang ditampilkan.</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                                {bundles.length === 0 ? (
                                    <p className="text-sm text-muted">Belum ada bundle published. Publish di Preset Editor.</p>
                                ) : bundles.map(b => (
                                    <div key={b.id} onClick={() => setSelectedBundleId(b.id)}
                                        style={{
                                            padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                            background: selectedBundleId === b.id ? 'var(--primary-50)' : 'white',
                                            border: selectedBundleId === b.id ? '2px solid var(--primary-500)' : '1px solid var(--gray-200)',
                                        }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                            <Package size={18} style={{ color: selectedBundleId === b.id ? 'var(--primary-600)' : 'var(--gray-400)' }} />
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{b.name}</div>
                                                <div className="text-xs text-muted">v{b.version} · {b.categories_count || 0}C · {b.items_count || 0}I</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <h4 className="text-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-3)', color: 'var(--gray-500)', textTransform: 'uppercase', fontSize: 11 }}>Apply Mode</h4>
                            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                                {[
                                    { value: 'skip_existing', label: 'Skip Existing', desc: 'Hanya tambah item baru, skip duplikat' },
                                    { value: 'reactivate_existing', label: 'Reactivate', desc: 'Tambah baru + aktifkan kembali duplikat' },
                                ].map(opt => (
                                    <div key={opt.value} onClick={() => setApplyMode(opt.value)}
                                        style={{
                                            padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', cursor: 'pointer', flex: 1,
                                            background: applyMode === opt.value ? 'var(--primary-50)' : 'white',
                                            border: applyMode === opt.value ? '2px solid var(--primary-500)' : '1px solid var(--gray-200)',
                                        }}>
                                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{opt.label}</div>
                                        <div className="text-xs text-muted" style={{ marginTop: 4 }}>{opt.desc}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Preview */}
                    {step === 2 && previewData && (
                        <div>
                            <h3 style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>Preview: {selectedBundle?.name} → {selectedWorkspace?.name}</h3>
                            <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-4)' }}>
                                Mode: <strong>{applyMode}</strong> · {previewData.bots?.length || 0} bot(s)
                            </p>
                            {(previewData.bots || []).map((bot, idx) => (
                                <div key={idx} style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', marginBottom: 'var(--space-3)' }}>
                                    <div style={{ fontWeight: 600, marginBottom: 'var(--space-3)' }}>🤖 {bot.bot_name || bot.bot_id}</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
                                        <PreviewStat label="Categories" toCreate={bot.categories?.to_create} existing={bot.categories?.already_exist} />
                                        <PreviewStat label="Subcategories" toCreate={bot.subcategories?.to_create} existing={bot.subcategories?.already_exist} />
                                        <PreviewStat label="Items" toCreate={bot.items?.to_create} existing={bot.items?.already_exist} skipped={bot.items?.skipped_existing} />
                                    </div>
                                </div>
                            ))}
                            {(previewData.bots || []).length === 0 && (
                                <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--gray-400)' }}>
                                    <p className="text-sm">Tidak ada bot di workspace ini.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Applied */}
                    {step === 3 && (
                        <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                            <div style={{
                                width: 56, height: 56, borderRadius: '50%', background: 'var(--success-100)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)'
                            }}>
                                <CheckCircle2 size={28} style={{ color: 'var(--success-600)' }} />
                            </div>
                            <h2 style={{ fontWeight: 700, marginBottom: 'var(--space-2)' }}>Bundle berhasil di-apply!</h2>
                            <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-4)' }}>
                                <strong>{selectedBundle?.name}</strong> → <strong>{selectedWorkspace?.name}</strong>
                            </p>
                            {applyResult && (applyResult.bots || []).map((bot, idx) => (
                                <div key={idx} style={{ display: 'inline-block', textAlign: 'left', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', marginBottom: 'var(--space-3)' }}>
                                    <div className="text-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>🤖 {bot.bot_name || bot.bot_id}</div>
                                    <div className="text-xs text-muted" style={{ display: 'flex', gap: 'var(--space-4)' }}>
                                        <span><Plus size={10} style={{ color: 'var(--success-600)' }} /> {bot.categories?.created || 0} cat</span>
                                        <span><Plus size={10} style={{ color: 'var(--success-600)' }} /> {bot.subcategories?.created || 0} sub</span>
                                        <span><Plus size={10} style={{ color: 'var(--success-600)' }} /> {bot.items?.created || 0} items</span>
                                    </div>
                                </div>
                            ))}
                            <div style={{ marginTop: 'var(--space-4)' }}>
                                <button className="btn btn-secondary" onClick={handleReset}>
                                    <RotateCcw size={14} /> Deploy Lagi
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer nav */}
            {step < 3 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-4)' }}>
                    <button className="btn btn-secondary" onClick={step === 0 ? handleReset : goBack} disabled={step === 0}>
                        <ArrowLeft size={14} /> Kembali
                    </button>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        {step === 2 && (
                            <button className="btn btn-primary" onClick={handleApply} disabled={applyLoading}>
                                {applyLoading ? <RefreshCw size={14} className="spinner" /> : <Rocket size={14} />}
                                Apply Sekarang
                            </button>
                        )}
                        {step < 2 && (
                            <button className="btn btn-primary" onClick={goNext} disabled={!canNext() || previewLoading}>
                                {previewLoading ? <RefreshCw size={14} className="spinner" /> : null}
                                {step === 1 ? 'Preview' : 'Selanjutnya'} <ArrowRight size={14} />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

function PreviewStat({ label, toCreate = 0, existing = 0, skipped = 0 }) {
    return (
        <div style={{ padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)', background: 'white', border: '1px solid var(--gray-200)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 'var(--space-1)', textTransform: 'uppercase' }}>{label}</div>
            <div className="text-xs" style={{ color: 'var(--success-600)' }}><Plus size={10} /> {toCreate} baru</div>
            <div className="text-xs text-muted">{existing} sudah ada</div>
            {skipped > 0 && <div className="text-xs" style={{ color: 'var(--warning-600)' }}>{skipped} dilewati</div>}
        </div>
    )
}

export default PresetDeploy
