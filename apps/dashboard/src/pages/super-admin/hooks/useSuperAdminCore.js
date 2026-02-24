import { useEffect, useState } from 'react'
import { API_BASE } from '../../../config/api'

function useSuperAdminCore({ getToken }) {
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState('')

    const [workspaces, setWorkspaces] = useState([])
    const [taxonomyPresets, setTaxonomyPresets] = useState([])
    const [templatePresets, setTemplatePresets] = useState([])
    const [applyLogs, setApplyLogs] = useState([])

    const [taxonomyDetail, setTaxonomyDetail] = useState(null)
    const [templateDetail, setTemplateDetail] = useState(null)
    const [detailLoading, setDetailLoading] = useState({ taxonomy: false, template: false })
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('')
    const [workspaceAssignment, setWorkspaceAssignment] = useState(null)
    const [assignmentLoading, setAssignmentLoading] = useState(false)
    const [assignmentSaving, setAssignmentSaving] = useState(false)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [applyLoading, setApplyLoading] = useState(false)
    const [bootstrapLoading, setBootstrapLoading] = useState(false)
    const [assignmentForm, setAssignmentForm] = useState({
        taxonomy_preset_id: '',
        template_preset_id: '',
        apply_mode: 'skip_existing'
    })
    const [bootstrapForm, setBootstrapForm] = useState({
        target_scope: 'global',
        preset_scope: 'both'
    })
    const [actionNotice, setActionNotice] = useState(null)
    const [lastApplySummary, setLastApplySummary] = useState(null)
    const [lastPreviewSummary, setLastPreviewSummary] = useState(null)
    const [lastBootstrapSummary, setLastBootstrapSummary] = useState(null)
    const [taxonomyCategoryForm, setTaxonomyCategoryForm] = useState({
        key: '',
        label: '',
        description: '',
        sort_order: 0,
        is_active: true
    })
    const [taxonomySubcategoryForm, setTaxonomySubcategoryForm] = useState({
        category_key: '',
        key: '',
        label: '',
        description: '',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 3,
        sort_order: 0,
        is_active: true
    })
    const [editingPresetCategoryId, setEditingPresetCategoryId] = useState(null)
    const [editingPresetSubcategoryId, setEditingPresetSubcategoryId] = useState(null)
    const [taxonomyEditorSaving, setTaxonomyEditorSaving] = useState(false)
    const [templatePresetForm, setTemplatePresetForm] = useState({
        name: '',
        description: '',
        status: 'draft',
        taxonomy_preset_id: ''
    })
    const [templatePresetSaving, setTemplatePresetSaving] = useState(false)
    const [templateImportForm, setTemplateImportForm] = useState({
        mode: 'replace_all',
        file_name: '',
        source_json: null,
    })
    const [templateImportLoading, setTemplateImportLoading] = useState(false)
    const [lastTemplateImportSummary, setLastTemplateImportSummary] = useState(null)
    const [templatePresetItemForm, setTemplatePresetItemForm] = useState({
        name: '',
        content: '',
        category: '',
        sub_category: '',
        shortcut: '',
        strategy_tag: '',
        requires_rag: false,
        is_active: true,
        sort_order: 0
    })
    const [editingTemplatePresetItemId, setEditingTemplatePresetItemId] = useState(null)
    const [templateEditorSaving, setTemplateEditorSaving] = useState(false)

    useEffect(() => {
        fetchAll()
    }, [])

    useEffect(() => {
        if (!selectedWorkspaceId && workspaces.length > 0) {
            setSelectedWorkspaceId(workspaces[0].id)
        }
    }, [workspaces, selectedWorkspaceId])

    useEffect(() => {
        if (selectedWorkspaceId) {
            fetchWorkspaceAssignment(selectedWorkspaceId)
        } else {
            setWorkspaceAssignment(null)
            setAssignmentForm((prev) => ({ ...prev, taxonomy_preset_id: '', template_preset_id: '' }))
        }
    }, [selectedWorkspaceId])

    const authHeaders = () => ({
        Authorization: `Bearer ${getToken()}`
    })

    const fetchAll = async (isManualRefresh = false) => {
        if (isManualRefresh) setRefreshing(true)
        else setLoading(true)
        setError('')
        setActionNotice(null)

        try {
            const [wsRes, taxRes, tplRes, logsRes] = await Promise.all([
                fetch(`${API_BASE}/v1/admin/workspaces`, { headers: authHeaders() }),
                fetch(`${API_BASE}/v1/admin/taxonomy-presets`, { headers: authHeaders() }),
                fetch(`${API_BASE}/v1/admin/template-presets`, { headers: authHeaders() }),
                fetch(`${API_BASE}/v1/admin/preset-apply-logs?limit=20`, { headers: authHeaders() })
            ])

            const [wsData, taxData, tplData, logsData] = await Promise.all([
                wsRes.json(),
                taxRes.json(),
                tplRes.json(),
                logsRes.json()
            ])

            if (!wsRes.ok) throw new Error(wsData.error || 'Failed to fetch workspaces')
            if (!taxRes.ok) throw new Error(taxData.error || 'Failed to fetch taxonomy presets')
            if (!tplRes.ok) throw new Error(tplData.error || 'Failed to fetch template presets')
            if (!logsRes.ok) throw new Error(logsData.error || 'Failed to fetch apply logs')

            setWorkspaces(wsData.workspaces || [])
            setTaxonomyPresets(taxData.presets || [])
            setTemplatePresets(tplData.presets || [])
            setApplyLogs(logsData.logs || [])
        } catch (err) {
            console.error('Failed to fetch super admin data:', err)
            setError(err.message || 'Gagal memuat data super admin')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    const fetchWorkspaceAssignment = async (workspaceId) => {
        if (!workspaceId) return
        setAssignmentLoading(true)
        setActionNotice(null)
        try {
            const res = await fetch(`${API_BASE}/v1/admin/workspaces/${workspaceId}/preset-assignment`, {
                headers: authHeaders()
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal memuat assignment workspace')
            setWorkspaceAssignment(data.assignment || null)
            setAssignmentForm((prev) => ({
                ...prev,
                taxonomy_preset_id: data.assignment?.taxonomy_preset_id || '',
                template_preset_id: data.assignment?.template_preset_id || ''
            }))
        } catch (err) {
            console.error(err)
            setError(err.message || 'Gagal memuat assignment workspace')
        } finally {
            setAssignmentLoading(false)
        }
    }

    const saveWorkspaceAssignment = async () => {
        if (!selectedWorkspaceId) return
        setAssignmentSaving(true)
        setActionNotice(null)
        try {
            const res = await fetch(`${API_BASE}/v1/admin/workspaces/${selectedWorkspaceId}/preset-assignment`, {
                method: 'PUT',
                headers: {
                    ...authHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    taxonomy_preset_id: assignmentForm.taxonomy_preset_id || null,
                    template_preset_id: assignmentForm.template_preset_id || null
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal menyimpan assignment workspace')
            setWorkspaceAssignment(data.assignment || null)
            setActionNotice({
                type: 'success',
                message: 'Assignment preset workspace berhasil disimpan.'
            })
        } catch (err) {
            console.error(err)
            setError(err.message || 'Gagal menyimpan assignment workspace')
        } finally {
            setAssignmentSaving(false)
        }
    }

    const applyAssignedPresets = async () => {
        if (!selectedWorkspaceId) return
        setApplyLoading(true)
        setActionNotice(null)
        setLastApplySummary(null)
        try {
            const res = await fetch(`${API_BASE}/v1/admin/workspaces/${selectedWorkspaceId}/apply-bundle`, {
                method: 'POST',
                headers: {
                    ...authHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    scope: 'both',
                    mode: assignmentForm.apply_mode || 'skip_existing'
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal menjalankan apply preset')

            setLastApplySummary(data.summary || null)
            setActionNotice({
                type: 'success',
                message: `Apply preset selesai. ${data.summary?.bots_processed || 0}/${data.summary?.bots_total || 0} bot diproses.`
            })

            // refresh logs after apply
            const logsRes = await fetch(`${API_BASE}/v1/admin/preset-apply-logs?limit=20`, { headers: authHeaders() })
            const logsData = await logsRes.json()
            if (logsRes.ok) {
                setApplyLogs(logsData.logs || [])
            }
        } catch (err) {
            console.error(err)
            setError(err.message || 'Gagal menjalankan apply preset')
        } finally {
            setApplyLoading(false)
        }
    }

    const previewAssignedPresets = async () => {
        if (!selectedWorkspaceId) return
        setPreviewLoading(true)
        setActionNotice(null)
        setLastPreviewSummary(null)
        try {
            const res = await fetch(`${API_BASE}/v1/admin/workspaces/${selectedWorkspaceId}/preview-apply-bundle`, {
                method: 'POST',
                headers: {
                    ...authHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    scope: 'both',
                    mode: assignmentForm.apply_mode || 'skip_existing'
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal menjalankan preview apply')

            setLastPreviewSummary(data.summary || null)
            setActionNotice({
                type: 'success',
                message: `Preview selesai. ${data.summary?.bots_processed || 0}/${data.summary?.bots_total || 0} bot dihitung tanpa perubahan data.`
            })
        } catch (err) {
            console.error(err)
            setError(err.message || 'Gagal menjalankan preview apply')
        } finally {
            setPreviewLoading(false)
        }
    }

    const bootstrapDefaultPresets = async () => {
        const useWorkspaceTarget = bootstrapForm.target_scope === 'workspace'
        if (useWorkspaceTarget && !selectedWorkspaceId) {
            setError('Pilih workspace terlebih dahulu untuk bootstrap workspace-scoped preset')
            return
        }

        setBootstrapLoading(true)
        setActionNotice(null)
        setLastBootstrapSummary(null)
        try {
            const res = await fetch(`${API_BASE}/v1/admin/presets/bootstrap-defaults`, {
                method: 'POST',
                headers: {
                    ...authHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    scope: bootstrapForm.preset_scope || 'both',
                    workspace_id: useWorkspaceTarget ? selectedWorkspaceId : null
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal menjalankan bootstrap preset default')

            setLastBootstrapSummary(data.summary || null)
            await fetchAll(true)
            setActionNotice({
                type: 'success',
                message: `Bootstrap preset default selesai (${data.summary?.scope || bootstrapForm.preset_scope}) untuk ${useWorkspaceTarget ? 'workspace terpilih' : 'scope global'}.`
            })
        } catch (err) {
            console.error(err)
            setError(err.message || 'Gagal menjalankan bootstrap preset default')
        } finally {
            setBootstrapLoading(false)
        }
    }

    return {
        loading,
        refreshing,
        error,
        setError,
        workspaces,
        taxonomyPresets,
        templatePresets,
        applyLogs,
        taxonomyDetail,
        setTaxonomyDetail,
        templateDetail,
        setTemplateDetail,
        detailLoading,
        setDetailLoading,
        selectedWorkspaceId,
        setSelectedWorkspaceId,
        workspaceAssignment,
        setWorkspaceAssignment,
        assignmentLoading,
        assignmentSaving,
        previewLoading,
        applyLoading,
        bootstrapLoading,
        assignmentForm,
        setAssignmentForm,
        bootstrapForm,
        setBootstrapForm,
        actionNotice,
        setActionNotice,
        lastApplySummary,
        setLastApplySummary,
        lastPreviewSummary,
        setLastPreviewSummary,
        lastBootstrapSummary,
        setLastBootstrapSummary,
        taxonomyCategoryForm,
        setTaxonomyCategoryForm,
        taxonomySubcategoryForm,
        setTaxonomySubcategoryForm,
        editingPresetCategoryId,
        setEditingPresetCategoryId,
        editingPresetSubcategoryId,
        setEditingPresetSubcategoryId,
        taxonomyEditorSaving,
        setTaxonomyEditorSaving,
        templatePresetForm,
        setTemplatePresetForm,
        templatePresetSaving,
        setTemplatePresetSaving,
        templateImportForm,
        setTemplateImportForm,
        templateImportLoading,
        setTemplateImportLoading,
        lastTemplateImportSummary,
        setLastTemplateImportSummary,
        templatePresetItemForm,
        setTemplatePresetItemForm,
        editingTemplatePresetItemId,
        setEditingTemplatePresetItemId,
        templateEditorSaving,
        setTemplateEditorSaving,
        fetchAll,
        fetchWorkspaceAssignment,
        saveWorkspaceAssignment,
        applyAssignedPresets,
        previewAssignedPresets,
        bootstrapDefaultPresets,
    }
}

export default useSuperAdminCore
