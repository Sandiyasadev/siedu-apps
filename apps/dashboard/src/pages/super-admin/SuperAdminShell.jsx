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
    Users,
    Building2,
    Bot,
    ScrollText,
    ChevronRight
} from 'lucide-react'

const navGroups = [
    {
        label: 'Menu',
        items: [
            { to: '/sa/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { to: '/sa/users', label: 'Users', icon: Users },
            { to: '/sa/workspaces', label: 'Workspaces', icon: Building2 },
            { to: '/sa/bots', label: 'Bots', icon: Bot },
        ]
    },
    {
        label: 'Presets',
        items: [
            { to: '/sa/overview', label: 'Overview', icon: LayoutDashboard },
            { to: '/sa/presets', label: 'Preset Library', icon: Boxes },
            { to: '/sa/assignments', label: 'Assignments', icon: ListTree },
        ]
    },
    {
        label: 'Monitoring',
        items: [
            { to: '/sa/audit-logs', label: 'Audit Logs', icon: ScrollText },
            { to: '/sa/logs', label: 'Apply Logs', icon: Clock3 },
        ]
    },
]

function SuperAdminShell() {
    const { user, logout } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', minHeight: '100vh', background: 'var(--gray-50)' }}>
            {/* Sidebar — white, clean */}
            <aside style={{
                background: 'white',
                borderRight: '1px solid var(--gray-200)',
                display: 'flex',
                flexDirection: 'column',
                position: 'sticky',
                top: 0,
                height: '100vh',
                overflow: 'hidden'
            }}>
                {/* Brand */}
                <div style={{ padding: 'var(--space-5) var(--space-5)', borderBottom: '1px solid var(--gray-100)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 'var(--radius-lg)',
                            display: 'grid',
                            placeItems: 'center',
                            background: 'var(--primary-50)',
                            color: 'var(--primary-600)'
                        }}>
                            <Shield size={18} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--gray-900)' }}>Super Admin</div>
                            <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>Konsol Platform</div>
                        </div>
                    </div>
                </div>

                {/* Back to main */}
                <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <button
                        onClick={() => navigate('/')}
                        className="btn btn-ghost btn-sm"
                        style={{ width: '100%', justifyContent: 'flex-start', gap: '8px', color: 'var(--gray-500)', fontSize: '13px' }}
                    >
                        <ArrowLeft size={14} />
                        Kembali ke Dashboard
                    </button>
                </div>

                {/* Navigation — grouped */}
                <nav style={{ flex: 1, overflowY: 'auto', padding: '0 var(--space-3)' }}>
                    {navGroups.map((group) => (
                        <div key={group.label} style={{ marginBottom: 'var(--space-4)' }}>
                            <div style={{
                                fontSize: '10px',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                color: 'var(--gray-400)',
                                fontWeight: 600,
                                padding: '4px 12px 6px'
                            }}>
                                {group.label}
                            </div>
                            <div style={{ display: 'grid', gap: '2px' }}>
                                {group.items.map((item) => {
                                    const Icon = item.icon
                                    const isActive = location.pathname.startsWith(item.to)
                                    return (
                                        <NavLink
                                            key={item.to}
                                            to={item.to}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                padding: '8px 12px',
                                                borderRadius: 'var(--radius-md)',
                                                textDecoration: 'none',
                                                color: isActive ? 'var(--primary-700)' : 'var(--gray-600)',
                                                background: isActive ? 'var(--primary-50)' : 'transparent',
                                                fontWeight: isActive ? 600 : 400,
                                                fontSize: '13px',
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            <Icon size={16} style={{ opacity: isActive ? 1 : 0.6, flexShrink: 0 }} />
                                            <span style={{ flex: 1 }}>{item.label}</span>
                                            {isActive && <ChevronRight size={14} style={{ opacity: 0.4 }} />}
                                        </NavLink>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* User footer */}
                <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--gray-100)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 'var(--radius-full)',
                            background: 'var(--primary-50)', color: 'var(--primary-600)',
                            display: 'grid', placeItems: 'center', fontSize: '13px', fontWeight: 600
                        }}>
                            {(user?.name || 'A').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || 'Admin'}</div>
                            <div style={{ fontSize: '11px', color: 'var(--gray-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email || ''}</div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={logout}
                        className="btn btn-ghost btn-sm"
                        style={{ width: '100%', justifyContent: 'center', gap: '6px', color: 'var(--gray-500)', fontSize: '12px' }}
                    >
                        <LogOut size={13} />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main style={{ padding: 'var(--space-6)', minWidth: 0 }}>
                <Outlet />
            </main>
        </div>
    )
}

export default SuperAdminShell
