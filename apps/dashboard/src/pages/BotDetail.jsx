import { useState, useEffect } from 'react'
import { useParams, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE } from '../config/api'
import { Bot, Radio, Database, Settings, ArrowLeft, Loader2 } from 'lucide-react'

function BotDetail() {
    const { botId } = useParams()
    const { getToken } = useAuth()
    const navigate = useNavigate()
    const [bot, setBot] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchBot()
    }, [botId])

    const fetchBot = async () => {
        const token = getToken()
        try {
            const res = await fetch(`${API_BASE}/v1/bots/${botId}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (!res.ok) {
                navigate('/bots')
                return
            }
            const data = await res.json()
            setBot(data.bot)
        } catch (err) {
            console.error('Failed to fetch bot:', err)
            navigate('/bots')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
                <Loader2 size={32} className="spinner" />
            </div>
        )
    }

    if (!bot) {
        return null
    }

    return (
        <div>
            {/* Header */}
            <header style={{ marginBottom: 'var(--space-6)' }}>
                <button 
                    onClick={() => navigate('/bots')} 
                    className="btn btn-ghost"
                    style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-1) var(--space-2)' }}
                >
                    <ArrowLeft size={16} />
                    Back to Bots
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <div style={{
                        width: 56,
                        height: 56,
                        background: 'var(--gradient-primary)',
                        borderRadius: 'var(--radius-lg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                    }}>
                        <Bot size={28} />
                    </div>
                    <div>
                        <h1 className="page-title" style={{ marginBottom: 'var(--space-1)' }}>{bot.name}</h1>
                        <p style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)' }}>
                            {bot.llm_model} • Created {new Date(bot.created_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>
            </header>

            {/* Sub Navigation */}
            <nav style={{ 
                display: 'flex', 
                gap: 'var(--space-1)',
                borderBottom: '1px solid var(--gray-200)',
                marginBottom: 'var(--space-6)'
            }}>
                <NavLink 
                    to={`/bots/${botId}/channels`}
                    className={({ isActive }) => `bot-tab ${isActive ? 'active' : ''}`}
                    style={({ isActive }) => ({
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-3) var(--space-4)',
                        color: isActive ? 'var(--primary-600)' : 'var(--gray-600)',
                        borderBottom: isActive ? '2px solid var(--primary-600)' : '2px solid transparent',
                        fontWeight: isActive ? 600 : 400,
                        marginBottom: '-1px',
                        textDecoration: 'none',
                        transition: 'all 0.15s ease'
                    })}
                >
                    <Radio size={18} />
                    Channels
                </NavLink>
                <NavLink 
                    to={`/bots/${botId}/knowledge`}
                    className={({ isActive }) => `bot-tab ${isActive ? 'active' : ''}`}
                    style={({ isActive }) => ({
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-3) var(--space-4)',
                        color: isActive ? 'var(--primary-600)' : 'var(--gray-600)',
                        borderBottom: isActive ? '2px solid var(--primary-600)' : '2px solid transparent',
                        fontWeight: isActive ? 600 : 400,
                        marginBottom: '-1px',
                        textDecoration: 'none',
                        transition: 'all 0.15s ease'
                    })}
                >
                    <Database size={18} />
                    Knowledge Base
                </NavLink>
                <NavLink 
                    to={`/bots/${botId}/settings`}
                    className={({ isActive }) => `bot-tab ${isActive ? 'active' : ''}`}
                    style={({ isActive }) => ({
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-3) var(--space-4)',
                        color: isActive ? 'var(--primary-600)' : 'var(--gray-600)',
                        borderBottom: isActive ? '2px solid var(--primary-600)' : '2px solid transparent',
                        fontWeight: isActive ? 600 : 400,
                        marginBottom: '-1px',
                        textDecoration: 'none',
                        transition: 'all 0.15s ease'
                    })}
                >
                    <Settings size={18} />
                    Settings
                </NavLink>
            </nav>

            {/* Content */}
            <Outlet context={{ bot, refreshBot: fetchBot }} />
        </div>
    )
}

export default BotDetail
