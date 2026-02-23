import { Boxes, RefreshCw } from 'lucide-react'

function BootstrapDefaultPresetsPanel({
    bootstrapForm,
    setBootstrapForm,
    bootstrapLoading,
    selectedWorkspaceId,
    workspaces,
    bootstrapDefaultPresets,
    lastBootstrapSummary,
}) {
    return (
        <div className="card">
            <div className="card-header">
                <h2 className="card-title">Bootstrap Preset Default</h2>
            </div>
            <div className="card-body">
                <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                    <div style={{
                        border: '1px solid var(--gray-200)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-3)',
                        background: 'var(--gray-50)'
                    }}>
                        <div className="text-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                            Fungsi bootstrap
                        </div>
                        <div className="text-sm text-muted">
                            Mengisi tabel preset super admin dari source default backend (upsert). Cocok untuk setup awal atau refresh preset dasar.
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Target Preset</label>
                            <select
                                className="form-select"
                                value={bootstrapForm.target_scope}
                                onChange={(e) => setBootstrapForm((prev) => ({ ...prev, target_scope: e.target.value }))}
                            >
                                <option value="global">Global preset (workspace_id = null)</option>
                                <option value="workspace">Workspace-scoped preset</option>
                            </select>
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Jenis Data</label>
                            <select
                                className="form-select"
                                value={bootstrapForm.preset_scope}
                                onChange={(e) => setBootstrapForm((prev) => ({ ...prev, preset_scope: e.target.value }))}
                            >
                                <option value="both">both (taxonomy + templates)</option>
                                <option value="taxonomy">taxonomy only</option>
                                <option value="templates">templates only</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={bootstrapDefaultPresets}
                            disabled={bootstrapLoading || (bootstrapForm.target_scope === 'workspace' && !selectedWorkspaceId)}
                        >
                            {bootstrapLoading ? <RefreshCw size={16} className="spinner" /> : <Boxes size={16} />}
                            Jalankan Bootstrap
                        </button>
                        {bootstrapForm.target_scope === 'workspace' && (
                            <span className="text-sm text-muted">
                                Workspace target: {workspaces.find((w) => w.id === selectedWorkspaceId)?.name || 'belum dipilih'}
                            </span>
                        )}
                    </div>

                    {lastBootstrapSummary && (
                        <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 'var(--space-3)' }}>
                            <div style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>Ringkasan Bootstrap Terakhir</div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                <span className="badge badge-info">Scope: {lastBootstrapSummary.scope}</span>
                                <span className="badge badge-neutral">{lastBootstrapSummary.workspace_id ? 'Workspace' : 'Global'}</span>
                                {lastBootstrapSummary.taxonomy && (
                                    <span className="badge badge-success">
                                        Taxonomy: {lastBootstrapSummary.taxonomy.categories_count || 0} cat / {lastBootstrapSummary.taxonomy.subcategories_count || 0} intents
                                    </span>
                                )}
                                {lastBootstrapSummary.templates && (
                                    <span className="badge badge-success">
                                        Templates: {lastBootstrapSummary.templates.items_count || 0} items
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default BootstrapDefaultPresetsPanel
