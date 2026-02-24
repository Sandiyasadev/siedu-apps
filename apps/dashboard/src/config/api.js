export const API_BASE = import.meta.env.VITE_API_BASE || 'https://apii.pansya.my.id'

const WORKSPACE_MODE_PATH_RE = /^\/w\/([^/]+)(?:\/|$)/
const FETCH_PATCH_FLAG = '__sieduFetchPatched'

const isApiRequestUrl = (url) => {
    if (typeof url !== 'string' || !url) return false

    if (url.startsWith(API_BASE)) return true

    try {
        const resolved = new URL(url, window.location.origin)
        const apiBase = new URL(API_BASE)
        return resolved.origin === apiBase.origin && resolved.pathname.startsWith(apiBase.pathname)
    } catch {
        return false
    }
}

// Endpoints that should NOT trigger auto-refresh (prevents infinite loops)
const SKIP_REFRESH_PATHS = ['/v1/auth/login', '/v1/auth/refresh', '/v1/auth/logout']

const shouldSkipRefresh = (url) => {
    if (typeof url !== 'string') return true
    return SKIP_REFRESH_PATHS.some(path => url.includes(path))
}

const getCurrentWorkspaceOverrideId = () => {
    if (typeof window === 'undefined') return null

    const match = window.location.pathname.match(WORKSPACE_MODE_PATH_RE)
    if (!match?.[1]) return null

    try {
        return decodeURIComponent(match[1])
    } catch {
        return match[1]
    }
}

const isSuperAdminSession = () => {
    if (typeof window === 'undefined') return false

    try {
        const raw = window.localStorage.getItem('user')
        if (!raw) return false
        const user = JSON.parse(raw)
        return user?.role === 'super_admin'
    } catch {
        return false
    }
}

// Shared refresh promise to deduplicate concurrent refresh calls
let _refreshPromise = null

// Store original fetch reference (set during install)
let _originalFetch = null

async function refreshAccessTokenGlobal() {
    if (_refreshPromise) return _refreshPromise

    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) throw new Error('No refresh token')

    _refreshPromise = (async () => {
        try {
            // Use the ORIGINAL fetch to avoid recursion
            const res = await _originalFetch(`${API_BASE}/v1/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            })

            if (!res.ok) throw new Error('Refresh failed')

            const data = await res.json()
            localStorage.setItem('accessToken', data.accessToken)
            localStorage.setItem('refreshToken', data.refreshToken)
            return data.accessToken
        } catch (err) {
            // Refresh failed — clear tokens
            localStorage.removeItem('accessToken')
            localStorage.removeItem('refreshToken')
            localStorage.removeItem('user')
            throw err
        } finally {
            _refreshPromise = null
        }
    })()

    return _refreshPromise
}

export function installWorkspaceAwareFetch() {
    if (typeof window === 'undefined') return
    if (window[FETCH_PATCH_FLAG]) return

    _originalFetch = window.fetch.bind(window)

    window.fetch = async (input, init) => {
        const requestUrl = typeof input === 'string' ? input : input?.url
        const isApiReq = isApiRequestUrl(requestUrl)

        // --- Workspace override injection (super_admin) ---
        const workspaceId = getCurrentWorkspaceOverrideId()
        const shouldInjectWorkspace = Boolean(workspaceId) && isSuperAdminSession()

        let effectiveInit = init
        if (shouldInjectWorkspace && isApiReq) {
            const requestHeaders = new Headers(
                init?.headers ?? (input instanceof Request ? input.headers : undefined)
            )
            requestHeaders.set('X-Workspace-Id', workspaceId)
            effectiveInit = { ...init, headers: requestHeaders }

            if (input instanceof Request) {
                const res = await _originalFetch(new Request(input, effectiveInit))
                // Still apply auto-refresh logic below for workspace requests
                if (res.status === 401 && !shouldSkipRefresh(requestUrl)) {
                    return await retryWithRefresh(input, effectiveInit)
                }
                return res
            }
        }

        // --- Execute request ---
        let res = await _originalFetch(input, effectiveInit)

        // --- Auto-refresh on 401 for API requests ---
        if (res.status === 401 && isApiReq && !shouldSkipRefresh(requestUrl)) {
            return await retryWithRefresh(input, effectiveInit)
        }

        return res
    }

    window[FETCH_PATCH_FLAG] = true
}

async function retryWithRefresh(input, init) {
    try {
        const newToken = await refreshAccessTokenGlobal()
        if (!newToken) throw new Error('No new token')

        // Clone the init and replace the Authorization header
        const retryHeaders = new Headers(
            init?.headers ?? (input instanceof Request ? input.headers : undefined)
        )
        retryHeaders.set('Authorization', `Bearer ${newToken}`)
        const retryInit = { ...init, headers: retryHeaders }

        if (input instanceof Request) {
            return await _originalFetch(new Request(input, retryInit))
        }
        return await _originalFetch(input, retryInit)
    } catch {
        // Refresh failed — redirect to login
        window.location.href = '/login'
        // Return a minimal error response so callers don't crash
        return new Response(JSON.stringify({ error: 'Session expired' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}
