import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, createContext, useContext } from 'react'
import { API_BASE } from './config/api'
import { SocketProvider } from './contexts/SocketContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Bots from './pages/Bots'
import BotDetail from './pages/BotDetail'
import ChannelList from './pages/ChannelList'
import ChannelCreate from './pages/ChannelCreate'
import ChannelDetail from './pages/ChannelDetail'
import BotSettings from './pages/BotSettings'
import BotKnowledge from './pages/BotKnowledge'
import KnowledgeBase from './pages/KnowledgeBase'
import Inbox from './pages/Inbox'
import Layout from './components/Layout'

// Auth Context
export const AuthContext = createContext(null)

export function useAuth() {
    return useContext(AuthContext)
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
                    <Route path="/" element={
                        <ProtectedRoute>
                            <SocketProvider>
                                <Layout />
                            </SocketProvider>
                        </ProtectedRoute>
                    }>
                        <Route index element={<Dashboard />} />
                        <Route path="bots" element={<Bots />} />
                        <Route path="bots/:botId" element={<BotDetail />}>
                            <Route index element={<ChannelList />} />
                            <Route path="channels" element={<ChannelList />} />
                            <Route path="channels/new" element={<ChannelCreate />} />
                            <Route path="channels/:channelId" element={<ChannelDetail />} />
                            <Route path="knowledge" element={<BotKnowledge />} />
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
