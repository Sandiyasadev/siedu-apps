import { Boxes, ListTree, RefreshCw, Shield } from 'lucide-react'

function WorkspacePresetAssignmentPanel({
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    workspaces,
    taxonomyPresets,
    templatePresets,
    assignmentForm,
    setAssignmentForm,
    assignmentLoading,
    assignmentSaving,
    previewLoading,
    applyLoading,
    saveWorkspaceAssignment,
    previewAssignedPresets,
    applyAssignedPresets,
    workspaceAssignment,
    lastPreviewSummary,
    lastApplySummary,
    formatDateTime,
}) {
    const hasWorkspace = Boolean(selectedWorkspaceId)
    const canPreviewOrApply = hasWorkspace && assignmentForm.taxonomy_preset_id && assignmentForm.template_preset_id

    return (
        <div className="card">
            <div className="card-header">
                <h2 className="card-title">Assignment & Apply Preset ke Workspace</h2>
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
                            Urutan kerja
                        </div>
                        <div className="text-sm text-muted">
                            1) Pilih workspace dan preset. 2) Simpan assignment default. 3) Preview dampak. 4) Apply ke semua bot di workspace.
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">1. Workspace Target</label>
                            <select
                                className="form-select"
                                value={selectedWorkspaceId}
                                onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                            >
                                <option value="">Pilih workspace</option>
                                {workspaces.map((w) => (
                                    <option key={w.id} value={w.id}>
                                        {w.name} ({w.bot_count || 0} bot)
                                    </option>
                                ))}
                            </select>
                            <div className="text-xs text-muted" style={{ marginTop: 6 }}>
                                Preset akan diterapkan ke semua bot dalam workspace ini.
                            </div>
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">2. Taxonomy Preset</label>
                            <select
                                className="form-select"
                                value={assignmentForm.taxonomy_preset_id}
                                onChange={(e) => setAssignmentForm((prev) => ({ ...prev, taxonomy_preset_id: e.target.value }))}
                                disabled={!selectedWorkspaceId || assignmentLoading}
                            >
                                <option value="">Tidak ada</option>
                                {taxonomyPresets.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} ({p.key} v{p.version})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">3. Template Preset</label>
                            <select
                                className="form-select"
                                value={assignmentForm.template_preset_id}
                                onChange={(e) => setAssignmentForm((prev) => ({ ...prev, template_preset_id: e.target.value }))}
                                disabled={!selectedWorkspaceId || assignmentLoading}
                            >
                                <option value="">Tidak ada</option>
                                {templatePresets.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} ({p.key} v{p.version}) • {p.items_count || 0} item
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ margin: 0, minWidth: 240 }}>
                            <label className="form-label">4. Mode Apply</label>
                            <select
                                className="form-select"
                                value={assignmentForm.apply_mode}
                                onChange={(e) => setAssignmentForm((prev) => ({ ...prev, apply_mode: e.target.value }))}
                            >
                                <option value="skip_existing">skip_existing (aman, tidak overwrite)</option>
                                <option value="reactivate_existing">reactivate_existing</option>
                            </select>
                        </div>

                        <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={saveWorkspaceAssignment}
                            disabled={!selectedWorkspaceId || assignmentSaving || assignmentLoading}
                        >
                            {assignmentSaving ? <RefreshCw size={16} className="spinner" /> : <Shield size={16} />}
                            Simpan Assignment
                        </button>

                        <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={previewAssignedPresets}
                            disabled={
                                !canPreviewOrApply || previewLoading
                            }
                        >
                            {previewLoading ? <RefreshCw size={16} className="spinner" /> : <ListTree size={16} />}
                            Preview Dampak
                        </button>

                        <button
                            className="btn btn-primary"
                            type="button"
                            onClick={applyAssignedPresets}
                            disabled={
                                !canPreviewOrApply || applyLoading
                            }
                        >
                            {applyLoading ? <RefreshCw size={16} className="spinner" /> : <Boxes size={16} />}
                            Apply ke Workspace
                        </button>
                    </div>

                    <div className="text-sm text-muted" style={{
                        borderLeft: '3px solid var(--gray-300)',
                        paddingLeft: 'var(--space-3)'
                    }}>
                        <code>Simpan Assignment</code> hanya menyimpan preset default untuk workspace. <code>Preview</code> menghitung dampak tanpa mengubah data. <code>Apply</code> menyalin preset ke semua bot di workspace.
                    </div>

                    {workspaceAssignment && (
                        <div style={{
                            borderTop: '1px solid var(--gray-200)',
                            paddingTop: 'var(--space-3)',
                            display: 'grid',
                            gap: 'var(--space-1)'
                        }}>
                            <div className="text-xs text-muted">Assignment Saat Ini</div>
                            <div className="text-sm">
                                Dibuat: {formatDateTime(workspaceAssignment.assigned_at)} • Diperbarui: {formatDateTime(workspaceAssignment.updated_at)}
                            </div>
                        </div>
                    )}

                    {lastPreviewSummary && (
                        <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 'var(--space-3)' }}>
                            <div style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>Ringkasan Preview (Dry Run)</div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
                                <span className="badge badge-info">Total bot: {lastPreviewSummary.bots_total || 0}</span>
                                <span className="badge badge-success">Dipreview: {lastPreviewSummary.bots_processed || 0}</span>
                                <span className="badge badge-warning">Gagal: {lastPreviewSummary.bots_failed || 0}</span>
                                <span className="badge badge-neutral">Mode: {lastPreviewSummary.mode}</span>
                            </div>

                            {lastPreviewSummary.aggregate && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                                    <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}>
                                        <div className="text-xs text-muted" style={{ marginBottom: 'var(--space-1)' }}>Dampak Taxonomy</div>
                                        <div className="text-sm">Category baru: {lastPreviewSummary.aggregate.taxonomy?.categories_created || 0}</div>
                                        <div className="text-sm">Category reaktif: {lastPreviewSummary.aggregate.taxonomy?.categories_reactivated || 0}</div>
                                        <div className="text-sm">Intent baru: {lastPreviewSummary.aggregate.taxonomy?.subcategories_created || 0}</div>
                                        <div className="text-sm">Intent reaktif: {lastPreviewSummary.aggregate.taxonomy?.subcategories_reactivated || 0}</div>
                                    </div>
                                    <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}>
                                        <div className="text-xs text-muted" style={{ marginBottom: 'var(--space-1)' }}>Dampak Template</div>
                                        <div className="text-sm">Template baru: {lastPreviewSummary.aggregate.templates?.created || 0}</div>
                                        <div className="text-sm">Template reaktif: {lastPreviewSummary.aggregate.templates?.reactivated || 0}</div>
                                        <div className="text-sm">Lewat (sudah ada): {lastPreviewSummary.aggregate.templates?.skipped_existing || 0}</div>
                                        <div className="text-sm">Lewat (taxonomy belum ada): {lastPreviewSummary.aggregate.templates?.skipped_missing_taxonomy || 0}</div>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                                {(lastPreviewSummary.bot_results || []).slice(0, 8).map((r) => (
                                    <div key={r.bot_id} className="text-sm" style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                                        <span>{r.bot_name || r.bot_id}</span>
                                        <span style={{ color: r.success ? 'var(--gray-600)' : 'var(--error-600)' }}>
                                            {r.success
                                                ? `tax:${r.taxonomy?.categories_created || 0}c/${r.taxonomy?.subcategories_created || 0}i, tpl:+${r.templates?.created || 0}`
                                                : (r.error || 'gagal')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {lastApplySummary && (
                        <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 'var(--space-3)' }}>
                            <div style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>Ringkasan Apply Terakhir</div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
                                <span className="badge badge-info">Total bot: {lastApplySummary.bots_total || 0}</span>
                                <span className="badge badge-success">Diproses: {lastApplySummary.bots_processed || 0}</span>
                                <span className="badge badge-warning">Gagal: {lastApplySummary.bots_failed || 0}</span>
                                <span className="badge badge-neutral">Mode: {lastApplySummary.mode}</span>
                            </div>
                            <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                                {(lastApplySummary.bot_results || []).slice(0, 8).map((r) => (
                                    <div key={r.bot_id} className="text-sm" style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                                        <span>{r.bot_name || r.bot_id}</span>
                                        <span className={r.success ? 'text-muted' : ''} style={{ color: r.success ? undefined : 'var(--error-600)' }}>
                                            {r.success ? 'ok' : (r.error || 'gagal')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default WorkspacePresetAssignmentPanel
