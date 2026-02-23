import { useSuperAdminData } from './SuperAdminDataContext'
import {
    RefreshCw, AlertCircle, CheckCircle2
} from 'lucide-react'
import PresetLibrariesPanel from './panels/PresetLibrariesPanel'
import TaxonomyPresetDetailPanel from './panels/TaxonomyPresetDetailPanel'
import TemplatePresetDetailPanel from './panels/TemplatePresetDetailPanel'

const statusBadgeClass = (status) => {
    if (status === 'published') return 'badge badge-success'
    if (status === 'draft') return 'badge badge-warning'
    if (status === 'archived') return 'badge badge-neutral'
    return 'badge badge-info'
}

const scopeLabel = (workspaceId) => workspaceId ? 'Workspace' : 'Global'
const REPLY_MODE_OPTIONS = ['continuation', 'mixed', 'opening']
const GREETING_POLICY_OPTIONS = ['forbidden', 'optional_short', 'required']

function SuperAdminPresets() {
    const {
        refreshing, error, actionNotice,
        taxonomyPresets, templatePresets,
        fetchTaxonomyDetail, fetchTemplateDetail,
        detailLoading, taxonomyDetail, setTaxonomyDetail,
        templateDetail, setTemplateDetail, setDetailLoading,

        editingPresetCategoryId, setEditingPresetCategoryId,
        resetTaxonomyCategoryForm, startEditPresetCategory,
        patchTaxonomyPresetCategory, deleteTaxonomyPresetCategory,
        taxonomyEditorSaving, taxonomyCategoryForm, setTaxonomyCategoryForm,
        submitTaxonomyCategoryForm,

        editingPresetSubcategoryId, setEditingPresetSubcategoryId,
        resetTaxonomySubcategoryForm, startEditPresetSubcategory,
        patchTaxonomyPresetSubcategory, deleteTaxonomyPresetSubcategory,
        taxonomySubcategoryForm, setTaxonomySubcategoryForm,
        submitTaxonomySubcategoryForm,

        templatePresetForm, setTemplatePresetForm,
        templatePresetSaving, resetTemplatePresetForm,
        saveTemplatePresetMeta,
        templateImportForm, setTemplateImportForm,
        handleTemplateGeneratorJsonFileChange,
        importTemplatePresetFromGeneratorJson,
        templateImportLoading, lastTemplateImportSummary,
        editingTemplatePresetItemId, resetTemplatePresetItemForm,
        templatePresetItemForm, setTemplatePresetItemForm,
        startEditTemplatePresetItem, patchTemplatePresetItem,
        deleteTemplatePresetItem, templateEditorSaving,
        submitTemplatePresetItemForm,
        fetchAll
    } = useSuperAdminData()

    return (
        <div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">Preset Library</h1>
                    <p className="page-subtitle">Kelola taxonomy preset dan template preset, termasuk category, intent, dan item template.</p>
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
                <PresetLibrariesPanel
                    taxonomyPresets={taxonomyPresets}
                    templatePresets={templatePresets}
                    fetchTaxonomyDetail={fetchTaxonomyDetail}
                    fetchTemplateDetail={fetchTemplateDetail}
                    statusBadgeClass={statusBadgeClass}
                    scopeLabel={scopeLabel}
                />

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
            </div>
        </div>
    )
}

export default SuperAdminPresets
