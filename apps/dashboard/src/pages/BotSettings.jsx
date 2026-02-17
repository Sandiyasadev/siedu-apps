import { useState } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE } from '../config/api'
import { Save, Loader2, Trash2, Zap } from 'lucide-react'
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

            <ConfirmModal
                open={showDeleteConfirm}
                title="Delete bot permanently?"
                description={`Delete "${bot.name}" and all related channels, knowledge files, and conversation history.`}
                confirmLabel="Delete Permanently"
                loading={deleting}
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </div>
    )
}

export default BotSettings
