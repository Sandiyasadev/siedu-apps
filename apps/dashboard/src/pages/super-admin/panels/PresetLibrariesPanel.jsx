function PresetLibrariesPanel({
    taxonomyPresets,
    templatePresets,
    fetchTaxonomyDetail,
    fetchTemplateDetail,
    statusBadgeClass,
    scopeLabel,
}) {
    return (
                        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                            <div className="card">
                                <div className="card-body" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                    <div className="text-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                                        Pilih preset untuk mengedit detail
                                    </div>
                                    <div className="text-sm text-muted">
                                        Klik salah satu baris pada tabel taxonomy atau template untuk membuka detail editor di panel bawah.
                                    </div>
                                </div>
                            </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">Taxonomy Preset</h2>
                                </div>
                                <div className="card-body" style={{ padding: 0 }}>
                                    <div className="table-container">
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>Preset</th>
                                                    <th>Status</th>
                                                    <th>Counts</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {taxonomyPresets.map((preset) => (
                                                    <tr
                                                        key={preset.id}
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => fetchTaxonomyDetail(preset.id)}
                                                    >
                                                        <td>
                                                            <div style={{ fontWeight: 600 }}>{preset.name}</div>
                                                            <div className="text-xs text-muted">
                                                                {preset.key} • v{preset.version} • {scopeLabel(preset.workspace_id)}
                                                            </div>
                                                        </td>
                                                        <td><span className={statusBadgeClass(preset.status)}>{preset.status}</span></td>
                                                        <td className="text-sm">
                                                            {preset.categories_count || 0} kategori • {preset.subcategories_count || 0} intent
                                                        </td>
                                                    </tr>
                                                ))}
                                                {taxonomyPresets.length === 0 && (
                                                    <tr><td colSpan={3} className="text-sm text-muted">Belum ada taxonomy preset</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
        
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">Template Preset</h2>
                                </div>
                                <div className="card-body" style={{ padding: 0 }}>
                                    <div className="table-container">
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>Preset</th>
                                                    <th>Status</th>
                                                    <th>Items</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {templatePresets.map((preset) => (
                                                    <tr
                                                        key={preset.id}
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => fetchTemplateDetail(preset.id)}
                                                    >
                                                        <td>
                                                            <div style={{ fontWeight: 600 }}>{preset.name}</div>
                                                            <div className="text-xs text-muted">
                                                                {preset.key} • v{preset.version} • {scopeLabel(preset.workspace_id)}
                                                            </div>
                                                        </td>
                                                        <td><span className={statusBadgeClass(preset.status)}>{preset.status}</span></td>
                                                        <td className="text-sm">{preset.items_count || 0}</td>
                                                    </tr>
                                                ))}
                                                {templatePresets.length === 0 && (
                                                    <tr><td colSpan={3} className="text-sm text-muted">Belum ada template preset</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                        </div>
    )
}

export default PresetLibrariesPanel
