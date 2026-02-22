import { useState, useEffect } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE } from '../config/api'
import { Save, Loader2, Trash2, Zap, Plus, Pencil, ToggleLeft, ToggleRight, FileText, X } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

function BotSettings() {
    const { bot, refreshBot } = useOutletContext()
    const { getToken } = useAuth()
    const navigate = useNavigate()

    const [formData, setFormData] = useState({
        name: bot?.name || '',
        system_prompt: bot?.system_prompt || '',
        handoff_enabled: bot?.handoff_enabled ?? true,
        n8n_config: bot?.n8n_config || {}
    })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleting, setDeleting] = useState(false)

    // === Template States ===
    const [templates, setTemplates] = useState([])
    const [templatesLoading, setTemplatesLoading] = useState(false)
    const [showTemplateModal, setShowTemplateModal] = useState(false)
    const [editingTemplate, setEditingTemplate] = useState(null)
    const [templateForm, setTemplateForm] = useState({ name: '', content: '', category: 'general' })
    const [templateSaving, setTemplateSaving] = useState(false)
    const [deleteTemplateId, setDeleteTemplateId] = useState(null)
    const [deletingTemplate, setDeletingTemplate] = useState(false)

    // Fetch templates on mount
    useEffect(() => {
        if (bot?.id) fetchTemplates()
    }, [bot?.id])

    const fetchTemplates = async () => {
        setTemplatesLoading(true)
        const token = getToken()
        try {
            const res = await fetch(`${API_BASE}/v1/templates?bot_id=${bot.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            setTemplates(data.templates || [])
        } catch (err) {
            console.error('Failed to fetch templates:', err)
        } finally {
            setTemplatesLoading(false)
        }
    }

    const openCreateModal = () => {
        setEditingTemplate(null)
        setTemplateForm({ name: '', content: '', category: 'general' })
        setShowTemplateModal(true)
    }

    const openEditModal = (t) => {
        setEditingTemplate(t)
        setTemplateForm({ name: t.name, content: t.content, category: t.category || 'general' })
        setShowTemplateModal(true)
    }

    const saveTemplate = async () => {
        if (!templateForm.name.trim() || !templateForm.content.trim()) return
        setTemplateSaving(true)
        const token = getToken()
        try {
            const isEdit = !!editingTemplate
            const url = isEdit
                ? `${API_BASE}/v1/templates/${editingTemplate.id}`
                : `${API_BASE}/v1/templates`
            const method = isEdit ? 'PATCH' : 'POST'
            const body = isEdit
                ? templateForm
                : { ...templateForm, bot_id: bot.id }

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(body)
            })

            if (res.ok) {
                setShowTemplateModal(false)
                fetchTemplates()
            }
        } catch (err) {
            console.error('Failed to save template:', err)
        } finally {
            setTemplateSaving(false)
        }
    }

    const toggleTemplate = async (id, currentActive) => {
        const token = getToken()
        try {
            await fetch(`${API_BASE}/v1/templates/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ is_active: !currentActive })
            })
            fetchTemplates()
        } catch (err) {
            console.error('Failed to toggle template:', err)
        }
    }

    const deleteTemplate = async () => {
        if (!deleteTemplateId) return
        setDeletingTemplate(true)
        const token = getToken()
        try {
            await fetch(`${API_BASE}/v1/templates/${deleteTemplateId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })
            setDeleteTemplateId(null)
            fetchTemplates()
        } catch (err) {
            console.error('Failed to delete template:', err)
        } finally {
            setDeletingTemplate(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        setError('')
        setSuccess('')
        const token = getToken()

        try {
            const res = await fetch(`${API_BASE}/v1/bots/${bot.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            })

            if (!res.ok) {
                const data = await res.json()
                setError(data.error || 'Failed to save')
                return
            }

            setSuccess('Settings saved successfully')
            refreshBot()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError('Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        setDeleting(true)
        const token = getToken()
        try {
            const res = await fetch(`${API_BASE}/v1/bots/${bot.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })

            if (!res.ok) {
                const data = await res.json()
                setError(data.error || 'Failed to delete bot')
                return
            }

            navigate('/bots')
        } catch (err) {
            setError('Failed to delete bot')
        } finally {
            setDeleting(false)
            setShowDeleteConfirm(false)
        }
    }

    const categoryColors = {
        general: { bg: 'var(--gray-100)', color: 'var(--gray-600)' },
        greeting: { bg: '#e0f2fe', color: '#0369a1' },
        pricing: { bg: '#fef3c7', color: '#92400e' },
        complaint: { bg: '#fee2e2', color: '#991b1b' },
        closing: { bg: '#d1fae5', color: '#065f46' },
        info: { bg: '#ede9fe', color: '#5b21b6' },
    }

    return (
        <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                Bot Settings
            </h2>

            {error && (
                <div style={{
                    background: 'var(--error-50)',
                    color: 'var(--error-700)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-4)'
                }}>
                    {error}
                </div>
            )}
            {success && (
                <div style={{
                    background: 'var(--success-50)',
                    color: 'var(--success-700)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-4)'
                }}>
                    {success}
                </div>
            )}

            <div className="card">
                <div className="card-body">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Bot Name</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">System Prompt</label>
                            <textarea
                                className="form-input form-textarea"
                                value={formData.system_prompt}
                                onChange={e => setFormData({ ...formData, system_prompt: e.target.value })}
                                rows={6}
                                placeholder="You are a helpful AI assistant..."
                            />
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.handoff_enabled}
                                    onChange={e => setFormData({ ...formData, handoff_enabled: e.target.checked })}
                                    style={{ width: 18, height: 18 }}
                                />
                                <span>Enable handoff to human agent</span>
                            </label>
                        </div>

                        {/* n8n Integration */}
                        <div style={{
                            borderTop: '1px solid var(--gray-200)',
                            paddingTop: 'var(--space-4)',
                            marginTop: 'var(--space-4)'
                        }}>
                            <h3 style={{
                                fontSize: 'var(--font-size-md)',
                                fontWeight: 600,
                                marginBottom: 'var(--space-3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)'
                            }}>
                                <Zap size={18} />
                                n8n Integration
                            </h3>
                            <div className="form-group">
                                <label className="form-label">Webhook Base URL</label>
                                <input
                                    type="url"
                                    className="form-input"
                                    value={formData.n8n_config?.webhook_base_url || ''}
                                    onChange={e => setFormData({
                                        ...formData,
                                        n8n_config: {
                                            ...formData.n8n_config,
                                            webhook_base_url: e.target.value || undefined
                                        }
                                    })}
                                    placeholder="https://your-n8n.example.com/webhook"
                                />
                                <p style={{
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--gray-500)',
                                    marginTop: 'var(--space-1)'
                                }}>
                                    Base webhook URL for this bot's n8n integration. Leave empty to use the default from environment variables.
                                </p>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
                            Save Settings
                        </button>
                    </form>
                </div>
            </div>

            {/* ============================================ */}
            {/* Response Templates Section */}
            {/* ============================================ */}
            <div className="card" style={{ marginTop: 'var(--space-6)' }}>
                <div className="card-body">
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--space-4)'
                    }}>
                        <h3 style={{
                            fontSize: 'var(--font-size-md)',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)'
                        }}>
                            <FileText size={18} />
                            Response Templates
                        </h3>
                        <button className="btn btn-primary" onClick={openCreateModal} style={{ fontSize: 'var(--font-size-sm)' }}>
                            <Plus size={14} />
                            Add Template
                        </button>
                    </div>

                    <p style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--gray-500)',
                        marginBottom: 'var(--space-4)'
                    }}>
                        Template aktif akan digunakan AI sebagai kerangka jawaban. AI akan mengisi detail spesifik berdasarkan knowledge base.
                    </p>

                    {templatesLoading ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--gray-400)' }}>
                            <Loader2 size={24} className="spinner" />
                        </div>
                    ) : templates.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: 'var(--space-8)',
                            color: 'var(--gray-400)',
                            border: '2px dashed var(--gray-200)',
                            borderRadius: 'var(--radius-lg)'
                        }}>
                            <FileText size={32} style={{ marginBottom: 'var(--space-2)', opacity: 0.5 }} />
                            <p>Belum ada template. Klik "Add Template" untuk membuat.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {templates.map(t => {
                                const catStyle = categoryColors[t.category] || categoryColors.general
                                return (
                                    <div key={t.id} style={{
                                        border: '1px solid var(--gray-200)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: 'var(--space-3) var(--space-4)',
                                        opacity: t.is_active ? 1 : 0.55,
                                        transition: 'opacity 0.2s'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: 'var(--space-2)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                                                    {t.name}
                                                </span>
                                                <span style={{
                                                    fontSize: 'var(--font-size-xs)',
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    background: catStyle.bg,
                                                    color: catStyle.color,
                                                    fontWeight: 500
                                                }}>
                                                    {t.category || 'general'}
                                                </span>
                                                {t.use_count > 0 && (
                                                    <span style={{
                                                        fontSize: 'var(--font-size-xs)',
                                                        color: 'var(--gray-400)'
                                                    }}>
                                                        Digunakan {t.use_count}x
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                <button
                                                    onClick={() => toggleTemplate(t.id, t.is_active)}
                                                    title={t.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        padding: '4px',
                                                        color: t.is_active ? 'var(--success-500)' : 'var(--gray-400)',
                                                        display: 'flex'
                                                    }}
                                                >
                                                    {t.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(t)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        padding: '4px',
                                                        color: 'var(--gray-500)',
                                                        display: 'flex'
                                                    }}
                                                >
                                                    <Pencil size={15} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTemplateId(t.id)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        padding: '4px',
                                                        color: 'var(--error-400)',
                                                        display: 'flex'
                                                    }}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </div>
                                        <p style={{
                                            fontSize: 'var(--font-size-sm)',
                                            color: 'var(--gray-500)',
                                            lineHeight: 1.5,
                                            whiteSpace: 'pre-wrap',
                                            maxHeight: 60,
                                            overflow: 'hidden'
                                        }}>
                                            {t.content}
                                        </p>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Danger Zone */}
            <div className="card" style={{ marginTop: 'var(--space-6)', borderColor: 'var(--error-200)' }}>
                <div className="card-body">
                    <h3 style={{ fontWeight: 600, color: 'var(--error-600)', marginBottom: 'var(--space-2)' }}>
                        Danger Zone
                    </h3>
                    <p style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
                        Deleting this bot will permanently remove all associated channels, knowledge base, and conversation history.
                    </p>
                    <button
                        className="btn"
                        onClick={() => setShowDeleteConfirm(true)}
                        style={{ background: 'var(--error-500)', color: 'white' }}
                    >
                        <Trash2 size={16} />
                        Delete Bot
                    </button>
                </div>
            </div>

            {/* Delete Bot Confirm Modal */}
            <ConfirmModal
                open={showDeleteConfirm}
                title="Delete bot permanently?"
                description={`Delete "${bot.name}" and all related channels, knowledge files, and conversation history.`}
                confirmLabel="Delete Permanently"
                loading={deleting}
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteConfirm(false)}
            />

            {/* Delete Template Confirm Modal */}
            <ConfirmModal
                open={!!deleteTemplateId}
                title="Hapus template?"
                description="Template yang dihapus tidak bisa dikembalikan."
                confirmLabel="Hapus"
                loading={deletingTemplate}
                onConfirm={deleteTemplate}
                onCancel={() => setDeleteTemplateId(null)}
            />

            {/* Create/Edit Template Modal */}
            {showTemplateModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-6)',
                        width: '100%',
                        maxWidth: 520,
                        maxHeight: '90vh',
                        overflow: 'auto',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 'var(--space-4)'
                        }}>
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>
                                {editingTemplate ? 'Edit Template' : 'Tambah Template'}
                            </h3>
                            <button
                                onClick={() => setShowTemplateModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--gray-500)' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Nama Template</label>
                            <input
                                type="text"
                                className="form-input"
                                value={templateForm.name}
                                onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                                placeholder="Contoh: Sapaan Awal, Info Harga, Penanganan Komplain"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Kategori</label>
                            <select
                                className="form-input"
                                value={templateForm.category}
                                onChange={e => setTemplateForm({ ...templateForm, category: e.target.value })}
                            >
                                <option value="general">General</option>
                                <option value="greeting">Greeting</option>
                                <option value="pricing">Pricing</option>
                                <option value="complaint">Complaint</option>
                                <option value="info">Info</option>
                                <option value="closing">Closing</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Isi Template</label>
                            <textarea
                                className="form-input form-textarea"
                                value={templateForm.content}
                                onChange={e => setTemplateForm({ ...templateForm, content: e.target.value })}
                                rows={6}
                                placeholder="Contoh: Halo Kak! Untuk produk {nama_produk}, harganya {harga} ya. Mau langsung diorder?"
                            />
                            <p style={{
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--gray-400)',
                                marginTop: 'var(--space-1)'
                            }}>
                                AI akan menggunakan struktur kalimat ini dan mengisi detail spesifik dari knowledge base.
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                            <button
                                className="btn"
                                onClick={() => setShowTemplateModal(false)}
                                style={{ background: 'var(--gray-100)', color: 'var(--gray-600)' }}
                            >
                                Batal
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={saveTemplate}
                                disabled={templateSaving || !templateForm.name.trim() || !templateForm.content.trim()}
                            >
                                {templateSaving ? <Loader2 size={14} className="spinner" /> : <Save size={14} />}
                                {editingTemplate ? 'Update' : 'Simpan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default BotSettings
