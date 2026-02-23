import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../App'
import {
    ArrowLeft,
    Boxes,
    Clock3,
    LayoutDashboard,
    ListTree,
    LogOut,
    Shield,
    ChevronRight
} from 'lucide-react'

const navItems = [
    { to: '/sa/overview', label: 'Ringkasan', icon: LayoutDashboard, desc: 'Status platform & bootstrap' },
    { to: '/sa/assignments', label: 'Assignment', icon: ListTree, desc: 'Assign & apply preset' },
    { to: '/sa/presets', label: 'Preset Library', icon: Boxes, desc: 'Kelola taxonomy & template' },
    { to: '/sa/logs', label: 'Log Apply', icon: Clock3, desc: 'Riwayat apply preset' },
]

const getShellTitle = (pathname) => {
    if (pathname.startsWith('/sa/assignments')) return 'Assignment Preset Workspace'
    if (pathname.startsWith('/sa/presets')) return 'Manajemen Preset'
    if (pathname.startsWith('/sa/logs')) return 'Riwayat Apply Preset'
    return 'Ringkasan Platform'
}

function SuperAdminShell() {
    const { user, logout } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()

    return (
        <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', minHeight: '100vh' }}>
                <aside style={{
                    borderRight: '1px solid var(--gray-200)',
                    background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'sticky',
                    top: 0,
                    height: '100vh',
                    color: 'white'
                }}>
                    {/* Brand */}
                    <div style={{ padding: 'var(--space-5) var(--space-4)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <div style={{
                                width: 40,
                                height: 40,
                                borderRadius: '12px',
                                display: 'grid',
                                placeItems: 'center',
                                background: 'rgba(255,255,255,0.15)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255,255,255,0.2)'
                            }}>
                                <Shield size={20} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '0.5px' }}>Super Admin</div>
                                <div style={{ fontSize: '11px', opacity: 0.6 }}>Konsol Platform</div>
                            </div>
                        </div>
                    </div>

                    {/* Back to main */}
                    <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <button
                            onClick={() => navigate('/')}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.15)',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'rgba(255,255,255,0.7)',
                                cursor: 'pointer',
                                fontSize: '13px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <ArrowLeft size={14} />
                            Kembali ke Dashboard
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav style={{ padding: '0 var(--space-3)', display: 'grid', gap: '4px', flex: 1 }}>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.4, padding: '8px 12px 4px', fontWeight: 600 }}>
                            Menu
                        </div>
                        {navItems.map((item) => {
                            const Icon = item.icon
                            const isActive = location.pathname.startsWith(item.to)
                            return (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '10px 12px',
                                        borderRadius: '10px',
                                        textDecoration: 'none',
                                        color: isActive ? 'white' : 'rgba(255,255,255,0.65)',
                                        background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                                        borderLeft: isActive ? '3px solid #a78bfa' : '3px solid transparent',
                                        fontWeight: isActive ? 600 : 400,
                                        fontSize: '14px',
                                        transition: 'all 0.2s',
                                        position: 'relative'
                                    }}
                                >
                                    <Icon size={18} style={{ opacity: isActive ? 1 : 0.7, flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div>{item.label}</div>
                                        <div style={{ fontSize: '11px', opacity: 0.5, fontWeight: 400, marginTop: '1px' }}>
                                            {item.desc}
                                        </div>
                                    </div>
                                    {isActive && <ChevronRight size={14} style={{ opacity: 0.5 }} />}
                                </NavLink>
                            )
                        })}
                    </nav>

                    {/* User footer */}
                    <div style={{ padding: 'var(--space-4)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ marginBottom: 'var(--space-3)' }}>
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{user?.name || 'Super Admin'}</div>
                            <div style={{ fontSize: '11px', opacity: 0.5 }}>{user?.email || ''}</div>
                        </div>
                        <button
                            type="button"
                            onClick={logout}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.15)',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'rgba(255,255,255,0.7)',
                                cursor: 'pointer',
                                fontSize: '13px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <LogOut size={14} />
                            Logout
                        </button>
                    </div>
                </aside>

                <div style={{ minWidth: 0 }}>
                    <header style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                        background: 'rgba(255,255,255,0.95)',
                        backdropFilter: 'blur(8px)',
                        borderBottom: '1px solid var(--gray-200)',
                        padding: 'var(--space-3) var(--space-5)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                            <div>
                                <div className="text-xs text-muted">Area Super Admin</div>
                                <div style={{ fontWeight: 700, fontSize: '16px' }}>{getShellTitle(location.pathname)}</div>
                            </div>
                            <div className="text-xs text-muted" style={{ textAlign: 'right' }}>
                                <div>Mode platform</div>
                                <code style={{ fontSize: '11px' }}>{location.pathname}</code>
                            </div>
                        </div>
                    </header>

                    <main style={{ padding: 'var(--space-5)' }}>
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    )
}

export default SuperAdminShell
