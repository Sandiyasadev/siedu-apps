import { Plus, Edit2, ToggleLeft, ToggleRight, Loader2, Trash2 } from 'lucide-react'

// Render a single template card
function TemplateCard({
    template,
    onEdit,
    onToggle,
    onDelete,
    actionLoadingPrefix
}) {
    const isToggling = actionLoadingPrefix === `template:${template.id}`

    return (
        <div style={{
            background: 'white',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--gray-200)',
            padding: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            opacity: template.is_active ? 1 : 0.6,
            transition: 'all 0.2s ease',
            boxShadow: 'var(--shadow-sm)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                <div style={{ paddingRight: 'var(--space-4)' }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-md)', color: 'var(--gray-900)', marginBottom: '4px' }}>
                        {template.name}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '4px', position: 'absolute', top: '12px', right: '12px' }}>
                    <button
                        onClick={() => onEdit(template)}
                        className="btn btn-icon"
                        title="Edit Template"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        onClick={() => onToggle(template)}
                        className="btn btn-icon"
                        disabled={isToggling}
                        title={template.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    >
                        {isToggling ? (
                            <Loader2 size={16} className="spinner" />
                        ) : template.is_active ? (
                            <ToggleRight size={18} color="var(--success-600)" />
                        ) : (
                            <ToggleLeft size={18} color="var(--gray-400)" />
                        )}
                    </button>
                    <button
                        onClick={() => onDelete(template)}
                        className="btn btn-icon"
                        style={{ color: 'var(--error-600)' }}
                        title="Hapus"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            <div style={{
                background: 'var(--gray-50)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                flex: 1,
                fontSize: '13px',
                lineHeight: 1.5,
                color: 'var(--gray-700)',
                whiteSpace: 'pre-wrap',
                fontFamily: 'var(--font-mono)',
                maxHeight: '150px',
                overflowY: 'auto',
                border: '1px solid var(--gray-200)'
            }}>
                {template.content || <em style={{ color: 'var(--gray-400)' }}>Kosong</em>}
            </div>

            <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {template.category && (
                    <span style={{ fontSize: '11px', background: 'var(--gray-100)', padding: '2px 8px', borderRadius: '12px', color: 'var(--gray-600)' }}>
                        cat: {template.category}
                    </span>
                )}
                {template.sub_category && (
                    <span style={{ fontSize: '11px', background: 'var(--primary-50)', padding: '2px 8px', borderRadius: '12px', color: 'var(--primary-700)' }}>
                        intent: {template.sub_category}
                    </span>
                )}
            </div>
        </div>
    )
}

export function TemplateWorkspace({
    templates,
    loading,
    filter,
    actionLoading,
    onAddTemplate,
    onEditTemplate,
    onToggleTemplate,
    onDeleteTemplate
}) {
    if (loading) {
        return (
            <div style={{ padding: 'var(--space-8)', display: 'flex', justifyContent: 'center', color: 'var(--gray-500)' }}>
                <Loader2 className="spinner" size={24} />
                <span style={{ marginLeft: '8px' }}>Memuat template...</span>
            </div>
        )
    }

    // Header title based on filter
    let headerTitle = 'Semua Kategori & Intent'
    if (filter.sub_category && filter.sub_category !== '__all__') {
        headerTitle = `Intent: ${filter.sub_category}`
    } else if (filter.category) {
        headerTitle = `Kategori: ${filter.category}`
    }

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Header/Toolbar */}
            <div style={{
                padding: 'var(--space-4)',
                borderBottom: '1px solid var(--gray-200)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'white',
                position: 'sticky',
                top: 0,
                zIndex: 10
            }}>
                <div>
                    <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, margin: 0 }}>{headerTitle}</h2>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--gray-500)' }}>
                        {templates.length} template ditemukan
                    </p>
                </div>
                <button className="btn btn-primary" onClick={onAddTemplate}>
                    <Plus size={16} /> Tambah Template
                </button>
            </div>

            {/* Template Grid View */}
            <div style={{ padding: 'var(--space-4)', overflowY: 'auto', flex: 1, background: 'var(--gray-50)' }}>
                {templates.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: 'var(--space-8)',
                        background: 'white',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px dashed var(--gray-300)',
                        color: 'var(--gray-500)'
                    }}>
                        <p style={{ marginBottom: 'var(--space-4)' }}>Belum ada template pada kriteria ini.</p>
                        <button className="btn btn-secondary" onClick={onAddTemplate} style={{ margin: '0 auto' }}>
                            <Plus size={14} /> Buat Template Pertama
                        </button>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: 'var(--space-4)',
                        alignItems: 'start'
                    }}>
                        {templates.map(t => (
                            <TemplateCard
                                key={t.id}
                                template={t}
                                onEdit={onEditTemplate}
                                onToggle={onToggleTemplate}
                                onDelete={onDeleteTemplate}
                                actionLoadingPrefix={actionLoading}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
