import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../App'
import { useSocket } from '../contexts/SocketContext'
import {
    Bot, Database, LayoutDashboard, LogOut, Inbox, Headphones,
    Send, Phone, Globe, Instagram, Facebook, Mail, Settings
} from 'lucide-react'

function Layout() {
    const { user, logout } = useAuth()
    const location = useLocation()
    const { unreadCount } = useSocket()

    // Check if we're in inbox (full width needed)
    const isInboxPage = location.pathname === '/inbox'

    const getMobileTitle = () => {
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

                        <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <LayoutDashboard size={18} />
                            <span>Dashboard</span>
                        </NavLink>

                        <NavLink to="/inbox" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <Inbox size={18} />
                            <span>Inbox</span>
                            {unreadCount > 0 && (
                                <span className="sidebar-link-badge">{unreadCount}</span>
                            )}
                        </NavLink>
                    </div>

                    {/* Configuration */}
                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Configuration</div>

                        <NavLink to="/bots" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <Bot size={18} />
                            <span>AI Bots</span>
                        </NavLink>

                        <NavLink to="/knowledge-base" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <Database size={18} />
                            <span>Knowledge Base</span>
                        </NavLink>
                    </div>

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
                <Outlet />
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="mobile-bottom-nav">
                <NavLink to="/" end className={({ isActive }) => `mobile-bottom-link ${isActive ? 'active' : ''}`}>
                    <LayoutDashboard size={20} />
                    <span>Home</span>
                </NavLink>
                <NavLink to="/inbox" className={({ isActive }) => `mobile-bottom-link ${isActive ? 'active' : ''}`}>
                    <span style={{ position: 'relative', display: 'inline-flex' }}>
                        <Inbox size={20} />
                        {unreadCount > 0 && <span className="mobile-bottom-badge" />}
                    </span>
                    <span>Inbox</span>
                </NavLink>
                <NavLink to="/bots" className={({ isActive }) => `mobile-bottom-link ${isActive ? 'active' : ''}`}>
                    <Bot size={20} />
                    <span>Bots</span>
                </NavLink>
                <NavLink to="/knowledge-base" className={({ isActive }) => `mobile-bottom-link ${isActive ? 'active' : ''}`}>
                    <Settings size={20} />
                    <span>Config</span>
                </NavLink>
            </nav>
        </div>
    )
}

export default Layout
