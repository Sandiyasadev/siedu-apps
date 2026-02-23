import { API_BASE } from '../../../config/api'

function useTaxonomyPresetEditor({
    getToken,
    fetchAll,
    setError,
    setActionNotice,
    setDetailLoading,
    setTaxonomyDetail,
    taxonomySubcategoryForm,
    setTaxonomySubcategoryForm,
    setEditingPresetCategoryId,
    setTaxonomyCategoryForm,
    taxonomyDetail,
    setEditingPresetSubcategoryId,
    setTaxonomyEditorSaving,
    editingPresetCategoryId,
    editingPresetSubcategoryId,
    taxonomyCategoryForm,
}) {
    const authHeaders = () => ({
        Authorization: `Bearer ${getToken()}`
    })
    const fetchTaxonomyDetail = async (presetId) => {
        if (!presetId) return
        setDetailLoading((prev) => ({ ...prev, taxonomy: true }))
        try {
            const res = await fetch(`${API_BASE}/v1/admin/taxonomy-presets/${presetId}`, { headers: authHeaders() })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal memuat detail taxonomy preset')
            setTaxonomyDetail(data)
            if (!taxonomySubcategoryForm.category_key && (data.categories || []).length > 0) {
                setTaxonomySubcategoryForm((prev) => ({
                    ...prev,
                    category_key: prev.category_key || data.categories[0].key
                }))
            }
        } catch (err) {
            console.error(err)
            setError(err.message || 'Gagal memuat detail taxonomy preset')
        } finally {
            setDetailLoading((prev) => ({ ...prev, taxonomy: false }))
        }
    }

    const resetTaxonomyCategoryForm = () => {
        setEditingPresetCategoryId(null)
        setTaxonomyCategoryForm({
            key: '',
            label: '',
            description: '',
            sort_order: 0,
            is_active: true
        })
    }

    const resetTaxonomySubcategoryForm = () => {
        setEditingPresetSubcategoryId(null)
        setTaxonomySubcategoryForm({
            category_key: taxonomyDetail?.categories?.[0]?.key || '',
            key: '',
            label: '',
            description: '',
            reply_mode: 'continuation',
            greeting_policy: 'forbidden',
            default_template_count: 3,
            sort_order: 0,
            is_active: true
        })
    }

    const refreshTaxonomyViews = async () => {
        if (taxonomyDetail?.preset?.id) {
            await fetchTaxonomyDetail(taxonomyDetail.preset.id)
        }
        await fetchAll(true)
    }

    const submitTaxonomyCategoryForm = async () => {
        if (!taxonomyDetail?.preset?.id) return
        setTaxonomyEditorSaving(true)
        setActionNotice(null)
        setError('')
        try {
            const isEdit = !!editingPresetCategoryId
            const url = isEdit
                ? `${API_BASE}/v1/admin/taxonomy-presets/categories/${editingPresetCategoryId}`
                : `${API_BASE}/v1/admin/taxonomy-presets/${taxonomyDetail.preset.id}/categories`
            const method = isEdit ? 'PATCH' : 'POST'

            const payload = {
                ...(isEdit ? {} : { key: taxonomyCategoryForm.key }),
                label: taxonomyCategoryForm.label,
                description: taxonomyCategoryForm.description || null,
                sort_order: Number(taxonomyCategoryForm.sort_order) || 0,
                is_active: !!taxonomyCategoryForm.is_active
            }

            const res = await fetch(url, {
                method,
                headers: {
                    ...authHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal menyimpan kategori taxonomy preset')

            await refreshTaxonomyViews()
            setActionNotice({
                type: 'success',
                message: isEdit ? 'Kategori taxonomy preset berhasil diperbarui.' : 'Kategori taxonomy preset berhasil dibuat.'
            })
            resetTaxonomyCategoryForm()
        } catch (err) {
            console.error(err)
            setError(err.message || 'Gagal menyimpan kategori taxonomy preset')
        } finally {
            setTaxonomyEditorSaving(false)
        }
    }

    const submitTaxonomySubcategoryForm = async () => {
        if (!taxonomyDetail?.preset?.id) return
        setTaxonomyEditorSaving(true)
        setActionNotice(null)
        setError('')
        try {
            const isEdit = !!editingPresetSubcategoryId
            const url = isEdit
                ? `${API_BASE}/v1/admin/taxonomy-presets/subcategories/${editingPresetSubcategoryId}`
                : `${API_BASE}/v1/admin/taxonomy-presets/${taxonomyDetail.preset.id}/subcategories`
            const method = isEdit ? 'PATCH' : 'POST'

            const payload = {
                ...(isEdit ? {} : { key: taxonomySubcategoryForm.key }),
                category_key: taxonomySubcategoryForm.category_key,
                label: taxonomySubcategoryForm.label,
                description: taxonomySubcategoryForm.description || null,
                reply_mode: taxonomySubcategoryForm.reply_mode,
                greeting_policy: taxonomySubcategoryForm.greeting_policy,
                default_template_count: Math.max(1, Number(taxonomySubcategoryForm.default_template_count) || 1),
                sort_order: Number(taxonomySubcategoryForm.sort_order) || 0,
                is_active: !!taxonomySubcategoryForm.is_active
            }

            const res = await fetch(url, {
                method,
                headers: {
                    ...authHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal menyimpan intent taxonomy preset')

            await refreshTaxonomyViews()
            setActionNotice({
                type: 'success',
                message: isEdit ? 'Intent taxonomy preset berhasil diperbarui.' : 'Intent taxonomy preset berhasil dibuat.'
            })
            resetTaxonomySubcategoryForm()
        } catch (err) {
            console.error(err)
            setError(err.message || 'Gagal menyimpan intent taxonomy preset')
        } finally {
            setTaxonomyEditorSaving(false)
        }
    }

    const startEditPresetCategory = (category) => {
        setEditingPresetCategoryId(category.id)
        setTaxonomyCategoryForm({
            key: category.key || '',
            label: category.label || '',
            description: category.description || '',
            sort_order: category.sort_order ?? 0,
            is_active: category.is_active !== false
        })
    }

    const startEditPresetSubcategory = (sub) => {
        setEditingPresetSubcategoryId(sub.id)
        setTaxonomySubcategoryForm({
            category_key: sub.category_key || '',
            key: sub.key || '',
            label: sub.label || '',
            description: sub.description || '',
            reply_mode: sub.reply_mode || 'continuation',
            greeting_policy: sub.greeting_policy || 'forbidden',
            default_template_count: sub.default_template_count ?? 3,
            sort_order: sub.sort_order ?? 0,
            is_active: sub.is_active !== false
        })
    }

    const patchTaxonomyPresetCategory = async (categoryId, payload, successMessage) => {
        setTaxonomyEditorSaving(true)
        setActionNotice(null)
        setError('')
        try {
            const res = await fetch(`${API_BASE}/v1/admin/taxonomy-presets/categories/${categoryId}`, {
                method: 'PATCH',
                headers: {
                    ...authHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal memperbarui kategori taxonomy preset')
            await refreshTaxonomyViews()
            setActionNotice({ type: 'success', message: successMessage || 'Kategori berhasil diperbarui.' })
        } catch (err) {
            console.error(err)
            setError(err.message || 'Gagal memperbarui kategori taxonomy preset')
        } finally {
            setTaxonomyEditorSaving(false)
        }
    }

    const patchTaxonomyPresetSubcategory = async (subcategoryId, payload, successMessage) => {
        setTaxonomyEditorSaving(true)
        setActionNotice(null)
        setError('')
        try {
            const res = await fetch(`${API_BASE}/v1/admin/taxonomy-presets/subcategories/${subcategoryId}`, {
                method: 'PATCH',
                headers: {
                    ...authHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal memperbarui intent taxonomy preset')
            await refreshTaxonomyViews()
            setActionNotice({ type: 'success', message: successMessage || 'Intent berhasil diperbarui.' })
        } catch (err) {
            console.error(err)
            setError(err.message || 'Gagal memperbarui intent taxonomy preset')
        } finally {
            setTaxonomyEditorSaving(false)
        }
    }

    const deleteTaxonomyPresetCategory = async (category) => {
        if (!category?.id) return
        if (!window.confirm(`Hapus kategori "${category.label}" (${category.key})?`)) return
        setTaxonomyEditorSaving(true)
        setActionNotice(null)
        setError('')
        try {
            const res = await fetch(`${API_BASE}/v1/admin/taxonomy-presets/categories/${category.id}`, {
                method: 'DELETE',
                headers: authHeaders()
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal menghapus kategori taxonomy preset')
            await refreshTaxonomyViews()
            setActionNotice({ type: 'success', message: 'Kategori berhasil dihapus.' })
            if (editingPresetCategoryId === category.id) resetTaxonomyCategoryForm()
        } catch (err) {
            console.error(err)
            setError(err.message || 'Gagal menghapus kategori taxonomy preset')
        } finally {
            setTaxonomyEditorSaving(false)
        }
    }

    const deleteTaxonomyPresetSubcategory = async (sub) => {
        if (!sub?.id) return
        if (!window.confirm(`Hapus intent/subcategory "${sub.label}" (${sub.key})?`)) return
        setTaxonomyEditorSaving(true)
        setActionNotice(null)
        setError('')
        try {
            const res = await fetch(`${API_BASE}/v1/admin/taxonomy-presets/subcategories/${sub.id}`, {
                method: 'DELETE',
                headers: authHeaders()
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal menghapus intent taxonomy preset')
            await refreshTaxonomyViews()
            setActionNotice({ type: 'success', message: 'Intent berhasil dihapus.' })
            if (editingPresetSubcategoryId === sub.id) resetTaxonomySubcategoryForm()
        } catch (err) {
            console.error(err)
            setError(err.message || 'Gagal menghapus intent taxonomy preset')
        } finally {
            setTaxonomyEditorSaving(false)
        }
    }

    return {
        fetchTaxonomyDetail,
        resetTaxonomyCategoryForm,
        resetTaxonomySubcategoryForm,
        submitTaxonomyCategoryForm,
        submitTaxonomySubcategoryForm,
        startEditPresetCategory,
        startEditPresetSubcategory,
        patchTaxonomyPresetCategory,
        patchTaxonomyPresetSubcategory,
        deleteTaxonomyPresetCategory,
        deleteTaxonomyPresetSubcategory,
    }
}

export default useTaxonomyPresetEditor
