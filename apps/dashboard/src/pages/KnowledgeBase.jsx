import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../App'
import { API_BASE } from '../config/api'
import { Upload, FileText, Trash2, RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

function KnowledgeBase() {
    const { getToken } = useAuth()
    const [bots, setBots] = useState([])
    const [selectedBot, setSelectedBot] = useState('')
    const [sources, setSources] = useState([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [deleting, setDeleting] = useState(false)
    const fileInputRef = useRef(null)

    useEffect(() => {
        fetchBots()
    }, [])

    useEffect(() => {
        if (selectedBot) {
            fetchSources()
        }
    }, [selectedBot])

    const fetchBots = async () => {
        const token = getToken()
        try {
            const res = await fetch(`${API_BASE}/v1/bots`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            setBots(data.bots || [])
            if (data.bots?.length > 0) {
                setSelectedBot(data.bots[0].id)
            }
        } catch (err) {
            console.error('Failed to fetch bots:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchSources = async () => {
        const token = getToken()
        try {
            const res = await fetch(`${API_BASE}/v1/kb/sources?bot_id=${selectedBot}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            setSources(data.sources || [])
        } catch (err) {
            console.error('Failed to fetch sources:', err)
            setError('Failed to load knowledge base files')
        }
    }

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0]
        if (!file || !selectedBot) return

        setUploading(true)
        setError('')
        setSuccess('')
        const token = getToken()

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('bot_id', selectedBot)

            const res = await fetch(`${API_BASE}/v1/kb/upload`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            })

            if (res.ok) {
                setSuccess('Document uploaded successfully')
                fetchSources()
            } else {
                const data = await res.json()
                setError(data.error || 'Upload failed')
            }
        } catch (err) {
            console.error('Upload failed:', err)
            setError('Upload failed')
        } finally {
            setUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        setDeleting(true)
        setError('')
        setSuccess('')
        const token = getToken()
        try {
            const res = await fetch(`${API_BASE}/v1/kb/sources/${deleteTarget.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })
            if (!res.ok) {
                const data = await res.json()
                setError(data.error || 'Delete failed')
                return
            }
            setSuccess(`Deleted "${deleteTarget.original_filename || deleteTarget.filename}"`)
            fetchSources()
        } catch (err) {
            console.error('Delete failed:', err)
            setError('Delete failed')
        } finally {
            setDeleting(false)
            setDeleteTarget(null)
        }
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case 'indexed':
                return <span className="badge badge-success"><CheckCircle size={12} /> Indexed</span>
            case 'processing':
                return <span className="badge badge-warning"><Clock size={12} /> Processing</span>
            case 'error':
                return <span className="badge badge-error"><AlertCircle size={12} /> Error</span>
            default:
                return <span className="badge badge-info">{status}</span>
        }
    }

    return (
        <div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">Knowledge Base</h1>
                    <p className="page-subtitle">Manage documents for your AI bots</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <select
                        className="form-input"
                        style={{ width: 'auto' }}
                        value={selectedBot}
                        onChange={e => setSelectedBot(e.target.value)}
                    >
                        {bots.map(bot => (
                            <option key={bot.id} value={bot.id}>{bot.name}</option>
                        ))}
                    </select>
                    <button className="btn btn-secondary" onClick={fetchSources}>
                        <RefreshCw size={16} />
                    </button>
                </div>
            </header>

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

            {/* Upload Area */}
            <div
                className={`file-upload ${uploading ? 'dragover' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                style={{ marginBottom: 'var(--space-6)' }}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                />
                <div className="file-upload-icon">
                    {uploading ? <RefreshCw size={32} className="spinner" /> : <Upload size={32} />}
                </div>
                <h3 style={{ marginBottom: 'var(--space-2)' }}>
                    {uploading ? 'Uploading...' : 'Upload Document'}
                </h3>
                <p style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)' }}>
                    Drag and drop or click to select • PDF, DOC, DOCX, TXT (max 50MB)
                </p>
            </div>

            {/* Documents Table */}
            {loading ? (
                <div className="card" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto' }}></div>
                </div>
            ) : sources.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <FileText size={32} />
                        </div>
                        <h3>No documents yet</h3>
                        <p>Upload your first document to train your AI bot</p>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Document</th>
                                    <th>Status</th>
                                    <th>Chunks</th>
                                    <th>Uploaded</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {sources.map(source => (
                                    <tr key={source.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                                <div style={{
                                                    width: 36,
                                                    height: 36,
                                                    background: 'var(--info-100)',
                                                    borderRadius: 'var(--radius-md)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'var(--info-500)'
                                                }}>
                                                    <FileText size={18} />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 500 }}>{source.original_filename || source.filename}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{getStatusBadge(source.status)}</td>
                                        <td>{source.chunk_count || '-'}</td>
                                        <td style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)' }}>
                                            {new Date(source.created_at).toLocaleDateString()}
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-ghost"
                                                onClick={() => setDeleteTarget(source)}
                                                style={{ color: 'var(--error-500)' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="table-mobile">
                            {sources.map(source => (
                                <div key={source.id} className="table-mobile-card">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                                        <div style={{
                                            width: 36,
                                            height: 36,
                                            background: 'var(--info-100)',
                                            borderRadius: 'var(--radius-md)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'var(--info-500)'
                                        }}>
                                            <FileText size={18} />
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>
                                                {source.original_filename || source.filename}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="table-mobile-row">
                                        <span>Status</span>
                                        <span>{getStatusBadge(source.status)}</span>
                                    </div>
                                    <div className="table-mobile-row">
                                        <span>Chunks</span>
                                        <strong>{source.chunk_count || '-'}</strong>
                                    </div>
                                    <div className="table-mobile-row">
                                        <span>Uploaded</span>
                                        <span>{new Date(source.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div style={{ marginTop: 'var(--space-3)' }}>
                                        <button
                                            className="btn btn-ghost"
                                            onClick={() => setDeleteTarget(source)}
                                            style={{ color: 'var(--error-500)' }}
                                        >
                                            <Trash2 size={16} />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                open={Boolean(deleteTarget)}
                title="Delete document?"
                description={`This will permanently remove "${deleteTarget?.original_filename || deleteTarget?.filename || 'this file'}" from the knowledge base.`}
                confirmLabel="Delete Document"
                loading={deleting}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    )
}

export default KnowledgeBase
