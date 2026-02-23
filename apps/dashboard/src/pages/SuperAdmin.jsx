import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import {
    Shield, RefreshCw, AlertCircle, CheckCircle2
} from 'lucide-react'
import StatsCards from './super-admin/panels/StatsCards'
import BootstrapDefaultPresetsPanel from './super-admin/panels/BootstrapDefaultPresetsPanel'
import WorkspacePresetAssignmentPanel from './super-admin/panels/WorkspacePresetAssignmentPanel'
import WorkspacesPanel from './super-admin/panels/WorkspacesPanel'
import ApplyLogsPanel from './super-admin/panels/ApplyLogsPanel'
import PresetLibrariesPanel from './super-admin/panels/PresetLibrariesPanel'
import TaxonomyPresetDetailPanel from './super-admin/panels/TaxonomyPresetDetailPanel'
import TemplatePresetDetailPanel from './super-admin/panels/TemplatePresetDetailPanel'
import { useSuperAdminData } from './super-admin/SuperAdminDataContext'

const statusBadgeClass = (status) => {
    if (status === 'published') return 'badge badge-success'
    if (status === 'draft') return 'badge badge-warning'
    if (status === 'archived') return 'badge badge-neutral'
    return 'badge badge-info'
}

const scopeLabel = (workspaceId) => workspaceId ? 'Workspace' : 'Global'
const REPLY_MODE_OPTIONS = ['continuation', 'mixed', 'opening']
const GREETING_POLICY_OPTIONS = ['forbidden', 'optional_short', 'required']

