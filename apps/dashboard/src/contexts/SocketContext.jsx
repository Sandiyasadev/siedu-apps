import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import { API_BASE } from '../config/api'

const SocketContext = createContext(null)

export function useSocket() {
    const ctx = useContext(SocketContext)
    if (!ctx) throw new Error('useSocket must be used within SocketProvider')
    return ctx
}

// Simple notification sound using Web Audio API (no external files needed)
function createNotificationSound() {
    let audioCtx = null

    return function play() {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)()
            }

            // Create a short "ding" sound
            const oscillator = audioCtx.createOscillator()
            const gainNode = audioCtx.createGain()

            oscillator.connect(gainNode)
            gainNode.connect(audioCtx.destination)

            oscillator.frequency.setValueAtTime(830, audioCtx.currentTime)    // Note: ~G#5
            oscillator.frequency.setValueAtTime(1050, audioCtx.currentTime + 0.08) // Quick pitch up

            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime)
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4)

            oscillator.start(audioCtx.currentTime)
            oscillator.stop(audioCtx.currentTime + 0.4)
        } catch {
            // Silently fail if audio is not available
        }
    }
}

const playNotification = createNotificationSound()

export function SocketProvider({ children }) {
    const [isConnected, setIsConnected] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const socketRef = useRef(null)
    const listenersRef = useRef(new Map()) // Custom event listeners from pages

    // Get token from localStorage
    const getToken = useCallback(() => localStorage.getItem('token'), [])

    // Initialize socket connection - runs ONCE
    useEffect(() => {
        const token = getToken()
        if (!token) return

        const socket = io(API_BASE, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000
        })

        socketRef.current = socket

        socket.on('connect', () => {
            console.log('[Socket] Connected globally')
            setIsConnected(true)
            socket.emit('join:agent')
        })

        socket.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason)
            setIsConnected(false)
        })

        socket.on('reconnect', () => {
            console.log('[Socket] Reconnected')
            setIsConnected(true)
            socket.emit('join:agent')
        })

        // ---- GLOBAL EVENT HANDLERS ----

        // New message: update unread count + play sound
        socket.on('message:new', (message) => {
            // Only count incoming user messages, not our own replies
            if (message.role === 'user') {
                setUnreadCount(prev => prev + 1)
                playNotification()

                // Browser notification (if permission granted)
                if (Notification.permission === 'granted') {
                    const preview = message.content?.startsWith('media::')
                        ? '[Media]'
                        : (message.content?.substring(0, 80) || 'New message')

                    new Notification('New message', {
                        body: preview,
                        tag: 'inbox-message', // Prevent stacking
                        silent: true // We already play our own sound
                    })
                }
            }

            // Forward to page-level listeners
            listenersRef.current.forEach((handler) => {
                if (handler['message:new']) handler['message:new'](message)
            })
        })

        // New conversation
        socket.on('conversation:new', (conversation) => {
            listenersRef.current.forEach((handler) => {
                if (handler['conversation:new']) handler['conversation:new'](conversation)
            })
        })

        // Conversation update (status change from workspace room)
        socket.on('conversation:update', (data) => {
            listenersRef.current.forEach((handler) => {
                if (handler['conversation:update']) handler['conversation:update'](data)
            })
        })

        // Status change (from conversation room)
        socket.on('status:change', (data) => {
            listenersRef.current.forEach((handler) => {
                if (handler['status:change']) handler['status:change'](data)
            })
        })

        // Request browser notification permission on first load
        if (Notification.permission === 'default') {
            Notification.requestPermission()
        }

        return () => {
            socket.disconnect()
            socketRef.current = null
        }
    }, [])

    // Register page-level event listeners (used by Inbox, etc.)
    const addListener = useCallback((id, handlers) => {
        listenersRef.current.set(id, handlers)
        return () => listenersRef.current.delete(id)
    }, [])

    // Reset unread count (when user opens Inbox)
    const resetUnread = useCallback(() => {
        setUnreadCount(0)
    }, [])

    // Mark specific count as read
    const decrementUnread = useCallback((count = 1) => {
        setUnreadCount(prev => Math.max(0, prev - count))
    }, [])

    const value = {
        socket: socketRef.current,
        isConnected,
        unreadCount,
        resetUnread,
        decrementUnread,
        addListener
    }

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    )
}
