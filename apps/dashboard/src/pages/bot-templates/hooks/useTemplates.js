import { useState, useCallback } from 'react'
import { API_BASE } from '../../../config/api'

export function useTemplates(botId, getToken, setError) {
    const [templates, setTemplates] = useState([])
    const [loading, setLoading] = useState(false)
    const [filter, setFilter] = useState({
        category: '',
        sub_category: '__all__',
        status: '__all__'
    })
    const [actionLoading, setActionLoading] = useState('')

    const apiRequest = async (path, options = {}) => {
        const token = getToken()
        const headers = {
            Authorization: `Bearer ${token}`,
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {})
        }
        const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
        let data = {}
        try { data = await res.json() } catch { data = {} }

        if (!res.ok) {
            const err = new Error(data.error || `Request failed (${res.status})`)
            err.status = res.status
            err.data = data
            throw err
        }
        return data
    }

    const fetchTemplates = useCallback(async ({ silent = false } = {}) => {
        if (!botId) return
        // silent=true: background refresh after CRUD — skip spinner so list stays visible
        if (!silent) setLoading(true)
        if (setError) setError('')

        try {
            const params = new URLSearchParams({ bot_id: botId, include_inactive: '1' })
            if (filter.category) params.set('category', filter.category)

            if (filter.sub_category === '__null__') {
                params.set('sub_category', '')
            } else if (filter.sub_category && filter.sub_category !== '__all__') {
                params.set('sub_category', filter.sub_category)
            }

            if (filter.status === 'active') params.set('is_active', 'true')
            if (filter.status === 'inactive') params.set('is_active', 'false')

            const data = await apiRequest(`/v1/templates?${params.toString()}`)
            setTemplates(data.templates || [])
        } catch (err) {
            if (setError) setError(err.message || 'Failed to fetch templates')
        } finally {
            if (!silent) setLoading(false)
        }
    }, [botId, filter, getToken, setError])

    const saveTemplate = async (templateId, payload) => {
        const isEdit = !!templateId
        const url = isEdit ? `/v1/templates/${templateId}` : '/v1/templates'
        const method = isEdit ? 'PATCH' : 'POST'

        const body = { ...payload }
        if (!isEdit) body.bot_id = botId

        const data = await apiRequest(url, {
            method,
            body: JSON.stringify(body)
        })

        await fetchTemplates({ silent: true })
        return data
    }

    const deleteTemplate = async (id) => {
        const data = await apiRequest(`/v1/templates/${id}`, { method: 'DELETE' })
        await fetchTemplates({ silent: true })
        return data
    }

    const toggleTemplate = async (id, nextActive) => {
        setActionLoading(`template:${id}`)
        try {
            const data = await apiRequest(`/v1/templates/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ is_active: nextActive })
            })
            await fetchTemplates({ silent: true })
            return data
        } finally {
            setActionLoading('')
        }
    }

    const applyDefaultTemplates = async () => {
        const data = await apiRequest('/v1/templates/apply-default', {
            method: 'POST',
            body: JSON.stringify({
                bot_id: botId,
                mode: 'skip_existing',
                preset_key: 'default-v1'
            })
        })
        await fetchTemplates({ silent: true })
        return data
    }

    return {
        templates,
        loading,
        actionLoading,
        filter,
        setFilter,
        fetchTemplates,
        saveTemplate,
        deleteTemplate,
        toggleTemplate,
        applyDefaultTemplates
    }
}
