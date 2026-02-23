import { useNavigate } from 'react-router-dom'
import { useSuperAdminData } from './SuperAdminDataContext'
import {
    RefreshCw, AlertCircle, CheckCircle2
} from 'lucide-react'
import WorkspacePresetAssignmentPanel from './panels/WorkspacePresetAssignmentPanel'
import WorkspacesPanel from './panels/WorkspacesPanel'

function SuperAdminAssignments() {
    const {
        refreshing, error, actionNotice,
        workspaces, taxonomyPresets, templatePresets,
        selectedWorkspaceId, setSelectedWorkspaceId,
        workspaceAssignment, assignmentForm, setAssignmentForm,
        assignmentLoading, assignmentSaving,
        previewLoading, applyLoading,
        saveWorkspaceAssignment, previewAssignedPresets,
        applyAssignedPresets, lastPreviewSummary, lastApplySummary,
        loading, fetchAll
    } = useSuperAdminData()

    const navigate = useNavigate()

    const formatDateTime = (value) => {
        if (!value) return '—'
        try { return new Date(value).toLocaleString() } catch { return value }
    }

    const openWorkspaceDashboard = (workspace) => {
        if (!workspace?.id) return
        navigate(`/w/${encodeURIComponent(workspace.id)}/dashboard`, {
            state: {
                workspaceModeName: workspace.name || null,
                workspaceModeSlug: workspace.slug || null,
            }
        })
    }

    return (
        <div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">Assignment Preset</h1>
                    <p className="page-subtitle">Pilih workspace, simpan preset default, lalu preview/apply ke semua bot di workspace tersebut.</p>
                </div>
                <button className="btn btn-secondary" onClick={() => fetchAll(true)} disabled={refreshing}>
                    <RefreshCw size={16} className={refreshing ? 'spinner' : ''} />
                    Muat Ulang
                </button>
            </header>

            <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                <div className="card-body" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div className="text-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                        Alur kerja yang disarankan
                    </div>
                    <div className="text-sm text-muted">
                        1) Siapkan preset di <strong>Preset Library</strong>. 2) Tetapkan preset ke workspace di <strong>Assignment</strong>. 3) Jalankan <strong>Preview</strong> sebelum <strong>Apply</strong>.
                    </div>
                </div>
            </div>

            {error && (
                <div className="card" style={{ marginBottom: 'var(--space-4)', borderColor: 'var(--error-200)', background: 'var(--error-50)' }}>
                    <div className="card-body" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                        <AlertCircle size={18} style={{ color: 'var(--error-600)', marginTop: 2 }} />
                        <div>
                            <div style={{ fontWeight: 600, color: 'var(--error-700)' }}>Gagal memuat data</div>
                            <div className="text-sm" style={{ color: 'var(--error-700)' }}>{error}</div>
                        </div>
                    </div>
                </div>
            )}

            {actionNotice && (
                <div className="card" style={{
                    marginBottom: 'var(--space-4)',
                    borderColor: actionNotice.type === 'success' ? 'var(--success-200)' : 'var(--warning-200)',
                    background: actionNotice.type === 'success' ? 'var(--success-50)' : 'var(--warning-50)'
                }}>
                    <div className="card-body" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            {actionNotice.type === 'success'
                                ? <CheckCircle2 size={16} style={{ color: 'var(--success-700)' }} />
                                : <AlertCircle size={16} style={{ color: 'var(--warning-700)' }} />}
                            <span className="text-sm" style={{ color: actionNotice.type === 'success' ? 'var(--success-700)' : 'var(--warning-700)' }}>
                                {actionNotice.message}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                <WorkspacePresetAssignmentPanel
                    selectedWorkspaceId={selectedWorkspaceId}
                    setSelectedWorkspaceId={setSelectedWorkspaceId}
                    workspaces={workspaces}
                    taxonomyPresets={taxonomyPresets}
                    templatePresets={templatePresets}
                    assignmentForm={assignmentForm}
                    setAssignmentForm={setAssignmentForm}
                    assignmentLoading={assignmentLoading}
                    assignmentSaving={assignmentSaving}
                    previewLoading={previewLoading}
                    applyLoading={applyLoading}
                    saveWorkspaceAssignment={saveWorkspaceAssignment}
                    previewAssignedPresets={previewAssignedPresets}
                    applyAssignedPresets={applyAssignedPresets}
                    workspaceAssignment={workspaceAssignment}
                    lastPreviewSummary={lastPreviewSummary}
                    lastApplySummary={lastApplySummary}
                    formatDateTime={formatDateTime}
                />

                <WorkspacesPanel
                    loading={loading}
                    workspaces={workspaces}
                    formatDateTime={formatDateTime}
                    onOpenWorkspaceDashboard={openWorkspaceDashboard}
                />
            </div>
        </div>
    )
}

export default SuperAdminAssignments
