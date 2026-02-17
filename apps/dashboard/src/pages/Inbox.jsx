import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../App'
import { API_BASE } from '../config/api'
import { useSocket } from '../contexts/SocketContext'
import {
    MessageSquare, Send, User, Bot, Clock, Globe, Phone,
    CheckCircle, AlertCircle, RefreshCw, X, Search,
    MessageCircle, ChevronDown, Inbox, Filter, MoreHorizontal,
    UserCheck, Archive, Mail, Instagram, Facebook, ArrowLeft,
    Trash2, Edit2, Check, CheckCheck, X as CloseIcon, Zap, Calendar,
    Image, FileText, Film, Mic, Download, MapPin, Contact,
    Paperclip
} from 'lucide-react'

// Channel icons and colors
const CHANNEL_CONFIG = {
    web: { icon: Globe, label: 'Web', color: 'web' },
    telegram: { icon: Send, label: 'Telegram', color: 'telegram' },
    whatsapp: { icon: Phone, label: 'WhatsApp', color: 'whatsapp' },
    facebook: { icon: Facebook, label: 'Facebook', color: 'facebook' },
    instagram: { icon: Instagram, label: 'Instagram', color: 'instagram' },
    email: { icon: Mail, label: 'Email', color: 'email' }
}

// Active channels (others are "Coming Soon")
const ACTIVE_CHANNELS = new Set(['telegram', 'whatsapp'])

// Views configuration
const VIEWS = [
    { key: 'all', label: 'All Conversations', icon: Inbox },
    { key: 'human', label: 'CS Active', icon: UserCheck },
    { key: 'bot', label: 'Bot Active', icon: Bot }
]

// Parse media content string: "media::<type>::<objectKey>::<caption>"
function parseMediaContent(content) {
    if (!content || !content.startsWith('media::')) {
        return null
    }
    const parts = content.split('::')
    return {
        mediaType: parts[1] || 'unknown',
        objectKey: parts[2] || '',
        caption: parts[3] || null
    }
}

// Helper: get friendly preview text for media messages
function getMediaPreview(content) {
    if (!content) return 'No messages yet'
    if (!content.startsWith('media::')) return content

    const parsed = parseMediaContent(content)
    if (!parsed) return content

    const labels = {
        image: 'Image',
        video: 'Video',
        audio: 'Voice Message',
        document: 'Document',
        sticker: 'Sticker',
        location: 'Location',
        contacts: 'Contact'
    }
    const label = labels[parsed.mediaType] || parsed.mediaType
    return parsed.caption ? `[${label}] ${parsed.caption}` : `[${label}]`
}

// Message status icon component (WhatsApp-style ticks)
function MessageStatusIcon({ status }) {
    switch (status) {
        case 'read':
            return <CheckCheck size={14} style={{ color: '#53bdeb', marginLeft: 4, flexShrink: 0 }} />
        case 'delivered':
            return <CheckCheck size={14} style={{ color: '#8696a0', marginLeft: 4, flexShrink: 0 }} />
        case 'failed':
            return <AlertCircle size={14} style={{ color: '#e74c3c', marginLeft: 4, flexShrink: 0 }} />
        case 'sent':
        default:
            return <Check size={14} style={{ color: '#8696a0', marginLeft: 4, flexShrink: 0 }} />
    }
}

