import { useState, useEffect } from 'react'
import { Save, Loader2, X, Info } from 'lucide-react'

const ModalWrapperLarge = ({ title, onClose, children }) => (
    <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 'var(--space-4)'
    }}>
        <div style={{
            background: 'white',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '800px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-2xl)'
        }}>
            <div style={{
                padding: 'var(--space-4)',
                borderBottom: '1px solid var(--gray-200)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--gray-50)',
                borderTopLeftRadius: 'var(--radius-lg)',
                borderTopRightRadius: 'var(--radius-lg)'
            }}>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{title}</h3>
                <button onClick={onClose} className="btn btn-icon" style={{ background: 'white' }}>
                    <X size={18} />
                </button>
            </div>
            <div style={{ padding: 'var(--space-5)', overflowY: 'auto', flex: 1 }}>
                {children}
            </div>
        </div>
    </div>
)

export function TemplateEditorModal({
    isOpen,
    onClose,
    onSave,
    initialData,
    loading,
    taxonomy
}) {
    const [form, setForm] = useState({ name: '', content: '', category: '', sub_category: '' })

    useEffect(() => {
        if (isOpen) {
            setForm(initialData || { name: '', content: '', category: '', sub_category: '' })
        }
    }, [isOpen, initialData])

    if (!isOpen) return null

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave(form)
    }

    const { categories, subcategories } = taxonomy
    const filteredSubcategories = subcategories.filter(s => s.category_key === form.category)

    // Help inject legacy categories if needed (like the original BotTemplates does)
    const categoryOptions = [...categories]
    if (form.category && !categoryOptions.some(c => c.key === form.category)) {
        categoryOptions.push({ key: form.category, label: `${form.category} (legacy)` })
    }

    const subcategoryOptions = [...filteredSubcategories]
    if (form.sub_category && !subcategoryOptions.some(s => s.key === form.sub_category)) {
        subcategoryOptions.push({ key: form.sub_category, label: `${form.sub_category} (legacy)` })
    }

    return (
        <ModalWrapperLarge title={initialData?.id ? 'Edit Template Balasan' : 'Buat Template Baru'} onClose={onClose}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Taxonomy Selectors */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div className="form-group">
                        <label className="form-label">Kategori</label>
                        <select
                            className="form-input"
                            value={form.category || ''}
                            onChange={(e) => {
                                const cat = e.target.value;
                                const firstSub = subcategories.find(s => s.category_key === cat)?.key || ''
                                setForm(prev => ({ ...prev, category: cat, sub_category: firstSub }))
                            }}
                        >
                            <option value="">-- Pilih --</option>
                            {categoryOptions.map(c => (
                                <option key={c.key} value={c.key}>{c.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Intent / Sub-Kategori</label>
                        <select
                            className="form-input"
                            value={form.sub_category || ''}
                            onChange={e => setForm({ ...form, sub_category: e.target.value })}
                        >
                            <option value="">-- Bebas (General) --</option>
                            {subcategoryOptions.map(s => (
                                <option key={s.key} value={s.key}>{s.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Nama / Konteks Template</label>
                    <input
                        className="form-input"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder="Contoh: Variasi Jawaban Harga Normal"
                        required
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Format / Isi Balasan (Bot Prompt)</label>
                    <div style={{
                        background: 'var(--primary-50)',
                        border: '1px solid var(--primary-200)',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: 'var(--space-2)',
                        fontSize: '12px',
                        color: 'var(--primary-800)',
                        display: 'flex',
                        gap: '8px'
                    }}>
                        <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                            <strong>Tips Variabel:</strong> Anda dapat menggunakan variabel yang didukung RAG Engine seperti <code>{`{nama_pelanggan}`}</code>, <code>{`{nama_bisnis}`}</code>.
                            LLM akan menggunakan ini sebagai panduan gaya bahasa, tidak melakukan copy-paste secara mentah (kecuali disuruh).
                        </div>
                    </div>
                    <textarea
                        className="form-input form-textarea"
                        rows={10}
                        value={form.content}
                        onChange={e => setForm({ ...form, content: e.target.value })}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: 1.6 }}
                        placeholder="Tuliskan format gaya bahasa bot di sini..."
                        required
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                        Batal
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading || !form.name || !form.content}>
                        {loading ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
                        {initialData?.id ? 'Perbarui Template' : 'Simpan Template'}
                    </button>
                </div>
            </form>
        </ModalWrapperLarge>
    )
}
