import { useState, useCallback } from 'react'
import { API_BASE } from '../../../config/api'

export function useTaxonomy(botId, getToken, setError) {
    const [taxonomy, setTaxonomy] = useState({
        categories: [],
        subcategories: [],
        grouped: [],
        uncategorized_subcategories: []
    })
    const [loading, setLoading] = useState(false)
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

    const fetchTaxonomy = useCallback(async () => {
        if (!botId) return
        setLoading(true)
        if (setError) setError('')
        try {
            const data = await apiRequest(`/v1/template-taxonomy?bot_id=${botId}&include_inactive=1`)
            setTaxonomy({
                categories: data.categories || [],
                subcategories: data.subcategories || [],
                grouped: data.grouped || [],
                uncategorized_subcategories: data.uncategorized_subcategories || []
            })
        } catch (err) {
            console.error('Failed to fetch taxonomy:', err)
            if (setError) setError(err.message || 'Failed to fetch taxonomy')
        } finally {
            setLoading(false)
        }
    }, [botId, getToken, setError])

    const createCategory = async (payload) => {
        const data = await apiRequest('/v1/template-taxonomy/categories', {
            method: 'POST',
            body: JSON.stringify({ bot_id: botId, ...payload })
        })
        await fetchTaxonomy()
        return data
    }

    const updateCategory = async (id, payload) => {
        const data = await apiRequest(`/v1/template-taxonomy/categories/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
        })
        await fetchTaxonomy()
        return data
    }

    const deleteCategory = async (id) => {
        const data = await apiRequest(`/v1/template-taxonomy/categories/${id}`, { method: 'DELETE' })
        await fetchTaxonomy()
        return data
    }

    const toggleCategory = async (id, nextActive) => {
        setActionLoading(`category:${id}`)
        try {
            await updateCategory(id, { is_active: nextActive })
        } finally {
            setActionLoading('')
        }
    }

    const createSubcategory = async (payload) => {
        const data = await apiRequest('/v1/template-taxonomy/subcategories', {
            method: 'POST',
            body: JSON.stringify({ bot_id: botId, ...payload })
        })
        await fetchTaxonomy()
        return data
    }

    const updateSubcategory = async (id, payload) => {
        const data = await apiRequest(`/v1/template-taxonomy/subcategories/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
        })
        await fetchTaxonomy()
        return data
    }

    const deleteSubcategory = async (id) => {
        const data = await apiRequest(`/v1/template-taxonomy/subcategories/${id}`, { method: 'DELETE' })
        await fetchTaxonomy()
        return data
    }

    const toggleSubcategory = async (id, nextActive) => {
        setActionLoading(`subcategory:${id}`)
        try {
            await updateSubcategory(id, { is_active: nextActive })
        } finally {
            setActionLoading('')
        }
    }

    const applyDefaultTaxonomy = async () => {
        const data = await apiRequest('/v1/template-taxonomy/apply-default', {
            method: 'POST',
            body: JSON.stringify({ bot_id: botId, mode: 'skip_existing' })
        })
        await fetchTaxonomy()
        return data
    }

    return {
        taxonomy,
        loading,
        actionLoading,
        fetchTaxonomy,
        createCategory,
        updateCategory,
        deleteCategory,
        toggleCategory,
        createSubcategory,
        updateSubcategory,
        deleteSubcategory,
        toggleSubcategory,
        applyDefaultTaxonomy
    }
}
