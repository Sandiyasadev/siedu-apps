import { API_BASE } from '../../../config/api'

function useTemplatePresetEditor({
    getToken,
    fetchAll,
    setError,
    setActionNotice,
    setDetailLoading,
    setTemplateDetail,
    setTemplatePresetForm,
    editingTemplatePresetItemId,
    templatePresetItemForm,
    setTemplatePresetItemForm,
    templateDetail,
    templatePresetForm,
    setTemplatePresetSaving,
    setTemplateImportForm,
    templateImportForm,
    setTemplateImportLoading,
    setLastTemplateImportSummary,
    setEditingTemplatePresetItemId,
    setTemplateEditorSaving,
}) {
    const authHeaders = () => ({
        Authorization: `Bearer ${getToken()}`
    })
    const fetchTemplateDetail = async (presetId) => {
        if (!presetId) return
        setDetailLoading((prev) => ({ ...prev, template: true }))
        try {
            const res = await fetch(`${API_BASE}/v1/admin/template-presets/${presetId}`, { headers: authHeaders() })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal memuat detail template preset')
            setTemplateDetail(data)
            setTemplatePresetForm({
                name: data.preset?.name || '',
                description: data.preset?.description || '',
                status: data.preset?.status || 'draft',
                taxonomy_preset_id: data.preset?.taxonomy_preset_id || ''
            })
            if (!editingTemplatePresetItemId && !templatePresetItemForm.category) {
                const firstItem = (data.items || [])[0]
                setTemplatePresetItemForm((prev) => ({
                    ...prev,
                    category: prev.category || firstItem?.category || '',
                    sub_category: prev.sub_category || firstItem?.sub_category || ''
                }))
            }
        } catch (err) {
            console.error(err)
            setError(err.message || 'Gagal memuat detail template preset')
        } finally {
            setDetailLoading((prev) => ({ ...prev, template: false }))
        }
    }

    const resetTemplatePresetForm = () => {
        if (!templateDetail?.preset) return
        setTemplatePresetForm({
            name: templateDetail.preset.name || '',
            description: templateDetail.preset.description || '',
            status: templateDetail.preset.status || 'draft',
            taxonomy_preset_id: templateDetail.preset.taxonomy_preset_id || ''
        })
    }

    const saveTemplatePresetMeta = async () => {
        if (!templateDetail?.preset?.id) return
        setTemplatePresetSaving(true)
        setActionNotice(null)
        setError('')
        try {
            const res = await fetch(`${API_BASE}/v1/admin/template-presets/${templateDetail.preset.id}`, {
                method: 'PATCH',
                headers: {
                    ...authHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: templatePresetForm.name,
                    description: templatePresetForm.description || null,
                    status: templatePresetForm.status,
                    taxonomy_preset_id: templatePresetForm.taxonomy_preset_id || null,
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal memperbarui template preset')

            await refreshTemplateViews()
            setActionNotice({ type: 'success', message: 'Metadata template preset berhasil diperbarui.' })
        } catch (err) {
            console.error(err)
            setError(err.message || 'Gagal memperbarui template preset')
        } finally {
            setTemplatePresetSaving(false)
        }
    }

    const handleTemplateGeneratorJsonFileChange = async (e) => {
        const file = e.target.files?.[0]
        if (!file) {
            setTemplateImportForm((prev) => ({ ...prev, file_name: '', source_json: null }))
            return
        }

        setError('')
        setActionNotice(null)
        try {
            const text = await file.text()
            const parsed = JSON.parse(text)
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.templates)) {
                throw new Error('File JSON harus berupa object dengan field templates[]')
            }
            setTemplateImportForm((prev) => ({
                ...prev,
                file_name: file.name,
                source_json: parsed,
            }))
            setActionNotice({
                type: 'success',
                message: `File JSON siap diimport: ${file.name} (${parsed.templates.length} templates).`
            })
        } catch (err) {
            console.error(err)
            setTemplateImportForm((prev) => ({
                ...prev,
                file_name: file.name,
                source_json: null,
            }))
            setError(err.message || 'Gagal membaca file JSON generator')
        }
    }

    const importTemplatePresetFromGeneratorJson = async () => {
        if (!templateDetail?.preset?.id) return
        if (!templateImportForm.source_json) {
            setError('Pilih file JSON generator terlebih dahulu')
            return
        }
        if (templateImportForm.mode === 'replace_all') {
            const ok = window.confirm('Mode replace_all akan menghapus semua item template preset saat ini dan menggantinya dengan isi file JSON. Lanjutkan?')
            if (!ok) return
        }

        setTemplateImportLoading(true)
        setActionNotice(null)
        setError('')
        setLastTemplateImportSummary(null)
        try {
            const res = await fetch(`${API_BASE}/v1/admin/template-presets/${templateDetail.preset.id}/import-generator-json`, {
                method: 'POST',
                headers: {
                    ...authHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mode: templateImportForm.mode,
                    source_json: templateImportForm.source_json,
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal import JSON generator')

            setLastTemplateImportSummary(data.summary || null)
            await refreshTemplateViews()
            setActionNotice({
                type: 'success',
                message: `Import JSON generator selesai: ${data.summary?.created || 0} item dibuat.`
            })
        } catch (err) {
            console.error(err)
            setError(err.message || 'Gagal import JSON generator')
        } finally {
            setTemplateImportLoading(false)
        }
    }

    const resetTemplatePresetItemForm = () => {
        const firstItem = (templateDetail?.items || [])[0]
        setEditingTemplatePresetItemId(null)
        setTemplatePresetItemForm({
            name: '',
            content: '',
            category: firstItem?.category || '',
            sub_category: firstItem?.sub_category || '',
            shortcut: '',
            strategy_tag: '',
            requires_rag: false,
            is_active: true,
            sort_order: 0
        })
    }

    const refreshTemplateViews = async () => {
        if (templateDetail?.preset?.id) {
            await fetchTemplateDetail(templateDetail.preset.id)
        }
        await fetchAll(true)
    }

    const startEditTemplatePresetItem = (item) => {
        setEditingTemplatePresetItemId(item.id)
        setTemplatePresetItemForm({
            name: item.name || '',
            content: item.content || '',
            category: item.category || '',
            sub_category: item.sub_category || '',
            shortcut: item.shortcut || '',
            strategy_tag: item.strategy_tag || '',
            requires_rag: item.requires_rag === true,
            is_active: item.is_active !== false,
            sort_order: item.sort_order ?? 0
        })
    }

    const submitTemplatePresetItemForm = async () => {
        if (!templateDetail?.preset?.id) return
        setTemplateEditorSaving(true)
        setActionNotice(null)
        setError('')
        try {
            const isEdit = !!editingTemplatePresetItemId
            const url = isEdit
                ? `${API_BASE}/v1/admin/template-presets/items/${editingTemplatePresetItemId}`
                : `${API_BASE}/v1/admin/template-presets/${templateDetail.preset.id}/items`
            const method = isEdit ? 'PATCH' : 'POST'
            const payload = {
                name: templatePresetItemForm.name,
                content: templatePresetItemForm.content,
                category: templatePresetItemForm.category,
                sub_category: templatePresetItemForm.sub_category || null,
                shortcut: templatePresetItemForm.shortcut || null,
                strategy_tag: templatePresetItemForm.strategy_tag || null,
                requires_rag: !!templatePresetItemForm.requires_rag,
                is_active: !!templatePresetItemForm.is_active,
                sort_order: Number(templatePresetItemForm.sort_order) || 0,
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
            if (!res.ok) throw new Error(data.error || 'Gagal menyimpan item template preset')

            await refreshTemplateViews()
            setActionNotice({
                type: 'success',
                message: isEdit ? 'Item template preset berhasil diperbarui.' : 'Item template preset berhasil dibuat.'
            })
            resetTemplatePresetItemForm()
        } catch (err) {
            console.error(err)
            setError(err.message || 'Gagal menyimpan item template preset')
        } finally {
            setTemplateEditorSaving(false)
        }
    }

    const patchTemplatePresetItem = async (itemId, payload, successMessage) => {
        setTemplateEditorSaving(true)
        setActionNotice(null)
        setError('')
        try {
            const res = await fetch(`${API_BASE}/v1/admin/template-presets/items/${itemId}`, {
                method: 'PATCH',
                headers: {
                    ...authHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal memperbarui item template preset')
            await refreshTemplateViews()
            setActionNotice({ type: 'success', message: successMessage || 'Item template preset berhasil diperbarui.' })
        } catch (err) {
            console.error(err)
            setError(err.message || 'Gagal memperbarui item template preset')
        } finally {
            setTemplateEditorSaving(false)
        }
    }

    const deleteTemplatePresetItem = async (item) => {
        if (!item?.id) return
        if (!window.confirm(`Hapus item template preset "${item.name}"?`)) return
        setTemplateEditorSaving(true)
        setActionNotice(null)
        setError('')
        try {
            const res = await fetch(`${API_BASE}/v1/admin/template-presets/items/${item.id}`, {
                method: 'DELETE',
                headers: authHeaders()
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal menghapus item template preset')
            await refreshTemplateViews()
            setActionNotice({ type: 'success', message: 'Item template preset berhasil dihapus.' })
            if (editingTemplatePresetItemId === item.id) resetTemplatePresetItemForm()
        } catch (err) {
            console.error(err)
            setError(err.message || 'Gagal menghapus item template preset')
        } finally {
            setTemplateEditorSaving(false)
        }
    }

    return {
        fetchTemplateDetail,
        resetTemplatePresetForm,
        saveTemplatePresetMeta,
        handleTemplateGeneratorJsonFileChange,
        importTemplatePresetFromGeneratorJson,
        resetTemplatePresetItemForm,
        startEditTemplatePresetItem,
        submitTemplatePresetItemForm,
        patchTemplatePresetItem,
        deleteTemplatePresetItem,
    }
}

export default useTemplatePresetEditor
