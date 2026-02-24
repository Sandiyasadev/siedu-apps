import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useState, useEffect, createContext, useContext } from 'react'
import { API_BASE, installWorkspaceAwareFetch } from './config/api'
import { SocketProvider } from './contexts/SocketContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Bots from './pages/Bots'
import BotDetail from './pages/BotDetail'
import ChannelList from './pages/ChannelList'
import ChannelCreate from './pages/ChannelCreate'
import ChannelDetail from './pages/ChannelDetail'
import BotSettings from './pages/BotSettings'
import BotTemplates from './pages/BotTemplates'
import BotKnowledge from './pages/BotKnowledge'
import KnowledgeBase from './pages/KnowledgeBase'
import Inbox from './pages/Inbox'
import Layout from './components/Layout'
import PresetEditor from './pages/super-admin/PresetEditor'
import PresetDeploy from './pages/super-admin/PresetDeploy'
import SuperAdminLogs from './pages/super-admin/Logs'
import SuperAdminRouteLayout from './pages/super-admin/SuperAdminRouteLayout'
import SuperAdminShell from './pages/super-admin/SuperAdminShell'
import SADashboard from './pages/super-admin/Dashboard'
import SAUsers from './pages/super-admin/Users'
import SAWorkspaces from './pages/super-admin/Workspaces'
import SABots from './pages/super-admin/SABots'
import SAAuditLogs from './pages/super-admin/AuditLogs'

// Auth Context
export const AuthContext = createContext(null)

export function useAuth() {
    return useContext(AuthContext)
}

if (typeof window !== 'undefined') {
    installWorkspaceAwareFetch()
}

// Protected Route
function ProtectedRoute({ children }) {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="login-page">
                <div className="spinner"></div>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    return children
}

function SuperAdminRoute({ children }) {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="login-page">
                <div className="spinner"></div>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    if (user.role !== 'super_admin') {
        return <Navigate to="/" replace />
    }

    return children
}

function AdminRoute({ children }) {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="login-page">
                <div className="spinner"></div>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    if (user.role === 'agent') {
        return <Navigate to="/inbox" replace />
    }

    return children
}

function SuperAdminWorkspaceApp() {
    const { workspaceId } = useParams()

    return (
        <SuperAdminRoute>
            <SocketProvider key={`workspace-mode-${workspaceId || 'unknown'}`}>
                <Layout key={`workspace-layout-${workspaceId || 'unknown'}`} />
            </SocketProvider>
        </SuperAdminRoute>
    )
}

function HomeIndexRoute() {
    const { user } = useAuth()

    if (user?.role === 'super_admin') {
        return <Navigate to="/sa/dashboard" replace />
    }

    return <Dashboard />
}

function App() {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Migrate from old 'token' key if present
        const oldToken = localStorage.getItem('token')
        if (oldToken) {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
        }

        // Check for existing tokens
        const accessToken = localStorage.getItem('accessToken')
        const userData = localStorage.getItem('user')

        if (accessToken && userData) {
            try {
                setUser(JSON.parse(userData))
            } catch {
                localStorage.clear()
            }
        }
        setLoading(false)
    }, [])

    const login = async (email, password) => {
        const res = await fetch(`${API_BASE}/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })

        if (!res.ok) {
            const error = await res.json()
            throw new Error(error.error || 'Login failed')
        }

        const data = await res.json()
        localStorage.setItem('accessToken', data.accessToken)
        localStorage.setItem('refreshToken', data.refreshToken)
        localStorage.setItem('user', JSON.stringify(data.user))
        setUser(data.user)
        return data
    }

    const logout = async () => {
        try {
            const accessToken = localStorage.getItem('accessToken')
            const refreshToken = localStorage.getItem('refreshToken')
            if (accessToken) {
                await fetch(`${API_BASE}/v1/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({ refreshToken })
                }).catch(() => { }) // best-effort
            }
        } finally {
            localStorage.removeItem('accessToken')
            localStorage.removeItem('refreshToken')
            localStorage.removeItem('user')
            setUser(null)
        }
    }

    const getToken = () => localStorage.getItem('accessToken')

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, getToken }}>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/sa" element={
                        <SuperAdminRoute>
                            <SuperAdminShell />
                        </SuperAdminRoute>
                    }>
                        {/* New MVP pages — no context needed */}
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<SADashboard />} />
                        <Route path="users" element={<SAUsers />} />
                        <Route path="workspaces" element={<SAWorkspaces />} />
                        <Route path="bots" element={<SABots />} />
                        <Route path="audit-logs" element={<SAAuditLogs />} />

                        {/* Preset pages — self-contained, no context needed */}
                        <Route path="preset-editor" element={<PresetEditor />} />
                        <Route path="preset-deploy" element={<PresetDeploy />} />

                        {/* Legacy pages — wrapped in context (kept for logs) */}
                        <Route element={<SuperAdminRouteLayout />}>
                            <Route path="logs" element={<SuperAdminLogs />} />
                        </Route>
                    </Route>
                    <Route path="/w/:workspaceId" element={<SuperAdminWorkspaceApp />}>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<Dashboard />} />
                        <Route path="bots" element={<Bots />} />
                        <Route path="bots/:botId" element={<BotDetail />}>
                            <Route index element={<ChannelList />} />
                            <Route path="channels" element={<ChannelList />} />
                            <Route path="channels/new" element={<ChannelCreate />} />
                            <Route path="channels/:channelId" element={<ChannelDetail />} />
                            <Route path="knowledge" element={<BotKnowledge />} />
                            <Route path="templates" element={<BotTemplates />} />
                            <Route path="settings" element={<BotSettings />} />
                        </Route>
                        <Route path="knowledge-base" element={<KnowledgeBase />} />
                        <Route path="inbox" element={<Inbox />} />
                    </Route>
                    <Route path="/" element={
                        <ProtectedRoute>
                            <SocketProvider>
                                <Layout />
                            </SocketProvider>
                        </ProtectedRoute>
                    }>
                        <Route index element={<HomeIndexRoute />} />
                        <Route path="bots" element={<AdminRoute><Bots /></AdminRoute>} />
                        <Route path="bots/:botId" element={<AdminRoute><BotDetail /></AdminRoute>}>
                            <Route index element={<ChannelList />} />
                            <Route path="channels" element={<ChannelList />} />
                            <Route path="channels/new" element={<ChannelCreate />} />
                            <Route path="channels/:channelId" element={<ChannelDetail />} />
                            <Route path="knowledge" element={<BotKnowledge />} />
                            <Route path="templates" element={<BotTemplates />} />
                            <Route path="settings" element={<BotSettings />} />
                        </Route>
                        <Route path="knowledge-base" element={<AdminRoute><KnowledgeBase /></AdminRoute>} />
                        <Route path="inbox" element={<Inbox />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthContext.Provider>
    )
}

export default App
