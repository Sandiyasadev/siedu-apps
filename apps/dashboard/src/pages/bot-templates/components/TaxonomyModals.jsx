import { useState, useEffect } from 'react'
import { Plus, Save, Loader2, X } from 'lucide-react'

// Common Modal Wrapper Container
const ModalWrapper = ({ title, onClose, children }) => (
    <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50
    }}>
        <div style={{
            background: 'white',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-xl)'
        }}>
            <div style={{
                padding: 'var(--space-4)',
                borderBottom: '1px solid var(--gray-200)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 600 }}>{title}</h3>
                <button onClick={onClose} className="btn btn-icon">
                    <X size={18} />
                </button>
            </div>
            <div style={{ padding: 'var(--space-4)', overflowY: 'auto' }}>
                {children}
            </div>
        </div>
    </div>
)

export function CategoryModal({ isOpen, onClose, onSave, initialData, isEdit, loading }) {
    const [form, setForm] = useState({ key: '', label: '', description: '', sort_order: 0 })

    useEffect(() => {
        if (isOpen) {
            setForm(initialData || { key: '', label: '', description: '', sort_order: 0 })
        }
    }, [isOpen, initialData])

    if (!isOpen) return null

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave(form)
    }

    return (
        <ModalWrapper title={isEdit ? 'Edit Kategori' : 'Tambah Kategori'} onClose={onClose}>
            <form onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                    <label className="form-label">Key {isEdit && '(Tidak bisa diubah)'}</label>
                    <input
                        className="form-input"
                        value={form.key}
                        onChange={e => setForm({ ...form, key: e.target.value })}
                        disabled={isEdit}
                        placeholder="contoh: evaluation"
                        required
                    />
                </div>
                <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                    <label className="form-label">Label</label>
                    <input
                        className="form-input"
                        value={form.label}
                        onChange={e => setForm({ ...form, label: e.target.value })}
                        placeholder="Evaluation Phase"
                        required
                    />
                </div>
                <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                    <label className="form-label">Deskripsi</label>
                    <textarea
                        className="form-input form-textarea"
                        rows={3}
                        value={form.description || ''}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        placeholder="Deskripsi singkat..."
                    />
                </div>
                {isEdit && (
                    <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                        <label className="form-label">Urutan Tampil (Sort Order)</label>
                        <input
                            type="number"
                            className="form-input"
                            value={form.sort_order}
                            onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })}
                        />
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                        Batal
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading || !form.key || !form.label}>
                        {loading ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
                        Simpan
                    </button>
                </div>
            </form>
        </ModalWrapper>
    )
}

export function SubcategoryModal({ isOpen, onClose, onSave, initialData, categories, isEdit, loading }) {
    const [form, setForm] = useState({
        category_key: '', key: '', label: '', description: '',
        reply_mode: 'continuation', greeting_policy: 'forbidden',
        default_template_count: 3, sort_order: 0
    })

    useEffect(() => {
        if (isOpen) {
            setForm(initialData || {
                category_key: categories?.[0]?.key || '', key: '', label: '', description: '',
                reply_mode: 'continuation', greeting_policy: 'forbidden',
                default_template_count: 3, sort_order: 0
            })
        }
    }, [isOpen, initialData, categories])

    if (!isOpen) return null

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave(form)
    }

    return (
        <ModalWrapper title={isEdit ? 'Edit Intent / Sub-Kategori' : 'Tambah Intent Baru'} onClose={onClose}>
            <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <div className="form-group">
                        <label className="form-label">Kategori Induk</label>
                        <select
                            className="form-input"
                            value={form.category_key}
                            onChange={e => setForm({ ...form, category_key: e.target.value })}
                            required
                        >
                            <option value="">-- Pilih --</option>
                            {categories?.map(c => (
                                <option key={c.key} value={c.key}>{c.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Reply Mode (Perilaku AI)</label>
                        <select
                            className="form-input"
                            value={form.reply_mode}
                            onChange={e => setForm({ ...form, reply_mode: e.target.value })}
                            required
                        >
                            <option value="continuation">Continuation (Lanjutan Chat)</option>
                            <option value="mixed">Mixed (Pertengahan)</option>
                            <option value="opening">Opening (Sapaan Awal)</option>
                        </select>
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                    <label className="form-label">Key {isEdit && '(Tidak bisa diubah)'}</label>
                    <input
                        className="form-input"
                        value={form.key}
                        onChange={e => setForm({ ...form, key: e.target.value })}
                        disabled={isEdit}
                        placeholder="contoh: evaluation.objection_price"
                        required
                    />
                </div>

                <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                    <label className="form-label">Label (Nama Intent)</label>
                    <input
                        className="form-input"
                        value={form.label}
                        onChange={e => setForm({ ...form, label: e.target.value })}
                        placeholder="Objection Price"
                        required
                    />
                </div>

                <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                    <label className="form-label">Deskripsi & Instruksi ke AI (Rekomendasi diisi)</label>
                    <textarea
                        className="form-input form-textarea"
                        rows={3}
                        value={form.description || ''}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        placeholder="Jelaskan kapan Intent ini harus dipicu oleh Classifier..."
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <div className="form-group">
                        <label className="form-label">Greeting Policy</label>
                        <select
                            className="form-input"
                            value={form.greeting_policy}
                            onChange={e => setForm({ ...form, greeting_policy: e.target.value })}
                        >
                            <option value="forbidden">Forbidden</option>
                            <option value="optional_short">Optional Short</option>
                            <option value="required">Required</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Limit Tpl</label>
                        <input
                            type="number" min={1}
                            className="form-input"
                            value={form.default_template_count}
                            onChange={e => setForm({ ...form, default_template_count: Number(e.target.value) })}
                        />
                    </div>
                    {isEdit && (
                        <div className="form-group">
                            <label className="form-label">Urutan</label>
                            <input
                                type="number"
                                className="form-input"
                                value={form.sort_order}
                                onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })}
                            />
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                        Batal
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading || !form.key || !form.label || !form.category_key}>
                        {loading ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
                        Simpan
                    </button>
                </div>
            </form>
        </ModalWrapper>
    )
}