// Media message component
function MediaMessage({ content, token }) {
    const [blobUrl, setBlobUrl] = useState(null)
    const [apiPath, setApiPath] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    const media = parseMediaContent(content)

    useEffect(() => {
        if (!media) return

        let objectUrl = null

        const fetchMedia = async () => {
            try {
                // Step 1: Resolve content string to API path
                const resolveRes = await fetch(
                    `${API_BASE}/v1/media/resolve?content=${encodeURIComponent(content)}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                )
                if (!resolveRes.ok) {
                    setError(true)
                    return
                }
                const data = await resolveRes.json()
                const mediaApiUrl = `${API_BASE}${data.url}`
                setApiPath(mediaApiUrl)

                // Step 2: Fetch the actual file as blob (with auth header)
                const mediaRes = await fetch(mediaApiUrl, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                if (!mediaRes.ok) {
                    setError(true)
                    return
                }
                const blob = await mediaRes.blob()
                objectUrl = URL.createObjectURL(blob)
                setBlobUrl(objectUrl)

            } catch {
                setError(true)
            } finally {
                setLoading(false)
            }
        }

        fetchMedia()

        // Cleanup blob URL on unmount
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
    }, [content])

    if (!media) return <span>{content}</span>

    if (loading) {
        return (
            <div style={{ padding: '12px', color: 'var(--gray-400)', fontSize: '13px' }}>
                Loading media...
            </div>
        )
    }

    if (error || !blobUrl) {
        return (
            <div style={{ padding: '8px 12px', color: 'var(--gray-400)', fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertCircle size={14} />
                    <span>Media unavailable (expired)</span>
                </div>
                {media.caption && <div style={{ marginTop: 4, color: 'var(--gray-200)' }}>{media.caption}</div>}
            </div>
        )
    }

    const { mediaType, caption } = media

    switch (mediaType) {
        case 'image':
        case 'sticker':
            return (
                <div>
                    <img
                        src={blobUrl}
                        alt={caption || 'Image'}
                        style={{
                            maxWidth: mediaType === 'sticker' ? 150 : 280,
                            maxHeight: 300,
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            display: 'block'
                        }}
                        onClick={() => window.open(blobUrl, '_blank')}
                    />
                    {caption && <div style={{ marginTop: 4, fontSize: '13px' }}>{caption}</div>}
                </div>
            )

        case 'video':
            return (
                <div>
                    <video
                        src={blobUrl}
                        controls
                        style={{
                            maxWidth: 280,
                            maxHeight: 300,
                            borderRadius: 'var(--radius-md)',
                            display: 'block'
                        }}
                    />
                    {caption && <div style={{ marginTop: 4, fontSize: '13px' }}>{caption}</div>}
                </div>
            )

        case 'audio':
            return (
                <div>
                    <audio src={blobUrl} controls style={{ maxWidth: 250 }} />
                    {caption && <div style={{ marginTop: 4, fontSize: '13px' }}>{caption}</div>}
                </div>
            )

        case 'document':
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                    <FileText size={20} style={{ color: 'var(--primary-400)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {caption || 'Document'}
                        </div>
                    </div>
                    <a
                        href={blobUrl}
                        download={caption || 'document'}
                        style={{ flexShrink: 0, color: 'var(--primary-400)' }}
                        title="Download"
                    >
                        <Download size={16} />
                    </a>
                </div>
            )

        default:
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={14} />
                    <a href={blobUrl} download style={{ color: 'inherit' }}>
                        {caption || `[${mediaType.toUpperCase()}]`}
                    </a>
                </div>
            )
    }
}

function InboxPage() {
    const { getToken, user } = useAuth()
    const { socket, addListener, resetUnread, decrementUnread } = useSocket()
    const [conversations, setConversations] = useState([])
    const [selectedConv, setSelectedConv] = useState(null)
    const [messages, setMessages] = useState([])
    const [newMessage, setNewMessage] = useState('')
    const [attachedFile, setAttachedFile] = useState(null) // { file, preview }
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [view, setView] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [channelFilter, setChannelFilter] = useState('all')
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const [showChat, setShowChat] = useState(false)
    const messagesEndRef = useRef(null)
    const inputRef = useRef(null)
    const fileInputRef = useRef(null)
    const selectedConvRef = useRef(null) // Track selected conversation for socket handlers

    // Pagination state
    const [pagination, setPagination] = useState({
        hasMore: false,
        nextCursor: null,
        loading: false
    })
    const [messagePagination, setMessagePagination] = useState({
        hasOlder: false,
        oldestCursor: null,
        loading: false
    })
    const conversationListRef = useRef(null)
    const messagesContainerRef = useRef(null)

    // States for Clear History and Client Naming
    const [isEditingName, setIsEditingName] = useState(false)
    const [editedName, setEditedName] = useState('')
    const [showClearConfirm, setShowClearConfirm] = useState(false)
    const [clearing, setClearing] = useState(false)

    // States for Templates and Follow-up
    const [templates, setTemplates] = useState([])
    const [showTemplates, setShowTemplates] = useState(false)
    const [showFollowUpModal, setShowFollowUpModal] = useState(false) // legacy, kept for compatibility

    // Toast notification state
    const [toast, setToast] = useState(null) // { message, type: 'error' | 'success' | 'warning' }

    // Auto-dismiss toast after 5 seconds
    useEffect(() => {
        if (!toast) return
        const timer = setTimeout(() => setToast(null), 5000)
        return () => clearTimeout(timer)
    }, [toast])

    // Handle window resize for mobile detection
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768)
            // On desktop, always show both panels
            if (window.innerWidth >= 768) {
                setShowChat(false)
            }
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Keep ref in sync with selectedConv state
    useEffect(() => {
        selectedConvRef.current = selectedConv
    }, [selectedConv])

    // Register page-level socket event handlers via global context
    useEffect(() => {
        const removeListener = addListener('inbox', {
            'message:new': (message) => {
                const currentConv = selectedConvRef.current

                // If this message belongs to the currently open conversation, append it
                if (currentConv && message.conversation_id === currentConv.id) {
                    setMessages(prev => {
                        if (prev.some(m => m.id === message.id)) return prev
                        return [...prev, message]
                    })

                    // This message is being read right now, decrement global unread
                    if (message.role === 'user') {
                        decrementUnread(1)
                    }
                }

                // Update conversation list optimistically (no refetch!)
                setConversations(prev => {
                    const preview = message.content?.startsWith('media::')
                        ? getMediaPreview(message.content)
                        : message.content

                    const existing = prev.find(c => c.id === message.conversation_id)
                    if (existing) {
                        const updated = {
                            ...existing,
                            last_message_preview: preview,
                            last_message_at: message.created_at || new Date().toISOString(),
                            last_message_role: message.role,
                            unread_count: (currentConv?.id === message.conversation_id)
                                ? 0
                                : (existing.unread_count || 0) + (message.role === 'user' ? 1 : 0)
                        }
                        return [updated, ...prev.filter(c => c.id !== message.conversation_id)]
                    }
                    return prev
                })
            },

            'conversation:new': (conversation) => {
                setConversations(prev => {
                    if (prev.some(c => c.id === conversation.id)) return prev
                    return [conversation, ...prev]
                })
            },

            'conversation:update': ({ id, status }) => {
                setConversations(prev => prev.map(c =>
                    c.id === id ? { ...c, status } : c
                ))
                setSelectedConv(prev => {
                    if (prev?.id === id) return { ...prev, status }
                    return prev
                })
            },

            'status:change': ({ conversationId, status }) => {
                setConversations(prev => prev.map(c =>
                    c.id === conversationId ? { ...c, status } : c
                ))
                setSelectedConv(prev => {
                    if (prev?.id === conversationId) return { ...prev, status }
                    return prev
                })
            },

            'message:status': ({ message_id, status }) => {
                setMessages(prev => prev.map(m =>
                    m.id === message_id ? { ...m, status } : m
                ))
            }
        })

        return removeListener
    }, [addListener, decrementUnread])

    useEffect(() => {
        fetchConversations()
        resetUnread() // User is on Inbox page, reset global unread badge
    }, [view, channelFilter])

    useEffect(() => {
        if (selectedConv) {
            fetchMessages(selectedConv.id)
            socket?.emit('join:conversation', selectedConv.id)
            inputRef.current?.focus()
        }
    }, [selectedConv?.id])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Only if not typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

            if (e.key === 'j' || e.key === 'ArrowDown') {
                // Next conversation
                e.preventDefault()
                const currentIdx = conversations.findIndex(c => c.id === selectedConv?.id)
                if (currentIdx < conversations.length - 1) {
                    setSelectedConv(conversations[currentIdx + 1])
                }
            } else if (e.key === 'k' || e.key === 'ArrowUp') {
                // Previous conversation
                e.preventDefault()
                const currentIdx = conversations.findIndex(c => c.id === selectedConv?.id)
                if (currentIdx > 0) {
                    setSelectedConv(conversations[currentIdx - 1])
                }
            } else if (e.key === 'r' && selectedConv) {
                // Focus reply
                e.preventDefault()
                inputRef.current?.focus()
            } else if (e.key === 'e' && selectedConv) {
                // Toggle: take over / hand over
                e.preventDefault()
                updateStatus(selectedConv.status === 'bot' ? 'human' : 'bot')
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [conversations, selectedConv])

    const fetchConversations = async (cursor = null, append = false) => {
        const token = getToken()

        if (append) {
            setPagination(prev => ({ ...prev, loading: true }))
        } else {
            setLoading(true)
        }

        try {
            const params = new URLSearchParams()
            params.append('limit', '30')

            if (view !== 'all') params.append('status', view)
            if (channelFilter !== 'all') params.append('channel_type', channelFilter)
            if (cursor) params.append('cursor', cursor)

            const url = `${API_BASE}/v1/conversations?${params.toString()}`

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            const convs = data.conversations || []

            if (append) {
                setConversations(prev => [...prev, ...convs])
            } else {
                setConversations(convs)
            }

            // Update pagination state
            setPagination({
                hasMore: data.pagination?.has_more || false,
                nextCursor: data.pagination?.next_cursor || null,
                loading: false
            })
        } catch (err) {
            console.error('Failed to fetch conversations:', err)
            setPagination(prev => ({ ...prev, loading: false }))
        } finally {
            setLoading(false)
        }
    }

    // Load more conversations
    const loadMoreConversations = () => {
        if (pagination.hasMore && !pagination.loading && pagination.nextCursor) {
            fetchConversations(pagination.nextCursor, true)
        }
    }

    // Handle conversation list scroll for infinite loading
    const handleConversationScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target
        // Load more when scrolled to 80% of the list
        if (scrollHeight - scrollTop <= clientHeight * 1.2) {
            loadMoreConversations()
        }
    }

    const fetchMessages = async (convId, cursor = null, prepend = false) => {
        const token = getToken()

        if (prepend) {
            setMessagePagination(prev => ({ ...prev, loading: true }))
        }

        try {
            const params = new URLSearchParams()
            params.append('limit', '50')
            if (cursor) {
                params.append('cursor', cursor)
                params.append('direction', 'older')
            }

            const res = await fetch(`${API_BASE}/v1/conversations/${convId}/messages?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            const msgs = data.messages || []

            if (prepend) {
                // Prepend older messages and maintain scroll position
                setMessages(prev => [...msgs, ...prev])
            } else {
                setMessages(msgs)
            }

            // Update message pagination state
            setMessagePagination({
                hasOlder: data.pagination?.has_older || data.pagination?.has_more || false,
                oldestCursor: data.pagination?.oldest_cursor || null,
                loading: false
            })
        } catch (err) {
            console.error('Failed to fetch messages:', err)
            setMessagePagination(prev => ({ ...prev, loading: false }))
        }
    }

    // Load older messages
    const loadOlderMessages = () => {
        if (selectedConv && messagePagination.hasOlder && !messagePagination.loading && messagePagination.oldestCursor) {
            fetchMessages(selectedConv.id, messagePagination.oldestCursor, true)
        }
    }

    // Handle messages scroll for loading older messages
    const handleMessagesScroll = (e) => {
        const { scrollTop } = e.target
        // Load older when scrolled near the top
        if (scrollTop < 100) {
            loadOlderMessages()
        }
    }

    // Handle file selection
    const handleFileSelect = (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        // 20MB limit
        if (file.size > 20 * 1024 * 1024) {
            setToast({ message: 'File too large. Maximum size is 20MB.', type: 'error' })
            return
        }

        let preview = null
        if (file.type.startsWith('image/')) {
            preview = URL.createObjectURL(file)
        }

        setAttachedFile({ file, preview })
        // Reset input so same file can be re-selected
        e.target.value = ''
        inputRef.current?.focus()
    }

    // Remove attached file
    const removeAttachedFile = () => {
        if (attachedFile?.preview) {
            URL.revokeObjectURL(attachedFile.preview)
        }
        setAttachedFile(null)
    }

    const sendMessage = async (e) => {
        e.preventDefault()
        if ((!newMessage.trim() && !attachedFile) || !selectedConv || sending) return

        setSending(true)
        const token = getToken()

        try {
            let res

            if (attachedFile) {
                // Send with FormData (multipart)
                const formData = new FormData()
                formData.append('file', attachedFile.file)
                if (newMessage.trim()) {
                    formData.append('content', newMessage.trim())
                }

                res = await fetch(`${API_BASE}/v1/conversations/${selectedConv.id}/messages`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`
                        // DO NOT set Content-Type - browser sets multipart boundary
                    },
                    body: formData
                })
            } else {
                // Text only
                res = await fetch(`${API_BASE}/v1/conversations/${selectedConv.id}/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ content: newMessage })
                })
            }

            if (res.ok) {
                const data = await res.json()
                setNewMessage('')
                removeAttachedFile()

                // Check if channel delivery failed (message saved but not delivered)
                if (data.channel_delivery && !data.channel_delivery.success) {
                    setToast({
                        message: data.channel_delivery.error || 'Pesan tersimpan tapi gagal dikirim ke channel',
                        type: 'error'
                    })
                }
            } else {
                const errData = await res.json().catch(() => ({}))
                setToast({
                    message: errData.error || `Gagal mengirim pesan (${res.status})`,
                    type: 'error'
                })
            }
        } catch (err) {
            console.error('Failed to send message:', err)
            setToast({
                message: 'Koneksi gagal. Periksa internet Anda.',
                type: 'error'
            })
        } finally {
            setSending(false)
        }
    }

    const updateStatus = async (status) => {
        const token = getToken()
        try {
            await fetch(`${API_BASE}/v1/conversations/${selectedConv.id}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            })
            setSelectedConv(prev => ({ ...prev, status }))
            fetchConversations()
        } catch (err) {
            console.error('Failed to update status:', err)
        }
    }

    const formatTime = (dateStr) => {
        if (!dateStr) return ''
        const date = new Date(dateStr)
        const now = new Date()
        const diff = now - date

        if (diff < 60000) return 'Now'
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
        if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        if (diff < 604800000) return date.toLocaleDateString([], { weekday: 'short' })
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }

    const formatMessageTime = (dateStr) => {
        if (!dateStr) return ''
        return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const getViewCount = (viewKey) => {
        if (viewKey === 'all') return conversations.length
        return conversations.filter(c => c.status === viewKey).length
    }

    // Channel Icon Component
    const ChannelIcon = ({ type, size = 14 }) => {
        const config = CHANNEL_CONFIG[type] || CHANNEL_CONFIG.web
        const Icon = config.icon
        return <Icon size={size} />
    }

    // Handle conversation selection (with mobile support)
    const handleConversationClick = async (conv) => {
        setSelectedConv(conv)
        if (isMobile) {
            setShowChat(true)
        }

        // Mark as read if unread
        if (conv.unread_count > 0 || !conv.agent_read_at) {
            try {
                await fetch(`${API_BASE}/v1/conversations/${conv.id}/read`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${getToken()}` }
                })
                // Update local state
                setConversations(prev => prev.map(c =>
                    c.id === conv.id ? { ...c, unread_count: 0, agent_read_at: new Date() } : c
                ))
            } catch (err) {
                console.error('Failed to mark as read:', err)
            }
        }
    }

    // Handle back button on mobile
    const handleBackToList = () => {
        setShowChat(false)
    }

    // Clear all messages in conversation
    const handleClearHistory = async () => {
        if (!selectedConv) return
        setClearing(true)
        try {
            const response = await fetch(`${API_BASE}/v1/conversations/${selectedConv.id}/messages`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            })
            if (response.ok) {
                setMessages([])
                setShowClearConfirm(false)
                fetchConversations()
            }
        } catch (err) {
            console.error('Failed to clear history:', err)
        } finally {
            setClearing(false)
        }
    }

    // Update contact name
    const handleUpdateName = async () => {
        if (!selectedConv || !editedName.trim()) return
        try {
            const response = await fetch(`${API_BASE}/v1/conversations/${selectedConv.id}/contact`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: editedName })
            })
            if (response.ok) {
                const data = await response.json()
                setSelectedConv(prev => ({ ...prev, contact_name: data.contact.name }))
                setConversations(prev => prev.map(c =>
                    c.id === selectedConv.id ? { ...c, contact_name: data.contact.name } : c
                ))
                setIsEditingName(false)
            }
        } catch (err) {
            console.error('Failed to update name:', err)
        }
    }

    // Start editing name
    const startEditingName = () => {
        setEditedName(selectedConv?.contact_name || selectedConv?.external_thread_id || '')
        setIsEditingName(true)
    }

    // Fetch templates for quick reply
    const fetchTemplates = async () => {
        if (!selectedConv) return
        try {
            const response = await fetch(`${API_BASE}/v1/templates?bot_id=${selectedConv.bot_id}`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            })
            if (response.ok) {
                const data = await response.json()
                setTemplates(data.templates || [])
            }
        } catch (err) {
            console.error('Failed to fetch templates:', err)
        }
    }

    // Send template as quick reply
    const sendTemplate = async (template) => {
        if (!selectedConv) return
        try {
            const response = await fetch(`${API_BASE}/v1/templates/${template.id}/send`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ conversation_id: selectedConv.id })
            })
            if (response.ok) {
                setShowTemplates(false)
                fetchMessages()
            }
        } catch (err) {
            console.error('Failed to send template:', err)
        }
    }




    // Open templates dropdown
    const openTemplates = () => {
        fetchTemplates()
        setShowTemplates(!showTemplates)
    }

    return (
        <div className="inbox-layout">
            {/* Left Panel - Views */}
            <div className="inbox-sidebar">
                <div className="inbox-sidebar-header">
                    <h2 className="inbox-sidebar-title">Views</h2>
                </div>

                <div className="inbox-views">
                    {/* Status Views */}
                    <div className="inbox-view-group">
                        <div className="inbox-view-group-title">Status</div>
                        {VIEWS.map(v => {
                            const Icon = v.icon
                            const count = getViewCount(v.key)
                            return (
                                <div
                                    key={v.key}
                                    className={`inbox-view-item ${view === v.key ? 'active' : ''}`}
                                    onClick={() => setView(v.key)}
                                >
                                    <Icon size={16} />
                                    <span>{v.label}</span>
                                    {count > 0 && (
                                        <span className="inbox-view-count">{count}</span>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Channel Filter */}
                    <div className="inbox-view-group">
                        <div className="inbox-view-group-title">Channels</div>
                        <div
                            className={`inbox-view-item ${channelFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setChannelFilter('all')}
                        >
                            <MessageSquare size={16} />
                            <span>All Channels</span>
                        </div>
                        {Object.entries(CHANNEL_CONFIG).map(([key, config]) => {
                            const Icon = config.icon
                            const isActive = ACTIVE_CHANNELS.has(key)
                            return (
                                <div
                                    key={key}
                                    className={`inbox-view-item ${channelFilter === key ? 'active' : ''}`}
                                    onClick={() => isActive && setChannelFilter(key)}
                                    style={!isActive ? { opacity: 0.35, cursor: 'default', pointerEvents: 'none' } : {}}
                                >
                                    <Icon size={16} />
                                    <span>{config.label}</span>
                                    {!isActive && <span style={{ fontSize: '9px', color: 'var(--gray-500)', marginLeft: 'auto' }}>Soon</span>}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Center Panel - Conversation List */}
            <div className={`inbox-list ${isMobile && showChat ? 'hidden' : ''}`}>
                <div className="inbox-list-header">
                    <h3 className="inbox-list-title">
                        {VIEWS.find(v => v.key === view)?.label || 'Conversations'}
                    </h3>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={fetchConversations}>
                        <RefreshCw size={16} />
                    </button>
                </div>

                <div className="inbox-search">
                    <input
                        type="text"
                        className="inbox-search-input"
                        placeholder="Search conversations..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>

                <div
                    className="inbox-list-content"
                    ref={conversationListRef}
                    onScroll={handleConversationScroll}
                >
                    {loading ? (
                        <div style={{ padding: 0 }}>
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="skeleton-card">
                                    <div className="skeleton skeleton-avatar" />
                                    <div style={{ flex: 1 }}>
                                        <div className="skeleton skeleton-text" style={{ width: `${60 + i * 5}%` }} />
                                        <div className="skeleton skeleton-text-sm" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="inbox-empty">
                            <div className="inbox-empty-icon">
                                <Inbox size={28} />
                            </div>
                            <h3>No conversations</h3>
                            <p>Conversations will appear here when customers start chatting</p>
                        </div>
                    ) : (
                        <>
                            {conversations
                                .filter(conv => {
                                    if (!searchQuery) return true
                                    const searchLower = searchQuery.toLowerCase()
                                    return (
                                        conv.external_thread_id?.toLowerCase().includes(searchLower) ||
                                        conv.last_message_preview?.toLowerCase().includes(searchLower) ||
                                        conv.contact_name?.toLowerCase().includes(searchLower)
                                    )
                                })
                                .map(conv => {
                                    const isSelected = selectedConv?.id === conv.id
                                    const channelConfig = CHANNEL_CONFIG[conv.channel_type] || CHANNEL_CONFIG.web

                                    return (
                                        <div
                                            key={conv.id}
                                            className={`conversation-item ${isSelected ? 'active' : ''}`}
                                            onClick={() => handleConversationClick(conv)}
                                        >
                                            <div className="conversation-avatar">
                                                <User size={20} className="conversation-avatar-icon" />
                                                <div className={`conversation-channel-badge ${channelConfig.color}`}>
                                                    <ChannelIcon type={conv.channel_type} size={8} />
                                                </div>
                                            </div>

                                            <div className="conversation-content">
                                                <div className="conversation-header">
                                                    <span className="conversation-name">
                                                        {conv.unread_count > 0 && (
                                                            <span style={{
                                                                display: 'inline-block',
                                                                width: 8, height: 8,
                                                                background: 'var(--primary-500)',
                                                                borderRadius: '50%',
                                                                marginRight: 'var(--space-2)'
                                                            }} />
                                                        )}
                                                        {conv.contact_name || conv.external_thread_id?.slice(0, 12) || 'Guest'}
                                                    </span>
                                                    <span className="conversation-time">
                                                        {conv.unread_count > 0 && (
                                                            <span style={{
                                                                background: 'var(--primary-500)',
                                                                color: 'white',
                                                                padding: '2px 6px',
                                                                borderRadius: 'var(--radius-full)',
                                                                fontSize: '11px',
                                                                fontWeight: 600,
                                                                marginRight: 'var(--space-2)'
                                                            }}>
                                                                {conv.unread_count}
                                                            </span>
                                                        )}
                                                        {formatTime(conv.last_message_at || conv.last_user_at)}
                                                    </span>
                                                </div>
                                                <p className="conversation-preview"
                                                    style={conv.unread_count > 0 ? { fontWeight: 600 } : {}}
                                                >
                                                    {getMediaPreview(conv.last_message_preview)}
                                                </p>
                                                <div className="conversation-meta">
                                                    <span className={`status-badge ${conv.status}`}>
                                                        {conv.status === 'human' ? 'CS Active' : 'Bot'}
                                                    </span>
                                                    <span className="text-xs text-muted">{conv.bot_name}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}

                            {/* Load more indicator */}
                            {pagination.loading && (
                                <div style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                                    <div className="spinner spinner-sm"></div>
                                </div>
                            )}
                            {pagination.hasMore && !pagination.loading && (
                                <div
                                    style={{
                                        padding: 'var(--space-3)',
                                        textAlign: 'center',
                                        color: 'var(--gray-400)',
                                        fontSize: '12px'
                                    }}
                                >
                                    Scroll for more...
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Right Panel - Chat */}
            <div className={`inbox-chat ${isMobile ? (showChat ? 'visible' : '') : ''}`}>
                {selectedConv ? (
                    <>
                        {/* Toast Notification */}
                        {toast && (
                            <div style={{
                                position: 'absolute',
                                top: 12,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 200,
                                padding: '10px 16px',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '13px',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                maxWidth: '80%',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                                background: toast.type === 'error' ? 'var(--error-500)'
                                    : toast.type === 'success' ? 'var(--success-500)'
                                        : 'var(--warning-500)',
                                color: 'white'
                            }}>
                                {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
                                <span style={{ flex: 1 }}>{toast.message}</span>
                                <button
                                    onClick={() => setToast(null)}
                                    style={{
                                        background: 'none', border: 'none', color: 'white',
                                        cursor: 'pointer', padding: 0, display: 'flex'
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}

                        {/* Chat Header */}
                        <div className="inbox-chat-header">
                            <div className="inbox-chat-user">
                                {/* Back button for mobile */}
                                {isMobile && (
                                    <button
                                        className="btn btn-ghost btn-icon btn-sm show-mobile"
                                        onClick={handleBackToList}
                                        style={{ marginRight: 'var(--space-2)' }}
                                    >
                                        <ArrowLeft size={20} />
                                    </button>
                                )}
                                <div className="avatar avatar-md avatar-primary">
                                    <User size={20} />
                                </div>
                                <div className="inbox-chat-user-info">
                                    {isEditingName ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                            <input
                                                type="text"
                                                className="input input-sm"
                                                value={editedName}
                                                onChange={e => setEditedName(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleUpdateName()}
                                                autoFocus
                                                style={{ width: 150 }}
                                            />
                                            <button className="btn btn-ghost btn-icon btn-sm" onClick={handleUpdateName}>
                                                <Check size={14} />
                                            </button>
                                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setIsEditingName(false)}>
                                                <CloseIcon size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                            <h3 style={{ margin: 0 }}>
                                                {selectedConv.contact_name || selectedConv.external_thread_id?.slice(0, 20) || 'Guest'}
                                            </h3>
                                            <button className="btn btn-ghost btn-icon btn-sm" onClick={startEditingName} title="Edit name">
                                                <Edit2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                    <p>
                                        {CHANNEL_CONFIG[selectedConv.channel_type]?.label || 'Web'} • {selectedConv.bot_name}
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            marginLeft: 8,
                                            padding: '1px 8px',
                                            borderRadius: 'var(--radius-full)',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            background: selectedConv.status === 'human'
                                                ? 'rgba(59, 130, 246, 0.15)'
                                                : 'rgba(34, 197, 94, 0.15)',
                                            color: selectedConv.status === 'human'
                                                ? 'var(--primary-400)'
                                                : 'var(--success-400)'
                                        }}>
                                            {selectedConv.status === 'human' ? 'CS Active' : 'Bot Active'}
                                        </span>
                                    </p>
                                </div>
                            </div>
                            <div className="inbox-chat-actions">
                                {selectedConv.status === 'bot' && (
                                    <button className="btn btn-primary btn-sm" onClick={() => updateStatus('human')}>
                                        <UserCheck size={14} />
                                        Ambil Alih
                                    </button>
                                )}
                                {selectedConv.status === 'human' && (
                                    <button
                                        className="btn btn-sm"
                                        onClick={() => updateStatus('bot')}
                                        title="Serahkan kembali ke AI bot"
                                        style={{
                                            background: 'rgba(34, 197, 94, 0.15)',
                                            color: 'var(--success-400)',
                                            border: '1px solid var(--success-500)'
                                        }}
                                    >
                                        <Bot size={14} />
                                        Serahkan ke Bot
                                    </button>
                                )}

                                {/* Quick Reply Templates */}
                                <div style={{ position: 'relative' }}>
                                    <button
                                        className="btn btn-ghost btn-icon btn-sm"
                                        onClick={openTemplates}
                                        title="Quick Reply"
                                        style={{ color: 'var(--primary-500)' }}
                                    >
                                        <Zap size={16} />
                                    </button>
                                    {showTemplates && templates.length > 0 && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            right: 0,
                                            background: 'var(--gray-800)',
                                            border: '1px solid var(--gray-700)',
                                            borderRadius: 'var(--radius-md)',
                                            minWidth: 200,
                                            zIndex: 100,
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                        }}>
                                            {templates.map(t => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => sendTemplate(t)}
                                                    style={{
                                                        display: 'block',
                                                        width: '100%',
                                                        padding: 'var(--space-2) var(--space-3)',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: 'var(--gray-100)',
                                                        textAlign: 'left',
                                                        cursor: 'pointer'
                                                    }}
                                                    onMouseEnter={e => e.target.style.background = 'var(--gray-700)'}
                                                    onMouseLeave={e => e.target.style.background = 'transparent'}
                                                >
                                                    <span style={{ fontWeight: 500 }}>{t.name}</span>
                                                    {t.shortcut && <span style={{ color: 'var(--gray-400)', marginLeft: 8, fontSize: 12 }}>{t.shortcut}</span>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>




                                <button
                                    className="btn btn-ghost btn-icon btn-sm"
                                    onClick={() => setShowClearConfirm(true)}
                                    title="Clear History"
                                    style={{ color: 'var(--error-500)' }}
                                >
                                    <Trash2 size={16} />
                                </button>

                            </div>
                        </div>




                        {/* Clear History Confirmation Modal */}
                        {showClearConfirm && (
                            <div className="modal-overlay" onClick={() => setShowClearConfirm(false)}>
                                <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                                    <div className="modal-header">
                                        <h3>Clear Chat History?</h3>
                                    </div>
                                    <div className="modal-body">
                                        <p>This will permanently delete all messages in this conversation. This action cannot be undone.</p>
                                    </div>
                                    <div className="modal-footer">
                                        <button className="btn btn-secondary" onClick={() => setShowClearConfirm(false)}>
                                            Cancel
                                        </button>
                                        <button
                                            className="btn"
                                            onClick={handleClearHistory}
                                            disabled={clearing}
                                            style={{ background: 'var(--error-500)', color: 'white' }}
                                        >
                                            {clearing ? <div className="spinner spinner-sm" /> : 'Clear History'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Messages */}
                        <div
                            className="inbox-messages"
                            ref={messagesContainerRef}
                            onScroll={handleMessagesScroll}
                        >
                            {/* Load older messages indicator */}
                            {messagePagination.hasOlder && (
                                <div
                                    style={{
                                        padding: 'var(--space-3)',
                                        textAlign: 'center',
                                        borderBottom: '1px solid var(--gray-700)'
                                    }}
                                >
                                    {messagePagination.loading ? (
                                        <div className="spinner spinner-sm"></div>
                                    ) : (
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={loadOlderMessages}
                                        >
                                            Load older messages
                                        </button>
                                    )}
                                </div>
                            )}

                            {messages.map((msg, idx) => {
                                const isUser = msg.role === 'user'
                                const isAgent = msg.role === 'agent'
                                const isBot = msg.role === 'assistant'
                                const isMedia = msg.content?.startsWith('media::')

                                return (
                                    <div key={msg.id || idx} className="message-group">
                                        <div className={`message-bubble ${isUser ? 'user' : isAgent ? 'agent' : 'assistant'}`}>
                                            <div className="message-sender">
                                                {isUser ? <User size={12} /> : isAgent ? <User size={12} /> : <Bot size={12} />}
                                                <span>{isUser ? 'Customer' : isAgent ? 'You' : 'AI Bot'}</span>
                                            </div>
                                            <div className="message-text">
                                                {isMedia ? (
                                                    <MediaMessage content={msg.content} token={getToken()} />
                                                ) : (
                                                    msg.content
                                                )}
                                            </div>
                                            <div className="message-time">
                                                {formatMessageTime(msg.created_at)}
                                                {(isAgent || isBot) && <MessageStatusIcon status={msg.status} />}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="inbox-input">
                            {/* File preview */}
                            {attachedFile && (
                                <div style={{
                                    padding: '8px 16px',
                                    borderBottom: '1px solid var(--gray-700)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    background: 'var(--gray-800)'
                                }}>
                                    {attachedFile.preview ? (
                                        <img
                                            src={attachedFile.preview}
                                            alt="Preview"
                                            style={{
                                                width: 48, height: 48,
                                                objectFit: 'cover',
                                                borderRadius: 'var(--radius-sm)'
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: 48, height: 48,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: 'var(--gray-700)',
                                            borderRadius: 'var(--radius-sm)'
                                        }}>
                                            <FileText size={20} style={{ color: 'var(--primary-400)' }} />
                                        </div>
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: '13px', fontWeight: 500,
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                        }}>
                                            {attachedFile.file.name}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>
                                            {(attachedFile.file.size / 1024).toFixed(1)} KB
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-ghost btn-icon btn-sm"
                                        onClick={removeAttachedFile}
                                        title="Remove file"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}

                            {/* Hidden file input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar"
                                onChange={handleFileSelect}
                                style={{ display: 'none' }}
                            />

                            <form onSubmit={sendMessage} className="inbox-input-wrapper">
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-icon"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={false}
                                    title="Attach file"
                                    style={{ flexShrink: 0, color: attachedFile ? 'var(--primary-400)' : undefined }}
                                >
                                    <Paperclip size={18} />
                                </button>
                                <textarea
                                    ref={inputRef}
                                    className="inbox-input-field"
                                    placeholder={
                                        attachedFile
                                            ? 'Add a caption (optional)...'
                                            : 'Type a message... (Enter to send)'
                                    }
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            sendMessage(e)
                                        }
                                    }}
                                    disabled={sending}
                                    rows={1}
                                />
                                <div className="inbox-input-actions">
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={sending || (!newMessage.trim() && !attachedFile)}
                                    >
                                        {sending ? <div className="spinner spinner-sm" /> : <Send size={16} />}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="inbox-empty">
                        <div className="inbox-empty-icon">
                            <MessageSquare size={28} />
                        </div>
                        <h3>Select a conversation</h3>
                        <p>Choose from the list to start replying</p>
                        <div className="text-xs text-muted mt-4">
                            Shortcuts: J/K to navigate • R to reply • E to resolve
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default InboxPage
