import { ListTree, RefreshCw } from 'lucide-react'

function TaxonomyPresetDetailPanel({
    detailLoading,
    taxonomyDetail,
    scopeLabel,
    statusBadgeClass,
    editingPresetCategoryId,
    resetTaxonomyCategoryForm,
    startEditPresetCategory,
    patchTaxonomyPresetCategory,
    deleteTaxonomyPresetCategory,
    taxonomyEditorSaving,
    taxonomyCategoryForm,
    setTaxonomyCategoryForm,
    submitTaxonomyCategoryForm,
    editingPresetSubcategoryId,
    resetTaxonomySubcategoryForm,
    startEditPresetSubcategory,
    patchTaxonomyPresetSubcategory,
    deleteTaxonomyPresetSubcategory,
    taxonomySubcategoryForm,
    setTaxonomySubcategoryForm,
    REPLY_MODE_OPTIONS,
    GREETING_POLICY_OPTIONS,
    submitTaxonomySubcategoryForm,
}) {
    return (
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">Detail Taxonomy Preset</h2>
                                </div>
                                <div className="card-body">
                                    {detailLoading.taxonomy ? (
                                        <div className="spinner" />
                                    ) : taxonomyDetail?.preset ? (
                                        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{taxonomyDetail.preset.name}</div>
                                                <div className="text-sm text-muted">
                                                    {taxonomyDetail.preset.key} • v{taxonomyDetail.preset.version} • {scopeLabel(taxonomyDetail.preset.workspace_id)}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                                <span className={statusBadgeClass(taxonomyDetail.preset.status)}>{taxonomyDetail.preset.status}</span>
                                                <span className="badge badge-info">{taxonomyDetail.categories?.length || 0} kategori</span>
                                                <span className="badge badge-info">{taxonomyDetail.subcategories?.length || 0} intent</span>
                                            </div>
                                            <div className="text-sm text-muted">{taxonomyDetail.preset.description || 'Tidak ada deskripsi'}</div>
                                            <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 'var(--space-3)', display: 'grid', gap: 'var(--space-4)' }}>
                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                                                        <div className="text-xs text-muted">Daftar Kategori Preset</div>
                                                        {editingPresetCategoryId && (
                                                            <button type="button" className="btn btn-ghost btn-sm" onClick={resetTaxonomyCategoryForm}>
                                                                Batal Edit
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'grid', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                                                        {(taxonomyDetail.categories || []).map((cat) => (
                                                            <div key={cat.id} style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'center' }}>
                                                                    <div style={{ minWidth: 0 }}>
                                                                        <div className="text-sm" style={{ fontWeight: 600 }}>{cat.label}</div>
                                                                        <div className="text-xs text-muted">{cat.key} • urutan {cat.sort_order}</div>
                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEditPresetCategory(cat)}>Edit</button>
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-ghost btn-sm"
                                                                            onClick={() => patchTaxonomyPresetCategory(cat.id, { is_active: !cat.is_active }, cat.is_active ? 'Kategori dinonaktifkan.' : 'Kategori diaktifkan.')}
                                                                            disabled={taxonomyEditorSaving}
                                                                        >
                                                                            {cat.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-ghost btn-sm"
                                                                            style={{ color: 'var(--error-600)' }}
                                                                            onClick={() => deleteTaxonomyPresetCategory(cat)}
                                                                            disabled={taxonomyEditorSaving}
                                                                        >
                                                                            Hapus
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-2)' }}>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">Key Kategori</label>
                                                            <input
                                                                className="form-input"
                                                                value={taxonomyCategoryForm.key}
                                                                onChange={(e) => setTaxonomyCategoryForm((p) => ({ ...p, key: e.target.value }))}
                                                                disabled={!!editingPresetCategoryId}
                                                                placeholder="evaluation"
                                                            />
                                                        </div>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">Nama Kategori</label>
                                                            <input
                                                                className="form-input"
                                                                value={taxonomyCategoryForm.label}
                                                                onChange={(e) => setTaxonomyCategoryForm((p) => ({ ...p, label: e.target.value }))}
                                                                placeholder="Evaluation"
                                                            />
                                                        </div>
                                                        <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                                                            <label className="form-label">Deskripsi</label>
                                                            <input
                                                                className="form-input"
                                                                value={taxonomyCategoryForm.description}
                                                                onChange={(e) => setTaxonomyCategoryForm((p) => ({ ...p, description: e.target.value }))}
                                                                placeholder="Deskripsi kategori"
                                                            />
                                                        </div>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">Urutan</label>
                                                            <input
                                                                type="number"
                                                                className="form-input"
                                                                value={taxonomyCategoryForm.sort_order}
                                                                onChange={(e) => setTaxonomyCategoryForm((p) => ({ ...p, sort_order: e.target.value }))}
                                                            />
                                                        </div>
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '22px' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={!!taxonomyCategoryForm.is_active}
                                                                onChange={(e) => setTaxonomyCategoryForm((p) => ({ ...p, is_active: e.target.checked }))}
                                                            />
                                                            <span className="text-sm">Aktif</span>
                                                        </label>
                                                    </div>
                                                    <div style={{ marginTop: 'var(--space-2)' }}>
                                                        <button className="btn btn-secondary" type="button" onClick={submitTaxonomyCategoryForm} disabled={taxonomyEditorSaving}>
                                                            {taxonomyEditorSaving ? <RefreshCw size={14} className="spinner" /> : null}
                                                            {editingPresetCategoryId ? 'Simpan Kategori' : 'Tambah Kategori'}
                                                        </button>
                                                    </div>
                                                </div>
        
                                                <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 'var(--space-3)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                                                        <div className="text-xs text-muted">Daftar Intent / Subcategory</div>
                                                        {editingPresetSubcategoryId && (
                                                            <button type="button" className="btn btn-ghost btn-sm" onClick={resetTaxonomySubcategoryForm}>
                                                                Batal Edit
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div style={{ maxHeight: 280, overflow: 'auto', display: 'grid', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                                                        {(taxonomyDetail.subcategories || []).map((s) => (
                                                            <div key={s.id} style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                                                                    <div style={{ minWidth: 0 }}>
                                                                        <div className="text-sm" style={{ fontWeight: 600 }}>{s.label}</div>
                                                                        <div className="text-xs text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                            {s.key} • {s.category_key} • {s.reply_mode} • {s.greeting_policy} • target {s.default_template_count}
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEditPresetSubcategory(s)}>Edit</button>
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-ghost btn-sm"
                                                                            onClick={() => patchTaxonomyPresetSubcategory(s.id, { is_active: !s.is_active }, s.is_active ? 'Intent dinonaktifkan.' : 'Intent diaktifkan.')}
                                                                            disabled={taxonomyEditorSaving}
                                                                        >
                                                                            {s.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-ghost btn-sm"
                                                                            style={{ color: 'var(--error-600)' }}
                                                                            onClick={() => deleteTaxonomyPresetSubcategory(s)}
                                                                            disabled={taxonomyEditorSaving}
                                                                        >
                                                                            Hapus
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-2)' }}>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">Kategori</label>
                                                            <select
                                                                className="form-select"
                                                                value={taxonomySubcategoryForm.category_key}
                                                                onChange={(e) => setTaxonomySubcategoryForm((p) => ({ ...p, category_key: e.target.value }))}
                                                            >
                                                                <option value="">Pilih kategori</option>
                                                                {(taxonomyDetail.categories || []).map((cat) => (
                                                                    <option key={cat.id} value={cat.key}>{cat.label} ({cat.key})</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">Key Intent</label>
                                                            <input
                                                                className="form-input"
                                                                value={taxonomySubcategoryForm.key}
                                                                onChange={(e) => setTaxonomySubcategoryForm((p) => ({ ...p, key: e.target.value }))}
                                                                disabled={!!editingPresetSubcategoryId}
                                                                placeholder="evaluation.objection_price"
                                                            />
                                                        </div>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">Nama Intent</label>
                                                            <input
                                                                className="form-input"
                                                                value={taxonomySubcategoryForm.label}
                                                                onChange={(e) => setTaxonomySubcategoryForm((p) => ({ ...p, label: e.target.value }))}
                                                                placeholder="Objection Price"
                                                            />
                                                        </div>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">Jumlah Template Default</label>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                className="form-input"
                                                                value={taxonomySubcategoryForm.default_template_count}
                                                                onChange={(e) => setTaxonomySubcategoryForm((p) => ({ ...p, default_template_count: e.target.value }))}
                                                            />
                                                        </div>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">Mode Balasan</label>
                                                            <select
                                                                className="form-select"
                                                                value={taxonomySubcategoryForm.reply_mode}
                                                                onChange={(e) => setTaxonomySubcategoryForm((p) => ({ ...p, reply_mode: e.target.value }))}
                                                            >
                                                                {REPLY_MODE_OPTIONS.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                                                            </select>
                                                        </div>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">Aturan Greeting</label>
                                                            <select
                                                                className="form-select"
                                                                value={taxonomySubcategoryForm.greeting_policy}
                                                                onChange={(e) => setTaxonomySubcategoryForm((p) => ({ ...p, greeting_policy: e.target.value }))}
                                                            >
                                                                {GREETING_POLICY_OPTIONS.map((policy) => <option key={policy} value={policy}>{policy}</option>)}
                                                            </select>
                                                        </div>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">Urutan</label>
                                                            <input
                                                                type="number"
                                                                className="form-input"
                                                                value={taxonomySubcategoryForm.sort_order}
                                                                onChange={(e) => setTaxonomySubcategoryForm((p) => ({ ...p, sort_order: e.target.value }))}
                                                            />
                                                        </div>
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '22px' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={!!taxonomySubcategoryForm.is_active}
                                                                onChange={(e) => setTaxonomySubcategoryForm((p) => ({ ...p, is_active: e.target.checked }))}
                                                            />
                                                            <span className="text-sm">Aktif</span>
                                                        </label>
                                                        <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                                                            <label className="form-label">Deskripsi</label>
                                                            <textarea
                                                                className="form-input"
                                                                rows={3}
                                                                value={taxonomySubcategoryForm.description}
                                                                onChange={(e) => setTaxonomySubcategoryForm((p) => ({ ...p, description: e.target.value }))}
                                                                placeholder="Deskripsi intent untuk classifier/generator"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div style={{ marginTop: 'var(--space-2)' }}>
                                                        <button className="btn btn-secondary" type="button" onClick={submitTaxonomySubcategoryForm} disabled={taxonomyEditorSaving}>
                                                            {taxonomyEditorSaving ? <RefreshCw size={14} className="spinner" /> : null}
                                                            {editingPresetSubcategoryId ? 'Simpan Intent' : 'Tambah Intent'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                                            <div className="empty-state-icon"><ListTree size={20} /></div>
                                            <p className="text-sm text-muted">Klik salah satu taxonomy preset untuk melihat dan mengedit detailnya</p>
                                        </div>
                                    )}
                                </div>
                            </div>
    )
}

export default TaxonomyPresetDetailPanel
