import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE } from '../config/api'
import { Plus, Bot, Settings, Trash2, X, Loader2, Radio, ChevronRight } from 'lucide-react'

function Bots() {
    const { getToken } = useAuth()
    const navigate = useNavigate()
    const [bots, setBots] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editBot, setEditBot] = useState(null)
    const [formData, setFormData] = useState({
        name: '',
        system_prompt: '',
        handoff_enabled: true
    })
    const [saving, setSaving] = useState(false)

    // Delete confirmation state
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, bot: null, step: 1 })
    const [deleting, setDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState('')

    useEffect(() => {
        fetchBots()
    }, [])

    const fetchBots = async () => {
        const token = getToken()
        try {
            const res = await fetch(`${API_BASE}/v1/bots`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            setBots(data.bots || [])
        } catch (err) {
            console.error('Failed to fetch bots:', err)
        } finally {
            setLoading(false)
        }
    }

    const openCreateModal = () => {
        setEditBot(null)
        setFormData({ name: '', system_prompt: '', handoff_enabled: true })
        setShowModal(true)
    }

    const openEditModal = (bot) => {
        setEditBot(bot)
        setFormData({
            name: bot.name,
            system_prompt: bot.system_prompt || '',
            handoff_enabled: bot.handoff_enabled ?? true
        })
        setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        const token = getToken()

        try {
            const url = editBot ? `${API_BASE}/v1/bots/${editBot.id}` : `${API_BASE}/v1/bots`
            const method = editBot ? 'PATCH' : 'POST'

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            })

            if (res.ok) {
                setShowModal(false)
                fetchBots()
            }
        } catch (err) {
            console.error('Failed to save bot:', err)
        } finally {
            setSaving(false)
        }
    }

    // Step 1: Show first confirmation
    const initiateDelete = (bot, e) => {
        e.stopPropagation()
        setDeleteError('')
        setDeleteConfirm({ show: true, bot, step: 1 })
    }

    // Step 2: Show second confirmation
    const confirmFirstStep = () => {
        setDeleteConfirm(prev => ({ ...prev, step: 2 }))
    }

    // Step 3: Actually delete
    const handleDelete = async () => {
        if (!deleteConfirm.bot) return

        setDeleting(true)
        const token = getToken()

        try {
            const res = await fetch(`${API_BASE}/v1/bots/${deleteConfirm.bot.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })

            if (res.ok) {
                setDeleteConfirm({ show: false, bot: null, step: 1 })
                setDeleteError('')
                fetchBots()
            } else {
                const data = await res.json()
                setDeleteError(data.error || 'Failed to delete bot')
            }
        } catch (err) {
            console.error('Failed to delete bot:', err)
            setDeleteError('Failed to delete bot')
        } finally {
            setDeleting(false)
        }
    }

    const cancelDelete = () => {
        setDeleteError('')
        setDeleteConfirm({ show: false, bot: null, step: 1 })
    }

    return (
        <div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">Bots</h1>
                    <p className="page-subtitle">Manage your AI chatbot assistants</p>
                </div>
                <button className="btn btn-primary" onClick={openCreateModal}>
                    <Plus size={20} />
                    Create Bot
                </button>
            </header>

            {loading ? (
                <div className="card" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto' }}></div>
                </div>
            ) : bots.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <Bot size={32} />
                        </div>
                        <h3>No bots yet</h3>
                        <p>Create your first AI chatbot to get started</p>
                        <button className="btn btn-primary" onClick={openCreateModal}>
                            <Plus size={20} />
                            Create Bot
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                    {bots.map(bot => (
                        <div
                            key={bot.id}
                            className="card"
                            style={{ cursor: 'pointer', transition: 'box-shadow 0.15s ease' }}
                            onClick={() => navigate(`/bots/${bot.id}`)}
                            onKeyDown={e => e.key === 'Enter' && navigate(`/bots/${bot.id}`)}
                            role="button"
                            tabIndex={0}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                        >
                            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                <div style={{
                                    width: 48,
                                    height: 48,
                                    background: 'var(--gradient-primary)',
                                    borderRadius: 'var(--radius-lg)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    flexShrink: 0
                                }}>
                                    <Bot size={24} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>{bot.name}</h3>
                                    <p style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)' }}>
                                        {bot.handoff_enabled ? 'Handoff: On' : 'Handoff: Off'}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={(e) => { e.stopPropagation(); openEditModal(bot); }}
                                    >
                                        <Settings size={16} />
                                        Edit
                                    </button>
                                    <button
                                        className="btn btn-ghost"
                                        onClick={(e) => initiateDelete(bot, e)}
                                        style={{ color: 'var(--error-500)' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <ChevronRight size={20} style={{ color: 'var(--gray-400)' }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editBot ? 'Edit Bot' : 'Create Bot'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Bot Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="My AI Assistant"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">System Prompt</label>
                                    <textarea
                                        className="form-input form-textarea"
                                        value={formData.system_prompt}
                                        onChange={e => setFormData({ ...formData, system_prompt: e.target.value })}
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
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <Loader2 size={20} className="spinner" /> : (editBot ? 'Save Changes' : 'Create Bot')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm.show && (
                <div className="modal-overlay" onClick={cancelDelete}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                            <div style={{
                                width: 48, height: 48, borderRadius: '50%',
                                background: 'var(--error-50)', color: 'var(--error-500)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto var(--space-4)'
                            }}>
                                <Trash2 size={24} />
                            </div>
                        </div>
                        <div className="modal-body" style={{ textAlign: 'center', paddingTop: 0 }}>
                            {deleteConfirm.step === 1 ? (
                                <>
                                    <h3 style={{ marginBottom: 'var(--space-2)' }}>Delete Bot?</h3>
                                    <p style={{ color: 'var(--gray-600)' }}>
                                        Are you sure you want to delete <strong>{deleteConfirm.bot?.name}</strong>?
                                        This will remove all channels and conversations.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <h3 style={{ marginBottom: 'var(--space-2)', color: 'var(--error-600)' }}>
                                        Final Confirmation
                                    </h3>
                                    <p style={{ color: 'var(--gray-600)' }}>
                                        This action <strong>cannot be undone</strong>. Clicking "Delete Permanently" will
                                        remove all data permanently.
                                    </p>
                                </>
                            )}

                            {deleteError && (
                                <p style={{
                                    color: 'var(--error-600)',
                                    background: 'var(--error-50)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--space-2)',
                                    marginTop: 'var(--space-3)'
                                }}>
                                    {deleteError}
                                </p>
                            )}
                        </div>
                        <div className="modal-footer" style={{ justifyContent: 'center', gap: 'var(--space-3)' }}>
                            <button className="btn btn-secondary" onClick={cancelDelete}>
                                Cancel
                            </button>
                            {deleteConfirm.step === 1 ? (
                                <button
                                    className="btn"
                                    onClick={confirmFirstStep}
                                    style={{ background: 'var(--error-500)', color: 'white' }}
                                >
                                    Yes, Delete
                                </button>
                            ) : (
                                <button
                                    className="btn"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    style={{ background: 'var(--error-600)', color: 'white' }}
                                >
                                    {deleting ? <Loader2 size={16} className="spinner" /> : 'Delete Permanently'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Bots
