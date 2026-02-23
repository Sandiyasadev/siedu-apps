import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../App'
import {
    ArrowLeft,
    Boxes,
    Clock3,
    LayoutDashboard,
    ListTree,
    LogOut,
    Shield,
} from 'lucide-react'

const navItems = [
    { to: '/sa/overview', label: 'Ringkasan', icon: LayoutDashboard },
    { to: '/sa/assignments', label: 'Assignment', icon: ListTree },
    { to: '/sa/presets', label: 'Preset Library', icon: Boxes },
    { to: '/sa/logs', label: 'Log Apply', icon: Clock3 },
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

    return (
        <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', minHeight: '100vh' }}>
                <aside style={{
                    borderRight: '1px solid var(--gray-200)',
                    background: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'sticky',
                    top: 0,
                    height: '100vh'
                }}>
                    <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--gray-200)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <div style={{
                                width: 34,
                                height: 34,
                                borderRadius: '10px',
                                display: 'grid',
                                placeItems: 'center',
                                background: 'var(--gray-900)',
                                color: 'white'
                            }}>
                                <Shield size={18} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '14px' }}>Super Admin</div>
                                <div className="text-xs text-muted">Konsol Platform</div>
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: 'var(--space-3)' }}>
                        <NavLink
                            to="/sa/overview"
                            className="btn btn-secondary"
                            style={{ width: '100%', justifyContent: 'center' }}
                        >
                            <ArrowLeft size={14} />
                            Beranda Super Admin
                        </NavLink>
                    </div>

                    <nav style={{ padding: '0 var(--space-3) var(--space-3)', display: 'grid', gap: '6px' }}>
                        {navItems.map((item) => {
                            const Icon = item.icon
                            return (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={({ isActive }) => `btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ justifyContent: 'flex-start' }}
                                >
                                    <Icon size={15} />
                                    {item.label}
                                </NavLink>
                            )
                        })}
                    </nav>

                    <div style={{ marginTop: 'auto', padding: 'var(--space-3)', borderTop: '1px solid var(--gray-200)' }}>
                        <div style={{ marginBottom: 'var(--space-2)' }}>
                            <div className="text-sm" style={{ fontWeight: 600 }}>{user?.name || 'Super Admin'}</div>
                            <div className="text-xs text-muted">{user?.email || ''}</div>
                        </div>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={logout}
                            style={{ width: '100%', justifyContent: 'center' }}
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
                        padding: 'var(--space-3) var(--space-4)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                            <div>
                                <div className="text-xs text-muted">Area Super Admin</div>
                                <div style={{ fontWeight: 700 }}>{getShellTitle(location.pathname)}</div>
                            </div>
                            <div className="text-xs text-muted" style={{ textAlign: 'right' }}>
                                <div>Mode platform</div>
                                <code>{location.pathname}</code>
                            </div>
                        </div>
                    </header>

                    <main style={{ padding: 'var(--space-4)' }}>
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    )
}

export default SuperAdminShell
