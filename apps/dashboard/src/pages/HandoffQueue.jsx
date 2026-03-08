import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../App'
import { API_BASE } from '../config/api'
import { useSocket } from '../contexts/SocketContext'
import { UserCheck, Clock, Phone, Send, Globe, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react'

const CHANNEL_ICONS = {
    telegram: Send,
    whatsapp: Phone,
    web: Globe,
}

const PRIORITY_COLORS = {
    urgent: 'handoff-priority-urgent',
    high: 'handoff-priority-high',
    medium: 'handoff-priority-medium',
    low: 'handoff-priority-low',
}

function HandoffQueue({ botId }) {
    const { user } = useAuth()
    const { socket } = useSocket()
    const [queue, setQueue] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [assigning, setAssigning] = useState(null) // handoff_id being assigned

    const fetchQueue = useCallback(async () => {
        if (!botId) return
        try {
            const res = await fetch(`${API_BASE}/v1/internal/handoff-queue/${botId}`, {
                headers: { 'X-Internal-Key': import.meta.env.VITE_INTERNAL_API_KEY || '' },
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = await res.json()
            setQueue(data.queue || [])
            setError(null)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [botId])

    // Initial load and real-time refresh via Socket.io
    useEffect(() => {
        fetchQueue()
    }, [fetchQueue])

    useEffect(() => {
        if (!socket) return
        const handleConversationUpdate = () => fetchQueue()
        socket.on('conversation:update', handleConversationUpdate)
        return () => socket.off('conversation:update', handleConversationUpdate)
    }, [socket, fetchQueue])

    const handleAssign = async (handoffId) => {
        if (!user) return
        setAssigning(handoffId)
        try {
            const res = await fetch(`${API_BASE}/v1/internal/assign-agent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Key': import.meta.env.VITE_INTERNAL_API_KEY || '',
                },
                body: JSON.stringify({
                    handoff_id: handoffId,
                    agent_id: user.id,
                    agent_name: user.name || user.email,
                }),
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            // Remove from local queue immediately for snappy UX
            setQueue(prev => prev.filter(item => item.id !== handoffId))
        } catch (err) {
            setError(`Failed to assign: ${err.message}`)
        } finally {
            setAssigning(null)
        }
    }

    if (loading) {
        return (
            <div className="handoff-queue-loading">
                <div className="spinner" />
                <span>Loading handoff queue...</span>
            </div>
        )
    }

    return (
        <div className="handoff-queue">
            <div className="handoff-queue-header">
                <h2 className="handoff-queue-title">
                    <UserCheck size={20} />
                    Handoff Queue
                </h2>
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={fetchQueue}
                    title="Refresh"
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            {error && (
                <div className="handoff-queue-error">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            {queue.length === 0 && !error ? (
                <div className="handoff-queue-empty">
                    <CheckCircle size={40} className="handoff-queue-empty-icon" />
                    <p>No conversations waiting for human support</p>
                </div>
            ) : (
                <ul className="handoff-queue-list">
                    {queue.map((item) => {
                        const ChannelIcon = CHANNEL_ICONS[item.channel_type] || Globe
                        const priority = item.priority || 'medium'
                        return (
                            <li key={item.id} className="handoff-queue-item">
                                <div className="handoff-queue-item-header">
                                    <span className={`handoff-priority-badge ${PRIORITY_COLORS[priority] || ''}`}>
                                        {priority}
                                    </span>
                                    <span className="handoff-queue-channel">
                                        <ChannelIcon size={14} />
                                        {item.channel_type}
                                    </span>
                                    <span className="handoff-queue-time">
                                        <Clock size={12} />
                                        {item.waiting_since
                                            ? new Date(item.waiting_since).toLocaleTimeString()
                                            : '—'}
                                    </span>
                                </div>

                                <div className="handoff-queue-customer">
                                    <strong>{item.customer_name || 'Unknown Customer'}</strong>
                                </div>

                                {item.summary && (
                                    <p className="handoff-queue-summary">{item.summary}</p>
                                )}

                                {item.suggested_actions?.length > 0 && (
                                    <ul className="handoff-suggested-actions">
                                        {item.suggested_actions.map((action, i) => (
                                            <li key={i}>{action}</li>
                                        ))}
                                    </ul>
                                )}

                                <button
                                    className="btn btn-primary btn-sm handoff-queue-take-btn"
                                    onClick={() => handleAssign(item.id)}
                                    disabled={assigning === item.id}
                                >
                                    {assigning === item.id ? (
                                        <span className="spinner spinner-sm" />
                                    ) : (
                                        <>
                                            <UserCheck size={14} />
                                            Ambil
                                        </>
                                    )}
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}

export default HandoffQueue
