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
import SuperAdminOverview from './pages/super-admin/Overview'
import SuperAdminAssignments from './pages/super-admin/Assignments'
import SuperAdminPresets from './pages/super-admin/Presets'
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
        // Check for existing token
        const token = localStorage.getItem('token')
        const userData = localStorage.getItem('user')

        if (token && userData) {
            setUser(JSON.parse(userData))
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
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        setUser(data.user)
        return data
    }

    const logout = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setUser(null)
    }

    const getToken = () => localStorage.getItem('token')

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

                        {/* Existing preset pages — wrapped in context */}
                        <Route element={<SuperAdminRouteLayout />}>
                            <Route path="overview" element={<SuperAdminOverview />} />
                            <Route path="assignments" element={<SuperAdminAssignments />} />
                            <Route path="presets" element={<SuperAdminPresets />} />
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
                </Routes>
            </BrowserRouter>
        </AuthContext.Provider>
    )
}

export default App
