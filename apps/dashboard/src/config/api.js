export const API_BASE = import.meta.env.VITE_API_BASE || 'https://apii.pansya.my.id'

const WORKSPACE_MODE_PATH_RE = /^\/w\/([^/]+)(?:\/|$)/
const FETCH_PATCH_FLAG = '__sieduWorkspaceFetchPatched'

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

export function installWorkspaceAwareFetch() {
    if (typeof window === 'undefined') return
    if (window[FETCH_PATCH_FLAG]) return

    const originalFetch = window.fetch.bind(window)

    window.fetch = async (input, init) => {
        const workspaceId = getCurrentWorkspaceOverrideId()
        const shouldInject = Boolean(workspaceId) && isSuperAdminSession()
        const requestUrl = typeof input === 'string' ? input : input?.url

        if (!shouldInject || !isApiRequestUrl(requestUrl)) {
            return originalFetch(input, init)
        }

        const requestHeaders = new Headers(
            init?.headers ?? (input instanceof Request ? input.headers : undefined)
        )
        requestHeaders.set('X-Workspace-Id', workspaceId)

        if (input instanceof Request) {
            return originalFetch(new Request(input, { ...init, headers: requestHeaders }))
        }

        return originalFetch(input, { ...init, headers: requestHeaders })
    }

    window[FETCH_PATCH_FLAG] = true
}