function SuperAdmin({ section = 'all' }) {
    const { user } = useAuth()
    const navigate = useNavigate()

    const {
        loading,
        refreshing,
        error,
        setError,
        workspaces,
        taxonomyPresets,
        templatePresets,
        applyLogs,
        taxonomyDetail,
        setTaxonomyDetail,
        templateDetail,
        setTemplateDetail,
        detailLoading,
        setDetailLoading,
        selectedWorkspaceId,
        setSelectedWorkspaceId,
        workspaceAssignment,
        assignmentLoading,
        assignmentSaving,
        previewLoading,
        applyLoading,
        bootstrapLoading,
        assignmentForm,
        setAssignmentForm,
        bootstrapForm,
        setBootstrapForm,
        actionNotice,
        setActionNotice,
        lastApplySummary,
        lastPreviewSummary,
        lastBootstrapSummary,
        taxonomyCategoryForm,
        setTaxonomyCategoryForm,
        taxonomySubcategoryForm,
        setTaxonomySubcategoryForm,
        editingPresetCategoryId,
        setEditingPresetCategoryId,
        editingPresetSubcategoryId,
        setEditingPresetSubcategoryId,
        taxonomyEditorSaving,
        setTaxonomyEditorSaving,
        templatePresetForm,
        setTemplatePresetForm,
        templatePresetSaving,
        setTemplatePresetSaving,
        templateImportForm,
        setTemplateImportForm,
        templateImportLoading,
        setTemplateImportLoading,
        lastTemplateImportSummary,
        setLastTemplateImportSummary,
        templatePresetItemForm,
        setTemplatePresetItemForm,
        editingTemplatePresetItemId,
        setEditingTemplatePresetItemId,
        templateEditorSaving,
        setTemplateEditorSaving,
        fetchAll,
        saveWorkspaceAssignment,
        applyAssignedPresets,
        previewAssignedPresets,
        bootstrapDefaultPresets,
        fetchTemplateDetail,
        fetchTaxonomyDetail,
        resetTaxonomyCategoryForm,
        resetTaxonomySubcategoryForm,
        resetTemplatePresetForm,
        saveTemplatePresetMeta,
        handleTemplateGeneratorJsonFileChange,
        importTemplatePresetFromGeneratorJson,
        resetTemplatePresetItemForm,
        startEditTemplatePresetItem,
        submitTemplatePresetItemForm,
        patchTemplatePresetItem,
        deleteTemplatePresetItem,
        submitTaxonomyCategoryForm,
        submitTaxonomySubcategoryForm,
        startEditPresetCategory,
        startEditPresetSubcategory,
        patchTaxonomyPresetCategory,
        patchTaxonomyPresetSubcategory,
        deleteTaxonomyPresetCategory,
        deleteTaxonomyPresetSubcategory,
    } = useSuperAdminData()

    const formatDateTime = (value) => {
        if (!value) return '—'
        try {
            return new Date(value).toLocaleString()
        } catch {
            return value
        }
    }

    const totalBots = workspaces.reduce((sum, w) => sum + (w.bot_count || 0), 0)
    const totalUsers = workspaces.reduce((sum, w) => sum + (w.user_count || 0), 0)
    const openWorkspaceDashboard = (workspace) => {
        if (!workspace?.id) return

        navigate(`/w/${encodeURIComponent(workspace.id)}/dashboard`, {
            state: {
                workspaceModeName: workspace.name || null,
                workspaceModeSlug: workspace.slug || null,
            }
        })
    }
    const sectionKey = ['all', 'overview', 'assignments', 'presets', 'logs'].includes(section) ? section : 'all'
    const showOverview = sectionKey === 'all' || sectionKey === 'overview'
    const showAssignments = sectionKey === 'all' || sectionKey === 'assignments'
    const showPresets = sectionKey === 'all' || sectionKey === 'presets'
    const showLogs = sectionKey === 'all' || sectionKey === 'logs'
    const sectionMeta = {
        all: {
            title: 'Super Admin',
            subtitle: 'Kelola workspace, preset taxonomy, dan preset template untuk assignment serta apply ke bot.'
        },
        overview: {
            title: 'Ringkasan Super Admin',
            subtitle: 'Lihat kondisi platform dan bootstrap preset default dari source lokal backend.'
        },
        assignments: {
            title: 'Assignment Preset',
            subtitle: 'Pilih workspace, simpan preset default, lalu preview/apply ke semua bot di workspace tersebut.'
        },
        presets: {
            title: 'Preset Library',
            subtitle: 'Kelola taxonomy preset dan template preset, termasuk category, intent, dan item template.'
        },
        logs: {
            title: 'Log Apply Preset',
            subtitle: 'Riwayat apply preset terbaru untuk audit operasional dan troubleshooting.'
        }
    }[sectionKey]

    if (user?.role !== 'super_admin') {
        return (
            <div className="card">
                <div className="empty-state">
                    <div className="empty-state-icon"><Shield size={28} /></div>
                    <h3>Super Admin Only</h3>
                    <p>Halaman ini hanya untuk akun dengan role super_admin.</p>
                </div>
            </div>
        )
    }

    return (
        <div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">{sectionMeta.title}</h1>
                    <p className="page-subtitle">{sectionMeta.subtitle}</p>
                </div>
                <button className="btn btn-secondary" onClick={() => fetchAll(true)} disabled={refreshing}>
                    <RefreshCw size={16} className={refreshing ? 'spinner' : ''} />
                    Muat Ulang
                </button>
            </header>

            {(showAssignments || showPresets) && (
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
            )}

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

            {showOverview && (
            <StatsCards
                loading={loading}
                workspaces={workspaces}
                totalUsers={totalUsers}
                totalBots={totalBots}
                taxonomyPresets={taxonomyPresets}
                templatePresets={templatePresets}
                applyLogs={applyLogs}
            />
            )}

            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                {showOverview && (
                <BootstrapDefaultPresetsPanel
                    bootstrapForm={bootstrapForm}
                    setBootstrapForm={setBootstrapForm}
                    bootstrapLoading={bootstrapLoading}
                    selectedWorkspaceId={selectedWorkspaceId}
                    workspaces={workspaces}
                    bootstrapDefaultPresets={bootstrapDefaultPresets}
                    lastBootstrapSummary={lastBootstrapSummary}
                />
                )}

                {showAssignments && (
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
                )}

                {showAssignments && (
                <WorkspacesPanel
                    loading={loading}
                    workspaces={workspaces}
                    formatDateTime={formatDateTime}
                    onOpenWorkspaceDashboard={openWorkspaceDashboard}
                />
                )}

                {showPresets && (
                <PresetLibrariesPanel
                    taxonomyPresets={taxonomyPresets}
                    templatePresets={templatePresets}
                    fetchTaxonomyDetail={fetchTaxonomyDetail}
                    fetchTemplateDetail={fetchTemplateDetail}
                    statusBadgeClass={statusBadgeClass}
                    scopeLabel={scopeLabel}
                />
                )}

                {showPresets && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-4)' }}>
                    <TaxonomyPresetDetailPanel
                        detailLoading={detailLoading}
                        taxonomyDetail={taxonomyDetail}
                        scopeLabel={scopeLabel}
                        statusBadgeClass={statusBadgeClass}
                        editingPresetCategoryId={editingPresetCategoryId}
                        resetTaxonomyCategoryForm={resetTaxonomyCategoryForm}
                        startEditPresetCategory={startEditPresetCategory}
                        patchTaxonomyPresetCategory={patchTaxonomyPresetCategory}
                        deleteTaxonomyPresetCategory={deleteTaxonomyPresetCategory}
                        taxonomyEditorSaving={taxonomyEditorSaving}
                        taxonomyCategoryForm={taxonomyCategoryForm}
                        setTaxonomyCategoryForm={setTaxonomyCategoryForm}
                        submitTaxonomyCategoryForm={submitTaxonomyCategoryForm}
                        editingPresetSubcategoryId={editingPresetSubcategoryId}
                        resetTaxonomySubcategoryForm={resetTaxonomySubcategoryForm}
                        startEditPresetSubcategory={startEditPresetSubcategory}
                        patchTaxonomyPresetSubcategory={patchTaxonomyPresetSubcategory}
                        deleteTaxonomyPresetSubcategory={deleteTaxonomyPresetSubcategory}
                        taxonomySubcategoryForm={taxonomySubcategoryForm}
                        setTaxonomySubcategoryForm={setTaxonomySubcategoryForm}
                        REPLY_MODE_OPTIONS={REPLY_MODE_OPTIONS}
                        GREETING_POLICY_OPTIONS={GREETING_POLICY_OPTIONS}
                        submitTaxonomySubcategoryForm={submitTaxonomySubcategoryForm}
                    />

                    <TemplatePresetDetailPanel
                        detailLoading={detailLoading}
                        templateDetail={templateDetail}
                        scopeLabel={scopeLabel}
                        statusBadgeClass={statusBadgeClass}
                        templatePresetForm={templatePresetForm}
                        setTemplatePresetForm={setTemplatePresetForm}
                        templatePresetSaving={templatePresetSaving}
                        resetTemplatePresetForm={resetTemplatePresetForm}
                        saveTemplatePresetMeta={saveTemplatePresetMeta}
                        taxonomyPresets={taxonomyPresets}
                        templateImportForm={templateImportForm}
                        setTemplateImportForm={setTemplateImportForm}
                        handleTemplateGeneratorJsonFileChange={handleTemplateGeneratorJsonFileChange}
                        importTemplatePresetFromGeneratorJson={importTemplatePresetFromGeneratorJson}
                        templateImportLoading={templateImportLoading}
                        lastTemplateImportSummary={lastTemplateImportSummary}
                        editingTemplatePresetItemId={editingTemplatePresetItemId}
                        resetTemplatePresetItemForm={resetTemplatePresetItemForm}
                        templatePresetItemForm={templatePresetItemForm}
                        setTemplatePresetItemForm={setTemplatePresetItemForm}
                        startEditTemplatePresetItem={startEditTemplatePresetItem}
                        patchTemplatePresetItem={patchTemplatePresetItem}
                        deleteTemplatePresetItem={deleteTemplatePresetItem}
                        templateEditorSaving={templateEditorSaving}
                        submitTemplatePresetItemForm={submitTemplatePresetItemForm}
                    />
                </div>
                )}

                {showLogs && (
                <ApplyLogsPanel
                    applyLogs={applyLogs}
                    formatDateTime={formatDateTime}
                />
                )}
            </div>
        </div>
    )
}

export default SuperAdmin
