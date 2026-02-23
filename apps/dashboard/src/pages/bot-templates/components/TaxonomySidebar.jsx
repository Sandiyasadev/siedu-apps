import { FolderOpen, Settings2, Hash, Edit2, ShieldQuestion } from 'lucide-react'

// Helper color map based on category
export const CATEGORY_COLORS = {
    engagement: { bg: '#dcfce7', color: '#166534' },
    discovery: { bg: '#e0f2fe', color: '#0369a1' },
    evaluation: { bg: '#fef3c7', color: '#92400e' },
    conversion: { bg: '#ede9fe', color: '#6d28d9' },
    retention: { bg: '#fee2e2', color: '#991b1b' },
    general: { bg: '#f3f4f6', color: '#374151' },
}

export const REPLY_MODE_COLORS = {
    opening: { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
    mixed: { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    continuation: { bg: '#f3f4f6', color: '#374151', border: '#e5e7eb' },
}

export function TaxonomySidebar({
    taxonomy,
    filter,
    setFilter,
    onEditCategory,
    onEditSubcategory,
    onAddCategory,
    onAddSubcategory
}) {

    const handleSelectCategory = (catKey) => {
        setFilter(prev => ({
            ...prev,
            category: prev.category === catKey ? '' : catKey,
            sub_category: '__all__'
        }))
    }

    const handleSelectSub = (e, subKey, catKey) => {
        e.stopPropagation()
        setFilter(prev => ({
            ...prev,
            category: catKey,
            sub_category: prev.sub_category === subKey ? '__all__' : subKey
        }))
    }

    return (
        <aside style={{
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid var(--gray-200)',
            background: 'white',
            overflowY: 'auto',
            minHeight: '400px',
            maxHeight: 'calc(100vh - 180px)'
        }}>
            <div style={{
                padding: 'var(--space-3) var(--space-4)',
                borderBottom: '1px solid var(--gray-200)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(4px)',
                zIndex: 10
            }}>
                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FolderOpen size={16} /> Struktur Taksonomi
                </h3>
                <button
                    onClick={onAddCategory}
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)' }}
                    title="Tambah Kategori Baru"
                >
                    + Kategori
                </button>
            </div>

            <div style={{ padding: 'var(--space-3)' }}>
                {/* Reset Filter Item */}
                <div
                    onClick={() => setFilter({ category: '', sub_category: '__all__', status: '__all__' })}
                    style={{
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        background: (!filter.category && filter.sub_category === '__all__') ? 'var(--primary-50)' : 'transparent',
                        color: (!filter.category && filter.sub_category === '__all__') ? 'var(--primary-700)' : 'var(--gray-700)',
                        fontWeight: (!filter.category && filter.sub_category === '__all__') ? 600 : 400,
                        marginBottom: 'var(--space-2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: 'var(--font-size-sm)'
                    }}
                >
                    <Hash size={14} />
                    <span>Semua Kategori & Intent</span>
                </div>

                {/* Categories List */}
                {(taxonomy.categories || []).map(cat => {
                    const isCatSelected = filter.category === cat.key
                    const cColor = CATEGORY_COLORS[cat.key] || CATEGORY_COLORS.general
                    const catSubcategories = (taxonomy.subcategories || []).filter(s => s.category_key === cat.key)

                    return (
                        <div key={cat.key || cat.id} style={{ marginBottom: 'var(--space-2)' }}>
                            <div
                                onClick={() => handleSelectCategory(cat.key)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: 'var(--space-2) var(--space-3)',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    background: isCatSelected ? cColor.bg : 'transparent',
                                    border: `1px solid ${isCatSelected ? cColor.color + '40' : 'transparent'}`,
                                    transition: 'background 0.2s',
                                    fontSize: 'var(--font-size-sm)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isCatSelected ? cColor.color : 'inherit', fontWeight: isCatSelected ? 600 : 500 }}>
                                    <FolderOpen size={14} fill={isCatSelected ? cColor.color : 'none'} color={isCatSelected ? cColor.color : 'currentColor'} />
                                    <span>{cat.label}</span>
                                    {!cat.is_active && (
                                        <span style={{ fontSize: '10px', background: 'var(--gray-200)', padding: '2px 6px', borderRadius: '4px' }}>nonaktif</span>
                                    )}
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onEditCategory(cat) }}
                                    className="btn btn-icon"
                                    style={{ padding: '4px', opacity: isCatSelected ? 1 : 0.5 }}
                                    title="Pengaturan Kategori"
                                >
                                    <Edit2 size={12} />
                                </button>
                            </div>

                            {/* Subcategories (only show if category is selected) */}
                            {isCatSelected && (
                                <div style={{
                                    paddingLeft: 'var(--space-6)',
                                    marginTop: 'var(--space-1)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px'
                                }}>
                                    {catSubcategories.map(sub => {
                                        const isSubSelected = filter.sub_category === sub.key
                                        const rMode = REPLY_MODE_COLORS[sub.reply_mode || 'continuation']

                                        return (
                                            <div
                                                key={sub.id}
                                                onClick={(e) => handleSelectSub(e, sub.key, cat.key)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    justifyContent: 'space-between',
                                                    padding: '6px 8px',
                                                    borderRadius: 'var(--radius-md)',
                                                    cursor: 'pointer',
                                                    background: isSubSelected ? 'var(--gray-100)' : 'transparent',
                                                    fontSize: '13px'
                                                }}
                                            >
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span style={{ fontWeight: isSubSelected ? 600 : 400, color: 'var(--gray-900)' }}>
                                                        {sub.label}
                                                    </span>
                                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                        <span style={{
                                                            fontSize: '10px',
                                                            padding: '2px 4px',
                                                            borderRadius: '4px',
                                                            background: rMode.bg,
                                                            color: rMode.color,
                                                            border: `1px solid ${rMode.border}`,
                                                            fontWeight: 500
                                                        }}>
                                                            {sub.reply_mode}
                                                        </span>
                                                        {!sub.is_active && (
                                                            <span style={{ fontSize: '10px', color: 'var(--error-600)' }}>[nonaktif]</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onEditSubcategory(sub) }}
                                                        className="btn btn-icon"
                                                        style={{ padding: '2px' }}
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}

                                    <button
                                        onClick={() => onAddSubcategory(cat.key)}
                                        className="btn btn-secondary"
                                        style={{
                                            marginTop: '4px',
                                            padding: '4px 8px',
                                            fontSize: '12px',
                                            justifyContent: 'flex-start',
                                            border: '1px dashed var(--gray-300)',
                                            background: 'transparent'
                                        }}
                                    >
                                        + Tambah Intent
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                })}

                {/* Uncategorized (Legacy) */}
                {taxonomy.uncategorized_subcategories?.length > 0 && (
                    <div style={{ marginTop: 'var(--space-4)' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '8px' }}>
                            Legacy / Uncategorized
                        </div>
                        {taxonomy.uncategorized_subcategories.map(sub => (
                            <div
                                key={sub.id}
                                onClick={() => handleSelectSub({ stopPropagation: () => { } }, sub.key, null)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '6px 12px',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    background: filter.sub_category === sub.key ? 'var(--gray-100)' : 'transparent',
                                    fontSize: '13px',
                                    color: 'var(--gray-600)'
                                }}
                            >
                                <ShieldQuestion size={14} style={{ marginRight: '8px' }} />
                                {sub.label || sub.key}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </aside>
    )
}
