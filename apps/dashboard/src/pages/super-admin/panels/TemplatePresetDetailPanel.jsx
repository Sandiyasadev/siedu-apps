import { Boxes, CheckCircle2, RefreshCw } from 'lucide-react'

function TemplatePresetDetailPanel({
    detailLoading,
    templateDetail,
    scopeLabel,
    statusBadgeClass,
    templatePresetForm,
    setTemplatePresetForm,
    templatePresetSaving,
    resetTemplatePresetForm,
    saveTemplatePresetMeta,
    taxonomyPresets,
    templateImportForm,
    setTemplateImportForm,
    handleTemplateGeneratorJsonFileChange,
    importTemplatePresetFromGeneratorJson,
    templateImportLoading,
    lastTemplateImportSummary,
    editingTemplatePresetItemId,
    resetTemplatePresetItemForm,
    templatePresetItemForm,
    setTemplatePresetItemForm,
    startEditTemplatePresetItem,
    patchTemplatePresetItem,
    deleteTemplatePresetItem,
    templateEditorSaving,
    submitTemplatePresetItemForm,
}) {
    return (
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">Detail Template Preset</h2>
                                </div>
                                <div className="card-body">
                                    {detailLoading.template ? (
                                        <div className="spinner" />
                                    ) : templateDetail?.preset ? (
                                        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{templateDetail.preset.name}</div>
                                                <div className="text-sm text-muted">
                                                    {templateDetail.preset.key} • v{templateDetail.preset.version} • {scopeLabel(templateDetail.preset.workspace_id)}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                                <span className={statusBadgeClass(templateDetail.preset.status)}>{templateDetail.preset.status}</span>
                                                <span className="badge badge-info">{templateDetail.items?.length || 0} item</span>
                                                {templateDetail.preset.taxonomy_preset_id ? (
                                                    <span className="badge badge-success"><CheckCircle2 size={12} /> taxonomy terhubung</span>
                                                ) : (
                                                    <span className="badge badge-warning">taxonomy belum terhubung</span>
                                                )}
                                            </div>
                                            <div className="text-sm text-muted">{templateDetail.preset.description || 'Tidak ada deskripsi'}</div>
                                            <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 'var(--space-3)', display: 'grid', gap: 'var(--space-4)' }}>
                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                                                        <div className="text-xs text-muted">Metadata Template Preset</div>
                                                        <button type="button" className="btn btn-ghost btn-sm" onClick={resetTemplatePresetForm} disabled={templatePresetSaving}>
                                                            Reset
                                                        </button>
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-2)' }}>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">Nama Preset</label>
                                                            <input
                                                                className="form-input"
                                                                value={templatePresetForm.name}
                                                                onChange={(e) => setTemplatePresetForm((p) => ({ ...p, name: e.target.value }))}
                                                                placeholder="Default Templates V1"
                                                            />
                                                        </div>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">Status</label>
                                                            <select
                                                                className="form-select"
                                                                value={templatePresetForm.status}
                                                                onChange={(e) => setTemplatePresetForm((p) => ({ ...p, status: e.target.value }))}
                                                            >
                                                                <option value="draft">draft</option>
                                                                <option value="published">published</option>
                                                                <option value="archived">archived</option>
                                                            </select>
                                                        </div>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">Taxonomy Preset Terkait</label>
                                                            <select
                                                                className="form-select"
                                                                value={templatePresetForm.taxonomy_preset_id}
                                                                onChange={(e) => setTemplatePresetForm((p) => ({ ...p, taxonomy_preset_id: e.target.value }))}
                                                            >
                                                                <option value="">Tidak ada (belum terhubung)</option>
                                                                {taxonomyPresets.map((p) => (
                                                                    <option key={p.id} value={p.id}>
                                                                        {p.name} ({p.key} v{p.version})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                                                            <label className="form-label">Deskripsi</label>
                                                            <textarea
                                                                className="form-input"
                                                                rows={3}
                                                                value={templatePresetForm.description}
                                                                onChange={(e) => setTemplatePresetForm((p) => ({ ...p, description: e.target.value }))}
                                                                placeholder="Deskripsi preset"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div style={{ marginTop: 'var(--space-2)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                                        <button className="btn btn-secondary" type="button" onClick={saveTemplatePresetMeta} disabled={templatePresetSaving}>
                                                            {templatePresetSaving ? <RefreshCw size={14} className="spinner" /> : null}
                                                            Simpan Metadata Preset
                                                        </button>
                                                    </div>
                                                </div>
        
                                                <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 'var(--space-3)' }}>
                                                    <div className="text-xs text-muted" style={{ marginBottom: 'var(--space-2)' }}>Import JSON Generator</div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-2)' }}>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">Mode Import</label>
                                                            <select
                                                                className="form-select"
                                                                value={templateImportForm.mode}
                                                                onChange={(e) => setTemplateImportForm((p) => ({ ...p, mode: e.target.value }))}
                                                            >
                                                                <option value="replace_all">replace_all (ganti semua item preset)</option>
                                                                <option value="append_skip_existing">append_skip_existing (tambah yang belum ada)</option>
                                                            </select>
                                                        </div>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">File JSON Generator</label>
                                                            <input
                                                                type="file"
                                                                accept=".json,application/json"
                                                                className="form-input"
                                                                onChange={handleTemplateGeneratorJsonFileChange}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-muted" style={{ marginTop: 'var(--space-2)' }}>
                                                        Format yang didukung: output generator dengan field <code>templates[]</code>. Jika preset terhubung ke taxonomy, item dengan intent yang tidak valid akan dilewati.
                                                    </div>
                                                    {templateImportForm.file_name && (
                                                        <div style={{ marginTop: 'var(--space-2)' }} className="text-sm text-muted">
                                                            File terpilih: <strong>{templateImportForm.file_name}</strong>
                                                            {Array.isArray(templateImportForm.source_json?.templates) ? ` • ${templateImportForm.source_json.templates.length} template` : ''}
                                                        </div>
                                                    )}
                                                    <div style={{ marginTop: 'var(--space-2)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                                        <button
                                                            className="btn btn-secondary"
                                                            type="button"
                                                            onClick={importTemplatePresetFromGeneratorJson}
                                                            disabled={templateImportLoading || !templateImportForm.source_json}
                                                        >
                                                            {templateImportLoading ? <RefreshCw size={14} className="spinner" /> : <Boxes size={14} />}
                                                            Import JSON ke Preset
                                                        </button>
                                                    </div>
                                                    {lastTemplateImportSummary && (
                                                        <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                                            <span className="badge badge-info">Mode: {lastTemplateImportSummary.mode}</span>
                                                            <span className="badge badge-success">Dibuat: {lastTemplateImportSummary.created || 0}</span>
                                                            <span className="badge badge-neutral">Dihapus: {lastTemplateImportSummary.replaced_deleted || 0}</span>
                                                            <span className="badge badge-warning">Lewat (sudah ada): {lastTemplateImportSummary.skipped_existing || 0}</span>
                                                            <span className="badge badge-warning">Lewat (invalid): {lastTemplateImportSummary.skipped_invalid || 0}</span>
                                                            <span className="badge badge-warning">Lewat (taxonomy belum ada): {lastTemplateImportSummary.skipped_missing_taxonomy || 0}</span>
                                                            <span className="badge badge-warning">Lewat (taxonomy mismatch): {lastTemplateImportSummary.skipped_taxonomy_mismatch || 0}</span>
                                                        </div>
                                                    )}
                                                </div>
        
                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                                                        <div className="text-xs text-muted">Daftar Item Template Preset</div>
                                                        {editingTemplatePresetItemId && (
                                                            <button type="button" className="btn btn-ghost btn-sm" onClick={resetTemplatePresetItemForm}>
                                                                Batal Edit
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div style={{ maxHeight: 280, overflow: 'auto', display: 'grid', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                                                        {(templateDetail.items || []).map((item) => (
                                                            <div key={item.id} style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                                            <div className="text-sm" style={{ fontWeight: 600 }}>{item.name}</div>
                                                                            {!item.is_active && <span className="badge badge-neutral">nonaktif</span>}
                                                                            {item.requires_rag && <span className="badge badge-warning">RAG</span>}
                                                                        </div>
                                                                        <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                                                                            {(item.sub_category || item.category)} • {item.category} • urutan {item.sort_order || 0}
                                                                            {item.strategy_tag ? ` • ${item.strategy_tag}` : ''}
                                                                        </div>
                                                                        <div className="text-xs text-muted" style={{
                                                                            marginTop: 4,
                                                                            whiteSpace: 'nowrap',
                                                                            overflow: 'hidden',
                                                                            textOverflow: 'ellipsis'
                                                                        }}>
                                                                            {item.content}
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignContent: 'flex-start' }}>
                                                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEditTemplatePresetItem(item)}>Edit</button>
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-ghost btn-sm"
                                                                            onClick={() => patchTemplatePresetItem(item.id, { is_active: !item.is_active }, item.is_active ? 'Item template preset dinonaktifkan.' : 'Item template preset diaktifkan.')}
                                                                            disabled={templateEditorSaving}
                                                                        >
                                                                            {item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-ghost btn-sm"
                                                                            style={{ color: 'var(--error-600)' }}
                                                                            onClick={() => deleteTemplatePresetItem(item)}
                                                                            disabled={templateEditorSaving}
                                                                        >
                                                                            Hapus
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {(templateDetail.items || []).length === 0 && (
                                                            <div className="text-sm text-muted">Belum ada item template preset.</div>
                                                        )}
                                                    </div>
        
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-2)' }}>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">Nama</label>
                                                            <input
                                                                className="form-input"
                                                                value={templatePresetItemForm.name}
                                                                onChange={(e) => setTemplatePresetItemForm((p) => ({ ...p, name: e.target.value }))}
                                                                placeholder="Soft CTA - follow up"
                                                            />
                                                        </div>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">Kategori</label>
                                                            <input
                                                                className="form-input"
                                                                value={templatePresetItemForm.category}
                                                                onChange={(e) => setTemplatePresetItemForm((p) => ({ ...p, category: e.target.value }))}
                                                                placeholder="conversion"
                                                            />
                                                        </div>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">Sub Category / Intent</label>
                                                            <input
                                                                className="form-input"
                                                                value={templatePresetItemForm.sub_category}
                                                                onChange={(e) => setTemplatePresetItemForm((p) => ({ ...p, sub_category: e.target.value }))}
                                                                placeholder="conversion.soft"
                                                            />
                                                        </div>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">Strategy Tag</label>
                                                            <input
                                                                className="form-input"
                                                                value={templatePresetItemForm.strategy_tag}
                                                                onChange={(e) => setTemplatePresetItemForm((p) => ({ ...p, strategy_tag: e.target.value }))}
                                                                placeholder="soft_cta"
                                                            />
                                                        </div>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">Shortcut (opsional)</label>
                                                            <input
                                                                className="form-input"
                                                                value={templatePresetItemForm.shortcut}
                                                                onChange={(e) => setTemplatePresetItemForm((p) => ({ ...p, shortcut: e.target.value }))}
                                                                placeholder="/soft1"
                                                            />
                                                        </div>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label className="form-label">Urutan</label>
                                                            <input
                                                                type="number"
                                                                className="form-input"
                                                                value={templatePresetItemForm.sort_order}
                                                                onChange={(e) => setTemplatePresetItemForm((p) => ({ ...p, sort_order: e.target.value }))}
                                                            />
                                                        </div>
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '22px' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={!!templatePresetItemForm.is_active}
                                                                onChange={(e) => setTemplatePresetItemForm((p) => ({ ...p, is_active: e.target.checked }))}
                                                            />
                                                            <span className="text-sm">Aktif</span>
                                                        </label>
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '22px' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={!!templatePresetItemForm.requires_rag}
                                                                onChange={(e) => setTemplatePresetItemForm((p) => ({ ...p, requires_rag: e.target.checked }))}
                                                            />
                                                            <span className="text-sm">Butuh RAG</span>
                                                        </label>
                                                        <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                                                            <label className="form-label">Isi Template</label>
                                                            <textarea
                                                                className="form-input"
                                                                rows={5}
                                                                value={templatePresetItemForm.content}
                                                                onChange={(e) => setTemplatePresetItemForm((p) => ({ ...p, content: e.target.value }))}
                                                                placeholder="Isi template..."
                                                            />
                                                        </div>
                                                    </div>
                                                    <div style={{ marginTop: 'var(--space-2)' }}>
                                                        <button className="btn btn-secondary" type="button" onClick={submitTemplatePresetItemForm} disabled={templateEditorSaving}>
                                                            {templateEditorSaving ? <RefreshCw size={14} className="spinner" /> : null}
                                                            {editingTemplatePresetItemId ? 'Simpan Item Template' : 'Tambah Item Template'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                                            <div className="empty-state-icon"><Boxes size={20} /></div>
                                            <p className="text-sm text-muted">Klik salah satu template preset untuk melihat dan mengedit detailnya</p>
                                        </div>
                                    )}
                                </div>
                            </div>
    )
}

export default TemplatePresetDetailPanel
