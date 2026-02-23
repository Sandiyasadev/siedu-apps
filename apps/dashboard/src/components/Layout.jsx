import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../App'
import { useSocket } from '../contexts/SocketContext'
import {
    Bot, Database, LayoutDashboard, LogOut, Inbox, Headphones,
    Send, Phone, Globe, Instagram, Facebook, Mail, Settings, Shield
} from 'lucide-react'

function Layout() {
    const { user, logout } = useAuth()
    const location = useLocation()
    const { unreadCount } = useSocket()
    const workspaceModeMatch = location.pathname.match(/^\/w\/([^/]+)/)
    const workspaceSegment = workspaceModeMatch?.[1] || null
    const workspaceId = workspaceSegment ? decodeURIComponent(workspaceSegment) : null
    const isWorkspaceMode = user?.role === 'super_admin' && Boolean(workspaceSegment)
    const workspaceNavState = isWorkspaceMode
        ? {
            workspaceModeName: location.state?.workspaceModeName,
            workspaceModeSlug: location.state?.workspaceModeSlug,
        }
        : undefined
    const workspaceLabel = location.state?.workspaceModeName || workspaceId
    const workspaceBasePath = isWorkspaceMode ? `/w/${workspaceSegment}` : ''
    const dashboardPath = isWorkspaceMode ? `${workspaceBasePath}/dashboard` : '/'
    const inboxPath = isWorkspaceMode ? `${workspaceBasePath}/inbox` : '/inbox'
    const botsPath = isWorkspaceMode ? `${workspaceBasePath}/bots` : '/bots'
    const knowledgeBasePath = isWorkspaceMode ? `${workspaceBasePath}/knowledge-base` : '/knowledge-base'

    // Check if we're in inbox (full width needed)
    const isInboxPage = location.pathname.endsWith('/inbox')

    const getMobileTitle = () => {
        if (location.pathname.startsWith('/sa')) return 'Super Admin'
        if (isWorkspaceMode && location.pathname.endsWith('/inbox')) return 'Workspace Inbox'
        if (isWorkspaceMode && location.pathname.includes('/bots')) return 'Workspace Bots'
        if (isWorkspaceMode) return 'Workspace Mode'
        if (location.pathname.startsWith('/inbox')) return 'Inbox'
        if (location.pathname.startsWith('/bots')) return 'Bots'
        if (location.pathname.startsWith('/knowledge-base')) return 'Knowledge Base'
        return 'Dashboard'
    }

    return (
        <div className="app-layout">
            {/* Mobile Header */}
            <div className="mobile-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Headphones size={18} />
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>ServiceDesk</span>
                </div>
                <span className="mobile-header-title">{getMobileTitle()}</span>
            </div>

            {/* Sidebar - Zendesk Style Dark */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <div className="sidebar-logo-icon">
                            <Headphones size={20} />
                        </div>
                        <h1>ServiceDesk</h1>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {/* Main Navigation */}
                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Main</div>

                        <NavLink
                            to={dashboardPath}
                            end
                            state={workspaceNavState}
                            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                        >
                            <LayoutDashboard size={18} />
                            <span>Dashboard</span>
                        </NavLink>

                        <NavLink
                            to={inboxPath}
                            state={workspaceNavState}
                            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                        >
                            <Inbox size={18} />
                            <span>Inbox</span>
                            {unreadCount > 0 && (
                                <span className="sidebar-link-badge">{unreadCount}</span>
                            )}
                        </NavLink>
                    </div>

                    {/* Configuration - admin only */}
                    {user?.role !== 'agent' && (
                        <div className="sidebar-section">
                            <div className="sidebar-section-title">Configuration</div>

                            <NavLink
                                to={botsPath}
                                state={workspaceNavState}
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                            >
                                <Bot size={18} />
                                <span>AI Bots</span>
                            </NavLink>

                            <NavLink
                                to={knowledgeBasePath}
                                state={workspaceNavState}
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                            >
                                <Database size={18} />
                                <span>Knowledge Base</span>
                            </NavLink>
                        </div>
                    )}

                    {user?.role === 'super_admin' && (
                        <div className="sidebar-section">
                            <div className="sidebar-section-title">Administration</div>
                            <NavLink to="/sa/overview" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                                <Shield size={18} />
                                <span>Super Admin</span>
                            </NavLink>
                        </div>
                    )}

                    {/* Channels */}
                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Channels</div>

                        <div className="sidebar-link" style={{ cursor: 'default' }}>
                            <Send size={18} style={{ color: '#0088cc' }} />
                            <span>Telegram</span>
                            <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--success-400)' }}>●</span>
                        </div>
                        <div className="sidebar-link" style={{ cursor: 'default' }}>
                            <Phone size={18} style={{ color: '#25d366' }} />
                            <span>WhatsApp</span>
                            <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--success-400)' }}>●</span>
                        </div>

                        <div style={{ display: 'none' }}>
                            <div style={{ marginTop: '8px', marginBottom: '4px', paddingLeft: '12px', fontSize: '10px', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coming Soon</div>
                            <div className="sidebar-link" style={{ opacity: 0.35, cursor: 'default', pointerEvents: 'none' }}>
                                <Globe size={18} />
                                <span>Web Chat</span>
                            </div>
                            <div className="sidebar-link" style={{ opacity: 0.35, cursor: 'default', pointerEvents: 'none' }}>
                                <Instagram size={18} />
                                <span>Instagram</span>
                            </div>
                            <div className="sidebar-link" style={{ opacity: 0.35, cursor: 'default', pointerEvents: 'none' }}>
                                <Facebook size={18} />
                                <span>Facebook</span>
                            </div>
                            <div className="sidebar-link" style={{ opacity: 0.35, cursor: 'default', pointerEvents: 'none' }}>
                                <Mail size={18} />
                                <span>Email</span>
                            </div>
                        </div>
                    </div>
                </nav>

                {/* User Footer */}
                <div className="sidebar-footer">
                    <button
                        type="button"
                        className="sidebar-user"
                        onClick={logout}
                        style={{ width: '100%', border: 'none', background: 'transparent' }}
                    >
                        <div className="sidebar-avatar">
                            {user?.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">{user?.name || 'User'}</div>
                            <div className="sidebar-user-role">{user?.role || 'Agent'}</div>
                        </div>
                        <LogOut size={16} style={{ color: 'rgba(255,255,255,0.5)' }} />
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`main-content ${isInboxPage ? '' : 'main-content-padded'}`}>
                {isWorkspaceMode && (
                    <div
                        className="card"
                        style={{
                            marginBottom: 'var(--space-4)',
                            borderColor: 'var(--warning-200)',
                            background: 'var(--warning-50)'
                        }}
                    >
                        <div
                            className="card-body"
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 'var(--space-3)'
                            }}
                        >
                            <div>
                                <div className="text-xs" style={{ color: 'var(--warning-700)', fontWeight: 700 }}>
                                    SUPER ADMIN WORKSPACE MODE
                                </div>
                                <div className="text-sm" style={{ color: 'var(--warning-800)' }}>
                                    Anda sedang membuka dashboard workspace: <strong>{workspaceLabel || 'Unknown Workspace'}</strong>
                                </div>
                            </div>
                            <NavLink to="/sa/overview" className="btn btn-secondary btn-sm">
                                Back to Super Admin
                            </NavLink>
                        </div>
                    </div>
                )}
                <Outlet />
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="mobile-bottom-nav">
                <NavLink
                    to={dashboardPath}
                    end
                    state={workspaceNavState}
                    className={({ isActive }) => `mobile-bottom-link ${isActive ? 'active' : ''}`}
                >
                    <LayoutDashboard size={20} />
                    <span>Home</span>
                </NavLink>
                <NavLink
                    to={inboxPath}
                    state={workspaceNavState}
                    className={({ isActive }) => `mobile-bottom-link ${isActive ? 'active' : ''}`}
                >
                    <span style={{ position: 'relative', display: 'inline-flex' }}>
                        <Inbox size={20} />
                        {unreadCount > 0 && <span className="mobile-bottom-badge" />}
                    </span>
                    <span>Inbox</span>
                </NavLink>
                {user?.role !== 'agent' && (
                    <>
                        <NavLink
                            to={botsPath}
                            state={workspaceNavState}
                            className={({ isActive }) => `mobile-bottom-link ${isActive ? 'active' : ''}`}
                        >
                            <Bot size={20} />
                            <span>Bots</span>
                        </NavLink>
                        <NavLink
                            to={knowledgeBasePath}
                            state={workspaceNavState}
                            className={({ isActive }) => `mobile-bottom-link ${isActive ? 'active' : ''}`}
                        >
                            <Settings size={20} />
                            <span>Config</span>
                        </NavLink>
                    </>
                )}
            </nav>
        </div>
    )
}

export default Layout
