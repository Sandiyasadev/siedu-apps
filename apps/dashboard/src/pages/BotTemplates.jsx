import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE } from '../config/api'
import {
    FileText,
    Plus,
    Pencil,
    Trash2,
    ToggleLeft,
    ToggleRight,
    Loader2,
    X,
    Save
} from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

const CATEGORY_COLORS = {
    engagement: { bg: '#dcfce7', color: '#166534' },
    discovery: { bg: '#e0f2fe', color: '#0369a1' },
    evaluation: { bg: '#fef3c7', color: '#92400e' },
    conversion: { bg: '#ede9fe', color: '#6d28d9' },
    retention: { bg: '#fee2e2', color: '#991b1b' },
    general: { bg: '#f3f4f6', color: '#374151' },
}

const emptyTemplateForm = { name: '', content: '', category: '', sub_category: '' }
const emptyCategoryForm = { key: '', label: '', description: '' }
const emptySubcategoryForm = {
    category_key: '',
    key: '',
    label: '',
    description: '',
    reply_mode: 'continuation',
    greeting_policy: 'forbidden',
    default_template_count: 3,
}
const emptyCategoryEditForm = { label: '', description: '', sort_order: 0 }
const emptySubcategoryEditForm = {
    category_key: '',
    label: '',
    description: '',
    reply_mode: 'continuation',
    greeting_policy: 'forbidden',
    default_template_count: 3,
    sort_order: 0,
}

function BotTemplates() {
    const { bot } = useOutletContext()
    const { getToken } = useAuth()

    const [notice, setNotice] = useState('')
    const [error, setError] = useState('')

    const [templates, setTemplates] = useState([])
    const [templatesLoading, setTemplatesLoading] = useState(false)
    const [templateFilter, setTemplateFilter] = useState({
        category: '',
        sub_category: '__all__',
        status: '__all__'
    })

    const [taxonomy, setTaxonomy] = useState({
        categories: [],
        subcategories: [],
        grouped: [],
        uncategorized_subcategories: []
    })
    const [taxonomyLoading, setTaxonomyLoading] = useState(false)

    const [showTemplateModal, setShowTemplateModal] = useState(false)
    const [editingTemplate, setEditingTemplate] = useState(null)
    const [templateForm, setTemplateForm] = useState(emptyTemplateForm)
    const [templateSaving, setTemplateSaving] = useState(false)

    const [categoryForm, setCategoryForm] = useState(emptyCategoryForm)
    const [categorySaving, setCategorySaving] = useState(false)
    const [showCategoryEditModal, setShowCategoryEditModal] = useState(false)
    const [editingCategory, setEditingCategory] = useState(null)
    const [categoryEditForm, setCategoryEditForm] = useState(emptyCategoryEditForm)
    const [categoryEditSaving, setCategoryEditSaving] = useState(false)
    const [subcategoryForm, setSubcategoryForm] = useState(emptySubcategoryForm)
    const [subcategorySaving, setSubcategorySaving] = useState(false)
    const [showSubcategoryEditModal, setShowSubcategoryEditModal] = useState(false)
    const [editingSubcategory, setEditingSubcategory] = useState(null)
    const [subcategoryEditForm, setSubcategoryEditForm] = useState(emptySubcategoryEditForm)
    const [subcategoryEditSaving, setSubcategoryEditSaving] = useState(false)
    const [actionLoading, setActionLoading] = useState('')

    const [confirmDelete, setConfirmDelete] = useState(null)
    const [confirmDeleting, setConfirmDeleting] = useState(false)

    const token = getToken()

    const apiRequest = async (path, options = {}) => {
        const headers = {
            Authorization: `Bearer ${token}`,
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {})
        }
        const res = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers
        })
        let data = {}
        try {
            data = await res.json()
        } catch {
            data = {}
        }
        if (!res.ok) {
            const err = new Error(data.error || `Request failed (${res.status})`)
            err.status = res.status
            err.data = data
            throw err
        }
        return data
    }

    const flashNotice = (message) => {
        setNotice(message)
        setTimeout(() => setNotice(''), 2500)
    }

    const fetchTaxonomy = async () => {
        if (!bot?.id) return
        setTaxonomyLoading(true)
        setError('')
        try {
            const data = await apiRequest(`/v1/template-taxonomy?bot_id=${bot.id}&include_inactive=1`)
            setTaxonomy({
                categories: data.categories || [],
                subcategories: data.subcategories || [],
                grouped: data.grouped || [],
                uncategorized_subcategories: data.uncategorized_subcategories || []
            })
        } catch (err) {
            console.error('Failed to fetch taxonomy:', err)
            setError(err.message || 'Failed to fetch taxonomy')
        } finally {
            setTaxonomyLoading(false)
        }
    }

    const fetchTemplates = async () => {
        if (!bot?.id) return
        setTemplatesLoading(true)
        setError('')
        try {
            const params = new URLSearchParams({ bot_id: bot.id, include_inactive: '1' })
            if (templateFilter.category) params.set('category', templateFilter.category)
            if (templateFilter.sub_category === '__null__') {
                params.set('sub_category', '')
            } else if (templateFilter.sub_category !== '__all__') {
                params.set('sub_category', templateFilter.sub_category)
            }
            if (templateFilter.status === 'active') params.set('is_active', 'true')
            if (templateFilter.status === 'inactive') params.set('is_active', 'false')

            const data = await apiRequest(`/v1/templates?${params.toString()}`)
            setTemplates(data.templates || [])
        } catch (err) {
            console.error('Failed to fetch templates:', err)
            setError(err.message || 'Failed to fetch templates')
        } finally {
            setTemplatesLoading(false)
        }
    }

    useEffect(() => {
        if (!bot?.id) return
        fetchTaxonomy()
    }, [bot?.id])

    useEffect(() => {
        if (!bot?.id) return
        fetchTemplates()
    }, [bot?.id, templateFilter.category, templateFilter.sub_category, templateFilter.status])

    useEffect(() => {
        if (!subcategoryForm.category_key && taxonomy.categories.length > 0) {
            const firstActiveCategory = taxonomy.categories.find(c => c.is_active) || taxonomy.categories[0]
            if (firstActiveCategory) {
                setSubcategoryForm(prev => ({ ...prev, category_key: firstActiveCategory.key }))
            }
        }
    }, [taxonomy.categories.length])

    const categoryMap = {}
    for (const c of taxonomy.categories) categoryMap[c.key] = c
    const subcategoryMap = {}
    for (const s of taxonomy.subcategories) subcategoryMap[s.key] = s

    const categoryOptions = [...taxonomy.categories]
    if (templateForm.category && !categoryOptions.some(c => c.key === templateForm.category)) {
        categoryOptions.push({
            id: `legacy:${templateForm.category}`,
            key: templateForm.category,
            label: `${templateForm.category} (legacy)`,
            is_active: false
        })
    }

    const templateSubcategoryOptions = taxonomy.subcategories.filter(s => {
        if (!templateForm.category) return false
        return s.category_key === templateForm.category
    })
    if (templateForm.sub_category && !templateSubcategoryOptions.some(s => s.key === templateForm.sub_category)) {
        templateSubcategoryOptions.push({
            id: `legacy:${templateForm.sub_category}`,
            key: templateForm.sub_category,
            label: `${templateForm.sub_category} (legacy)`,
            is_active: false,
            category_key: templateForm.category
        })
    }

    const filterSubcategoryOptions = (templateFilter.category
        ? taxonomy.subcategories.filter(s => s.category_key === templateFilter.category)
        : taxonomy.subcategories
    )

    const openCreateModal = () => {
        const firstActiveCategory = taxonomy.categories.find(c => c.is_active)
        const firstSub = firstActiveCategory
            ? taxonomy.subcategories.find(s => s.category_key === firstActiveCategory.key && s.is_active)
            : null

        setEditingTemplate(null)
        setTemplateForm({
            ...emptyTemplateForm,
            category: firstActiveCategory?.key || '',
            sub_category: firstSub?.key || ''
        })
        setShowTemplateModal(true)
    }

    const openEditModal = (t) => {
        setEditingTemplate(t)
        setTemplateForm({
            name: t.name || '',
            content: t.content || '',
            category: t.category || '',
            sub_category: t.sub_category || ''
        })
        setShowTemplateModal(true)
    }

    const saveTemplate = async () => {
        if (!bot?.id || !templateForm.name.trim() || !templateForm.content.trim()) return
        setTemplateSaving(true)
        setError('')
        try {
            const isEdit = !!editingTemplate
            const url = isEdit ? `/v1/templates/${editingTemplate.id}` : '/v1/templates'
            const method = isEdit ? 'PATCH' : 'POST'
            const body = {
                ...templateForm,
                category: templateForm.category || undefined,
                sub_category: templateForm.sub_category || null
            }
            if (!isEdit) body.bot_id = bot.id

            await apiRequest(url, {
                method,
                body: JSON.stringify(body)
            })

            setShowTemplateModal(false)
            flashNotice(isEdit ? 'Template diperbarui' : 'Template ditambahkan')
            await Promise.all([fetchTemplates(), fetchTaxonomy()])
        } catch (err) {
            console.error('Failed to save template:', err)
            setError(err.message || 'Failed to save template')
        } finally {
            setTemplateSaving(false)
        }
    }

    const runTemplateToggle = async (template, nextActive) => {
        setActionLoading(`template:${template.id}`)
        setError('')
        try {
            await apiRequest(`/v1/templates/${template.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ is_active: nextActive })
            })
            flashNotice(nextActive ? 'Template diaktifkan' : 'Template dinonaktifkan')
            await Promise.all([fetchTemplates(), fetchTaxonomy()])
        } catch (err) {
            console.error('Failed to toggle template:', err)
            setError(err.message || 'Failed to toggle template')
        } finally {
            setActionLoading('')
        }
    }

    const toggleTemplate = async (template) => {
        if (template.is_active) {
            openDeleteConfirm({
                type: 'template-deactivate',
                entity: template,
                title: 'Nonaktifkan template?',
                description: `Template "${template.name}" tidak akan dipakai responder sampai diaktifkan kembali.`,
                confirmLabel: 'Nonaktifkan',
                danger: false,
                verificationText: 'NONAKTIFKAN',
                verificationLabel: 'Verifikasi nonaktifkan'
            })
            return
        }

        await runTemplateToggle(template, true)
    }

    const createCategory = async (e) => {
        e.preventDefault()
        if (!bot?.id || !categoryForm.key.trim() || !categoryForm.label.trim()) return
        setCategorySaving(true)
        setError('')
        try {
            await apiRequest('/v1/template-taxonomy/categories', {
                method: 'POST',
                body: JSON.stringify({
                    bot_id: bot.id,
                    key: categoryForm.key,
                    label: categoryForm.label,
                    description: categoryForm.description || null
                })
            })
            setCategoryForm(emptyCategoryForm)
            flashNotice('Kategori ditambahkan')
            await fetchTaxonomy()
        } catch (err) {
            console.error('Failed to create category:', err)
            setError(err.message || 'Failed to create category')
        } finally {
            setCategorySaving(false)
        }
    }

    const createSubcategory = async (e) => {
        e.preventDefault()
        if (!bot?.id || !subcategoryForm.category_key || !subcategoryForm.key.trim() || !subcategoryForm.label.trim()) return
        setSubcategorySaving(true)
        setError('')
        try {
            await apiRequest('/v1/template-taxonomy/subcategories', {
                method: 'POST',
                body: JSON.stringify({
                    bot_id: bot.id,
                    category_key: subcategoryForm.category_key,
                    key: subcategoryForm.key,
                    label: subcategoryForm.label,
                    description: subcategoryForm.description || null,
                    reply_mode: subcategoryForm.reply_mode,
                    greeting_policy: subcategoryForm.greeting_policy,
                    default_template_count: Number(subcategoryForm.default_template_count) || 3
                })
            })
            setSubcategoryForm(prev => ({
                ...emptySubcategoryForm,
                category_key: prev.category_key
            }))
            flashNotice('Sub-kategori ditambahkan')
            await fetchTaxonomy()
        } catch (err) {
            console.error('Failed to create subcategory:', err)
            setError(err.message || 'Failed to create subcategory')
        } finally {
            setSubcategorySaving(false)
        }
    }

    const openEditCategoryModal = (category) => {
        setEditingCategory(category)
        setCategoryEditForm({
            label: category.label || '',
            description: category.description || '',
            sort_order: category.sort_order ?? 0,
        })
        setShowCategoryEditModal(true)
    }

    const saveCategoryEdit = async () => {
        if (!editingCategory?.id || !categoryEditForm.label.trim()) return
        setCategoryEditSaving(true)
        setError('')
        try {
            await apiRequest(`/v1/template-taxonomy/categories/${editingCategory.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    label: categoryEditForm.label,
                    description: categoryEditForm.description || null,
                    sort_order: Number(categoryEditForm.sort_order) || 0
                })
            })
            setShowCategoryEditModal(false)
            setEditingCategory(null)
            flashNotice('Kategori diperbarui')
            await Promise.all([fetchTaxonomy(), fetchTemplates()])
        } catch (err) {
            console.error('Failed to update category:', err)
            setError(err.message || 'Failed to update category')
        } finally {
            setCategoryEditSaving(false)
        }
    }

    const openEditSubcategoryModal = (subcategory) => {
        setEditingSubcategory(subcategory)
        setSubcategoryEditForm({
            category_key: subcategory.category_key || '',
            label: subcategory.label || '',
            description: subcategory.description || '',
            reply_mode: subcategory.reply_mode || 'continuation',
            greeting_policy: subcategory.greeting_policy || 'forbidden',
            default_template_count: subcategory.default_template_count ?? 3,
            sort_order: subcategory.sort_order ?? 0,
        })
        setShowSubcategoryEditModal(true)
    }

    const saveSubcategoryEdit = async () => {
        if (!editingSubcategory?.id || !subcategoryEditForm.label.trim() || !subcategoryEditForm.category_key) return
        setSubcategoryEditSaving(true)
        setError('')
        try {
            await apiRequest(`/v1/template-taxonomy/subcategories/${editingSubcategory.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    category_key: subcategoryEditForm.category_key,
                    label: subcategoryEditForm.label,
                    description: subcategoryEditForm.description || null,
                    reply_mode: subcategoryEditForm.reply_mode,
                    greeting_policy: subcategoryEditForm.greeting_policy,
                    default_template_count: Math.max(1, Number(subcategoryEditForm.default_template_count) || 1),
                    sort_order: Number(subcategoryEditForm.sort_order) || 0
                })
            })
            setShowSubcategoryEditModal(false)
            setEditingSubcategory(null)
            flashNotice('Sub-kategori diperbarui')
            await Promise.all([fetchTaxonomy(), fetchTemplates()])
        } catch (err) {
            console.error('Failed to update subcategory:', err)
            setError(err.message || 'Failed to update subcategory')
        } finally {
            setSubcategoryEditSaving(false)
        }
    }

    const runCategoryToggle = async (category, nextActive) => {
        setActionLoading(`category:${category.id}`)
        setError('')
        try {
            await apiRequest(`/v1/template-taxonomy/categories/${category.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ is_active: nextActive })
            })
            flashNotice(nextActive ? 'Kategori diaktifkan' : 'Kategori dinonaktifkan')
            await Promise.all([fetchTaxonomy(), fetchTemplates()])
        } catch (err) {
            console.error('Failed to toggle category:', err)
            setError(err.message || 'Failed to toggle category')
        } finally {
            setActionLoading('')
        }
    }

    const toggleCategory = async (category) => {
        if (category.is_active) {
            openDeleteConfirm({
                type: 'category-deactivate',
                entity: category,
                title: 'Nonaktifkan kategori?',
                description: `Kategori "${category.label}" akan dinonaktifkan. Dampak: ${category.subcategory_count ?? 0} sub-kategori dan ${category.template_count ?? 0} template pada kategori ini akan diabaikan responder.`,
                confirmLabel: 'Nonaktifkan',
                danger: false,
                verificationText: 'NONAKTIFKAN',
                verificationLabel: 'Verifikasi nonaktifkan'
            })
            return
        }

        await runCategoryToggle(category, true)
    }

    const runSubcategoryToggle = async (subcategory, nextActive) => {
        setActionLoading(`subcategory:${subcategory.id}`)
        setError('')
        try {
            await apiRequest(`/v1/template-taxonomy/subcategories/${subcategory.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ is_active: nextActive })
            })
            flashNotice(nextActive ? 'Sub-kategori diaktifkan' : 'Sub-kategori dinonaktifkan')
            await Promise.all([fetchTaxonomy(), fetchTemplates()])
        } catch (err) {
            console.error('Failed to toggle subcategory:', err)
            setError(err.message || 'Failed to toggle subcategory')
        } finally {
            setActionLoading('')
        }
    }

    const toggleSubcategory = async (subcategory) => {
        if (subcategory.is_active) {
            openDeleteConfirm({
                type: 'subcategory-deactivate',
                entity: subcategory,
                title: 'Nonaktifkan sub-kategori?',
                description: `Sub-kategori "${subcategory.label}" (${subcategory.key}) akan dinonaktifkan. Dampak: ${subcategory.template_count ?? 0} template pada intent ini tidak akan dipakai responder.`,
                confirmLabel: 'Nonaktifkan',
                danger: false,
                verificationText: 'NONAKTIFKAN',
                verificationLabel: 'Verifikasi nonaktifkan'
            })
            return
        }

        await runSubcategoryToggle(subcategory, true)
    }

    const openDeleteConfirm = (payload) => setConfirmDelete(payload)

    const handleConfirmDelete = async () => {
        if (!confirmDelete) return
        setConfirmDeleting(true)
        setError('')
        try {
            if (confirmDelete.type === 'template') {
                await apiRequest(`/v1/templates/${confirmDelete.id}`, { method: 'DELETE' })
                flashNotice('Template dihapus')
            } else if (confirmDelete.type === 'category') {
                await apiRequest(`/v1/template-taxonomy/categories/${confirmDelete.id}`, { method: 'DELETE' })
                flashNotice('Kategori dihapus')
            } else if (confirmDelete.type === 'subcategory') {
                await apiRequest(`/v1/template-taxonomy/subcategories/${confirmDelete.id}`, { method: 'DELETE' })
                flashNotice('Sub-kategori dihapus')
            } else if (confirmDelete.type === 'apply-default-taxonomy') {
                const data = await apiRequest('/v1/template-taxonomy/apply-default', {
                    method: 'POST',
                    body: JSON.stringify({
                        bot_id: bot.id,
                        mode: 'skip_existing'
                    })
                })
                const s = data.summary || {}
                flashNotice(
                    `Default taxonomy diterapkan (kategori +${s.categories_created || 0}, sub-kategori +${s.subcategories_created || 0})`
                )
            } else if (confirmDelete.type === 'apply-default-templates') {
                const data = await apiRequest('/v1/templates/apply-default', {
                    method: 'POST',
                    body: JSON.stringify({
                        bot_id: bot.id,
                        mode: 'skip_existing',
                        preset_key: 'default-v1'
                    })
                })
                const s = data.summary || {}
                flashNotice(
                    `Default template diterapkan (+${s.created || 0}, skip ${s.skipped_existing || 0}, no-taxonomy ${s.skipped_missing_taxonomy || 0})`
                )
            } else if (confirmDelete.type === 'template-deactivate') {
                await runTemplateToggle(confirmDelete.entity, false)
            } else if (confirmDelete.type === 'category-deactivate') {
                await runCategoryToggle(confirmDelete.entity, false)
            } else if (confirmDelete.type === 'subcategory-deactivate') {
                await runSubcategoryToggle(confirmDelete.entity, false)
            }

            setConfirmDelete(null)
            if (!String(confirmDelete.type).includes('deactivate')) {
                await Promise.all([fetchTaxonomy(), fetchTemplates()])
            }
        } catch (err) {
            console.error('Action failed:', err)
            const refs = err?.data?.references
            const refText = refs ? ` (refs: ${Object.entries(refs).map(([k, v]) => `${k}=${v}`).join(', ')})` : ''
            setError(`${err.message || 'Action failed'}${refText}`)
        } finally {
            setConfirmDeleting(false)
        }
    }

    const templateCategoryKeys = Array.from(new Set([
        ...taxonomy.categories.map(c => c.key),
        ...templates.map(t => t.category).filter(Boolean)
    ]))

    return (
        <div>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-4)'
            }}>
                <div>
                    <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                        Templates
                    </h2>
                    <p style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)' }}>
                        Kelola taxonomy kategori/sub-kategori dan template balasan agar langsung dipakai workflow responder.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={openCreateModal}>
                    <Plus size={14} />
                    Add Template
                </button>
            </div>

            {error && (
                <div style={{
                    background: 'var(--error-50)',
                    color: 'var(--error-700)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-4)'
                }}>
                    {error}
                </div>
            )}
            {notice && (
                <div style={{
                    background: 'var(--success-50)',
                    color: 'var(--success-700)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-4)'
                }}>
                    {notice}
                </div>
            )}

            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="card-body">
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: 'var(--space-4)',
                        marginBottom: 'var(--space-4)'
                    }}>
                        <form onSubmit={createCategory} style={{
                            border: '1px solid var(--gray-200)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-4)'
                        }}>
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
                                Tambah Kategori
                            </h3>
                            <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                                <label className="form-label">Key</label>
                                <input
                                    className="form-input"
                                    value={categoryForm.key}
                                    onChange={e => setCategoryForm({ ...categoryForm, key: e.target.value })}
                                    placeholder="contoh: evaluation"
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                                <label className="form-label">Label</label>
                                <input
                                    className="form-input"
                                    value={categoryForm.label}
                                    onChange={e => setCategoryForm({ ...categoryForm, label: e.target.value })}
                                    placeholder="Evaluation"
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                                <label className="form-label">Deskripsi (opsional)</label>
                                <input
                                    className="form-input"
                                    value={categoryForm.description}
                                    onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })}
                                    placeholder="Fase evaluasi harga/keberatan"
                                />
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={categorySaving || !categoryForm.key.trim() || !categoryForm.label.trim()}
                            >
                                {categorySaving ? <Loader2 size={14} className="spinner" /> : <Plus size={14} />}
                                Tambah Kategori
                            </button>
                        </form>

                        <form onSubmit={createSubcategory} style={{
                            border: '1px solid var(--gray-200)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-4)'
                        }}>
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
                                Tambah Sub-Kategori / Intent
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                                <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                                    <label className="form-label">Kategori</label>
                                    <select
                                        className="form-input"
                                        value={subcategoryForm.category_key}
                                        onChange={e => setSubcategoryForm({ ...subcategoryForm, category_key: e.target.value })}
                                    >
                                        <option value="">-- pilih --</option>
                                        {taxonomy.categories.map(c => (
                                            <option key={c.id} value={c.key}>
                                                {c.label} ({c.key}){c.is_active ? '' : ' [inactive]'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                                    <label className="form-label">Reply Mode</label>
                                    <select
                                        className="form-input"
                                        value={subcategoryForm.reply_mode}
                                        onChange={e => setSubcategoryForm({ ...subcategoryForm, reply_mode: e.target.value })}
                                    >
                                        <option value="continuation">continuation</option>
                                        <option value="mixed">mixed</option>
                                        <option value="opening">opening</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                                <label className="form-label">Key</label>
                                <input
                                    className="form-input"
                                    value={subcategoryForm.key}
                                    onChange={e => setSubcategoryForm({ ...subcategoryForm, key: e.target.value })}
                                    placeholder="contoh: evaluation.objection_price"
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                                <label className="form-label">Label</label>
                                <input
                                    className="form-input"
                                    value={subcategoryForm.label}
                                    onChange={e => setSubcategoryForm({ ...subcategoryForm, label: e.target.value })}
                                    placeholder="Objection Price"
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                                <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                                    <label className="form-label">Greeting Policy</label>
                                    <select
                                        className="form-input"
                                        value={subcategoryForm.greeting_policy}
                                        onChange={e => setSubcategoryForm({ ...subcategoryForm, greeting_policy: e.target.value })}
                                    >
                                        <option value="forbidden">forbidden</option>
                                        <option value="optional_short">optional_short</option>
                                        <option value="required">required</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                                    <label className="form-label">Default Count</label>
                                    <input
                                        type="number"
                                        min={1}
                                        className="form-input"
                                        value={subcategoryForm.default_template_count}
                                        onChange={e => setSubcategoryForm({ ...subcategoryForm, default_template_count: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                                <label className="form-label">Deskripsi (opsional)</label>
                                <textarea
                                    className="form-input form-textarea"
                                    rows={2}
                                    value={subcategoryForm.description}
                                    onChange={e => setSubcategoryForm({ ...subcategoryForm, description: e.target.value })}
                                    placeholder="Deskripsi intent untuk classifier/generator"
                                />
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={
                                    subcategorySaving ||
                                    !subcategoryForm.category_key ||
                                    !subcategoryForm.key.trim() ||
                                    !subcategoryForm.label.trim()
                                }
                            >
                                {subcategorySaving ? <Loader2 size={14} className="spinner" /> : <Plus size={14} />}
                                Tambah Sub-Kategori
                            </button>
                        </form>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>
                            Kategori & Sub-Kategori
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <button
                                className="btn"
                                onClick={() => openDeleteConfirm({
                                    type: 'apply-default-templates',
                                    title: 'Terapkan default template?',
                                    description: 'Aksi ini akan menambahkan template default yang belum ada pada bot ini (tanpa menimpa template existing). Template hasil apply tetap bisa diedit/nonaktifkan/hapus per bot.',
                                    confirmLabel: 'Apply Template',
                                    danger: false,
                                    verificationText: 'APPLY TEMPLATE',
                                    verificationLabel: 'Verifikasi apply'
                                })}
                            >
                                <Plus size={14} />
                                Apply Default Templates
                            </button>
                            <button
                                className="btn"
                                onClick={() => openDeleteConfirm({
                                    type: 'apply-default-taxonomy',
                                    title: 'Terapkan default taxonomy?',
                                    description: 'Aksi ini akan menambahkan kategori/sub-kategori default yang belum ada pada bot ini. Data existing tidak akan ditimpa.',
                                    confirmLabel: 'Apply Default',
                                    danger: false,
                                    verificationText: 'APPLY',
                                    verificationLabel: 'Verifikasi apply'
                                })}
                            >
                                <Plus size={14} />
                                Apply Default Taxonomy
                            </button>
                            {taxonomyLoading && <Loader2 size={16} className="spinner" />}
                        </div>
                    </div>

                    {taxonomy.grouped.length === 0 ? (
                        <div style={{
                            border: '1px dashed var(--gray-300)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-4)',
                            color: 'var(--gray-500)'
                        }}>
                            Belum ada kategori. Tambahkan kategori terlebih dulu.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {taxonomy.grouped.map(category => (
                                <div
                                    key={category.id}
                                    style={{
                                        border: '1px solid var(--gray-200)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: 'var(--space-3)',
                                        opacity: category.is_active ? 1 : 0.65
                                    }}
                                >
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        gap: 'var(--space-3)',
                                        marginBottom: 'var(--space-2)'
                                    }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                                <strong>{category.label}</strong>
                                                <span style={{
                                                    fontSize: 'var(--font-size-xs)',
                                                    padding: '2px 8px',
                                                    borderRadius: 12,
                                                    background: '#eef2ff',
                                                    color: '#4338ca',
                                                    fontFamily: 'monospace'
                                                }}>
                                                    {category.key}
                                                </span>
                                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-500)' }}>
                                                    {category.subcategory_count ?? 0} sub • {category.template_count ?? 0} template
                                                </span>
                                            </div>
                                            {category.description && (
                                                <p style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
                                                    {category.description}
                                                </p>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                            <button
                                                onClick={() => openEditCategoryModal(category)}
                                                title="Edit kategori"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-500)', display: 'flex' }}
                                            >
                                                <Pencil size={15} />
                                            </button>
                                            <button
                                                onClick={() => toggleCategory(category)}
                                                title={category.is_active ? 'Nonaktifkan kategori' : 'Aktifkan kategori'}
                                                disabled={actionLoading === `category:${category.id}`}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: category.is_active ? 'var(--success-500)' : 'var(--gray-400)', display: 'flex' }}
                                            >
                                                {actionLoading === `category:${category.id}` ? <Loader2 size={18} className="spinner" /> : (category.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />)}
                                            </button>
                                                <button
                                                    onClick={() => openDeleteConfirm({
                                                        type: 'category',
                                                        id: category.id,
                                                        title: 'Hapus kategori?',
                                                        description: `Kategori "${category.label}" akan dihapus permanen jika tidak memiliki sub-kategori/template terkait.`,
                                                        confirmLabel: 'Hapus',
                                                        verificationText: 'HAPUS',
                                                        verificationLabel: 'Verifikasi hapus'
                                                    })}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-500)', display: 'flex' }}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>

                                    {category.subcategories?.length ? (
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 'var(--space-2)',
                                            marginTop: 'var(--space-2)',
                                            paddingTop: 'var(--space-2)',
                                            borderTop: '1px dashed var(--gray-200)'
                                        }}>
                                            {category.subcategories.map(sub => (
                                                <div
                                                    key={sub.id}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        gap: 'var(--space-2)',
                                                        border: '1px solid var(--gray-100)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        padding: 'var(--space-2) var(--space-3)',
                                                        background: 'var(--gray-50)',
                                                        opacity: sub.effective_is_active ? 1 : 0.6
                                                    }}
                                                >
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                                                            <span style={{ fontWeight: 500 }}>{sub.label}</span>
                                                            <span style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'monospace', color: 'var(--gray-600)' }}>
                                                                {sub.key}
                                                            </span>
                                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-500)' }}>
                                                                {sub.reply_mode} • {sub.greeting_policy} • target {sub.default_template_count}
                                                            </span>
                                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-500)' }}>
                                                                {sub.template_count ?? 0} template
                                                            </span>
                                                        </div>
                                                        {sub.description && (
                                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-500)', marginTop: 2 }}>
                                                                {sub.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                        <button
                                                            onClick={() => openEditSubcategoryModal(sub)}
                                                            title="Edit sub-kategori"
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-500)', display: 'flex' }}
                                                        >
                                                            <Pencil size={15} />
                                                        </button>
                                                        <button
                                                            onClick={() => toggleSubcategory(sub)}
                                                            title={sub.is_active ? 'Nonaktifkan sub-kategori' : 'Aktifkan sub-kategori'}
                                                            disabled={actionLoading === `subcategory:${sub.id}`}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: sub.is_active ? 'var(--success-500)' : 'var(--gray-400)', display: 'flex' }}
                                                        >
                                                            {actionLoading === `subcategory:${sub.id}` ? <Loader2 size={18} className="spinner" /> : (sub.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />)}
                                                        </button>
                                                        <button
                                                            onClick={() => openDeleteConfirm({
                                                                type: 'subcategory',
                                                                id: sub.id,
                                                                title: 'Hapus sub-kategori?',
                                                                description: `Sub-kategori "${sub.label}" akan dihapus permanen jika tidak dipakai template.`,
                                                                confirmLabel: 'Hapus',
                                                                verificationText: 'HAPUS',
                                                                verificationLabel: 'Verifikasi hapus'
                                                            })}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-500)', display: 'flex' }}
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-500)', marginTop: 'var(--space-2)' }}>
                                            Belum ada sub-kategori pada kategori ini.
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {taxonomy.uncategorized_subcategories?.length > 0 && (
                        <div style={{
                            marginTop: 'var(--space-4)',
                            padding: 'var(--space-3)',
                            border: '1px solid var(--warning-200)',
                            background: 'var(--warning-50)',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <strong style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Sub-kategori tanpa kategori terdaftar</strong>
                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--gray-700)' }}>
                                {taxonomy.uncategorized_subcategories.map(s => s.key).join(', ')}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="card">
                <div className="card-body">
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--space-4)',
                        gap: 'var(--space-3)',
                        flexWrap: 'wrap'
                    }}>
                        <div>
                            <h3 style={{
                                fontSize: 'var(--font-size-md)',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)'
                            }}>
                                <FileText size={18} />
                                Response Templates
                            </h3>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--gray-500)', marginTop: 'var(--space-1)' }}>
                                Template nonaktif tidak akan dipakai responder. Template pada kategori/sub-kategori nonaktif juga otomatis diabaikan workflow.
                            </p>
                        </div>
                        <button className="btn btn-primary" onClick={openCreateModal}>
                            <Plus size={14} />
                            Add Template
                        </button>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 'var(--space-3)',
                        alignItems: 'end',
                        marginBottom: 'var(--space-4)'
                    }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Filter Kategori</label>
                            <select
                                className="form-input"
                                value={templateFilter.category}
                                onChange={e => setTemplateFilter({
                                    ...templateFilter,
                                    category: e.target.value,
                                    sub_category: '__all__'
                                })}
                            >
                                <option value="">Semua kategori</option>
                                {templateCategoryKeys.map(key => (
                                    <option key={key} value={key}>{key}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Filter Sub-Kategori</label>
                            <select
                                className="form-input"
                                value={templateFilter.sub_category}
                                onChange={e => setTemplateFilter({ ...templateFilter, sub_category: e.target.value })}
                            >
                                <option value="__all__">Semua sub-kategori</option>
                                <option value="__null__">Tanpa sub-kategori</option>
                                {filterSubcategoryOptions.map(opt => (
                                    <option key={opt.id} value={opt.key}>
                                        {opt.key}{opt.effective_is_active === false ? ' [inactive]' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Status</label>
                            <select
                                className="form-input"
                                value={templateFilter.status}
                                onChange={e => setTemplateFilter({ ...templateFilter, status: e.target.value })}
                            >
                                <option value="__all__">Semua (aktif + nonaktif)</option>
                                <option value="active">Aktif</option>
                                <option value="inactive">Nonaktif</option>
                            </select>
                        </div>

                        <button
                            className="btn"
                            onClick={() => setTemplateFilter({ category: '', sub_category: '__all__', status: '__all__' })}
                        >
                            Reset Filter
                        </button>
                    </div>

                    {templatesLoading ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--gray-400)' }}>
                            <Loader2 size={24} className="spinner" />
                        </div>
                    ) : templates.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: 'var(--space-8)',
                            color: 'var(--gray-400)',
                            border: '2px dashed var(--gray-200)',
                            borderRadius: 'var(--radius-lg)'
                        }}>
                            <FileText size={32} style={{ marginBottom: 'var(--space-2)', opacity: 0.5 }} />
                            <p>Belum ada template untuk filter ini.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {templates.map(t => {
                                const catStyle = CATEGORY_COLORS[t.category] || CATEGORY_COLORS.general
                                const categoryMeta = t.category ? categoryMap[t.category] : null
                                const subMeta = t.sub_category ? subcategoryMap[t.sub_category] : null
                                const categoryInactive = !!(categoryMeta && categoryMeta.is_active === false)
                                const subcategoryInactive = !!(subMeta && subMeta.effective_is_active === false)

                                return (
                                    <div
                                        key={t.id}
                                        style={{
                                            border: '1px solid var(--gray-200)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: 'var(--space-3) var(--space-4)',
                                            opacity: t.is_active ? 1 : 0.55,
                                            transition: 'opacity 0.2s'
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: 'var(--space-3)',
                                            marginBottom: 'var(--space-2)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                                <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{t.name}</span>
                                                <span style={{
                                                    fontSize: 'var(--font-size-xs)',
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    background: catStyle.bg,
                                                    color: catStyle.color,
                                                    fontWeight: 500
                                                }}>
                                                    {t.category || 'general'}
                                                </span>
                                                {t.sub_category && (
                                                    <span style={{
                                                        fontSize: 'var(--font-size-xs)',
                                                        padding: '2px 8px',
                                                        borderRadius: '12px',
                                                        background: '#f0fdf4',
                                                        color: '#16a34a',
                                                        fontWeight: 500,
                                                        fontFamily: 'monospace'
                                                    }}>
                                                        {t.sub_category}
                                                    </span>
                                                )}
                                                {!t.is_active && (
                                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--error-600)' }}>Template nonaktif</span>
                                                )}
                                                {categoryInactive && (
                                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--warning-700)' }}>Kategori nonaktif</span>
                                                )}
                                                {subcategoryInactive && (
                                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--warning-700)' }}>Sub-kategori nonaktif</span>
                                                )}
                                                {t.use_count > 0 && (
                                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-400)' }}>
                                                        Digunakan {t.use_count}x
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                <button
                                                    onClick={() => toggleTemplate(t)}
                                                    title={t.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                                    disabled={actionLoading === `template:${t.id}`}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        padding: '4px',
                                                        color: t.is_active ? 'var(--success-500)' : 'var(--gray-400)',
                                                        display: 'flex'
                                                    }}
                                                >
                                                    {actionLoading === `template:${t.id}` ? <Loader2 size={18} className="spinner" /> : (t.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />)}
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(t)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--gray-500)', display: 'flex' }}
                                                >
                                                    <Pencil size={15} />
                                                </button>
                                                <button
                                                    onClick={() => openDeleteConfirm({
                                                        type: 'template',
                                                        id: t.id,
                                                        title: 'Hapus template?',
                                                        description: `Template "${t.name}" akan dihapus permanen dan tidak bisa dikembalikan.`,
                                                        confirmLabel: 'Hapus',
                                                        verificationText: 'HAPUS',
                                                        verificationLabel: 'Verifikasi hapus'
                                                    })}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--error-400)', display: 'flex' }}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </div>
                                        <p style={{
                                            fontSize: 'var(--font-size-sm)',
                                            color: 'var(--gray-500)',
                                            lineHeight: 1.5,
                                            whiteSpace: 'pre-wrap',
                                            maxHeight: 80,
                                            overflow: 'hidden'
                                        }}>
                                            {t.content}
                                        </p>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                open={!!confirmDelete}
                title={confirmDelete?.title || 'Konfirmasi aksi'}
                description={confirmDelete?.description || ''}
                confirmLabel={confirmDelete?.confirmLabel || 'Lanjutkan'}
                danger={confirmDelete?.danger ?? true}
                verificationText={confirmDelete?.verificationText || ''}
                verificationLabel={confirmDelete?.verificationLabel || 'Verifikasi'}
                loading={confirmDeleting}
                onConfirm={handleConfirmDelete}
                onCancel={() => setConfirmDelete(null)}
            />

            {showCategoryEditModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-6)',
                        width: '100%',
                        maxWidth: 520,
                        maxHeight: '90vh',
                        overflow: 'auto',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 'var(--space-4)'
                        }}>
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>
                                Edit Kategori
                            </h3>
                            <button
                                onClick={() => { setShowCategoryEditModal(false); setEditingCategory(null) }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--gray-500)' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Key (read-only)</label>
                            <input className="form-input" value={editingCategory?.key || ''} readOnly style={{ background: 'var(--gray-50)' }} />
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-500)', marginTop: 'var(--space-1)' }}>
                                Key belum bisa diubah untuk menghindari memutus relasi template/workflow.
                            </p>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Label</label>
                            <input
                                className="form-input"
                                value={categoryEditForm.label}
                                onChange={e => setCategoryEditForm({ ...categoryEditForm, label: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Deskripsi</label>
                            <textarea
                                className="form-input form-textarea"
                                rows={3}
                                value={categoryEditForm.description}
                                onChange={e => setCategoryEditForm({ ...categoryEditForm, description: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Sort Order</label>
                            <input
                                type="number"
                                className="form-input"
                                value={categoryEditForm.sort_order}
                                onChange={e => setCategoryEditForm({ ...categoryEditForm, sort_order: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                            <button
                                className="btn"
                                onClick={() => { setShowCategoryEditModal(false); setEditingCategory(null) }}
                                style={{ background: 'var(--gray-100)', color: 'var(--gray-600)' }}
                            >
                                Batal
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={saveCategoryEdit}
                                disabled={categoryEditSaving || !categoryEditForm.label.trim()}
                            >
                                {categoryEditSaving ? <Loader2 size={14} className="spinner" /> : <Save size={14} />}
                                Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSubcategoryEditModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-6)',
                        width: '100%',
                        maxWidth: 620,
                        maxHeight: '90vh',
                        overflow: 'auto',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 'var(--space-4)'
                        }}>
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>
                                Edit Sub-Kategori / Intent
                            </h3>
                            <button
                                onClick={() => { setShowSubcategoryEditModal(false); setEditingSubcategory(null) }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--gray-500)' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Key (read-only)</label>
                            <input className="form-input" value={editingSubcategory?.key || ''} readOnly style={{ background: 'var(--gray-50)' }} />
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-500)', marginTop: 'var(--space-1)' }}>
                                Key intent belum bisa diubah agar mapping template (`sub_category`) tetap aman.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Kategori</label>
                                <select
                                    className="form-input"
                                    value={subcategoryEditForm.category_key}
                                    onChange={e => setSubcategoryEditForm({ ...subcategoryEditForm, category_key: e.target.value })}
                                >
                                    {taxonomy.categories.map(c => (
                                        <option key={c.id} value={c.key}>
                                            {c.label} ({c.key}){c.is_active ? '' : ' [inactive]'}
                                        </option>
                                    ))}
                                </select>
                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-500)', marginTop: 'var(--space-1)' }}>
                                    Memindahkan kategori tidak mengubah key intent.
                                </p>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Label</label>
                                <input
                                    className="form-input"
                                    value={subcategoryEditForm.label}
                                    onChange={e => setSubcategoryEditForm({ ...subcategoryEditForm, label: e.target.value })}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Reply Mode</label>
                                <select
                                    className="form-input"
                                    value={subcategoryEditForm.reply_mode}
                                    onChange={e => setSubcategoryEditForm({ ...subcategoryEditForm, reply_mode: e.target.value })}
                                >
                                    <option value="continuation">continuation</option>
                                    <option value="mixed">mixed</option>
                                    <option value="opening">opening</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Greeting Policy</label>
                                <select
                                    className="form-input"
                                    value={subcategoryEditForm.greeting_policy}
                                    onChange={e => setSubcategoryEditForm({ ...subcategoryEditForm, greeting_policy: e.target.value })}
                                >
                                    <option value="forbidden">forbidden</option>
                                    <option value="optional_short">optional_short</option>
                                    <option value="required">required</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Default Count</label>
                                <input
                                    type="number"
                                    min={1}
                                    className="form-input"
                                    value={subcategoryEditForm.default_template_count}
                                    onChange={e => setSubcategoryEditForm({ ...subcategoryEditForm, default_template_count: e.target.value })}
                                />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Sort Order</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={subcategoryEditForm.sort_order}
                                    onChange={e => setSubcategoryEditForm({ ...subcategoryEditForm, sort_order: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Deskripsi</label>
                            <textarea
                                className="form-input form-textarea"
                                rows={3}
                                value={subcategoryEditForm.description}
                                onChange={e => setSubcategoryEditForm({ ...subcategoryEditForm, description: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                            <button
                                className="btn"
                                onClick={() => { setShowSubcategoryEditModal(false); setEditingSubcategory(null) }}
                                style={{ background: 'var(--gray-100)', color: 'var(--gray-600)' }}
                            >
                                Batal
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={saveSubcategoryEdit}
                                disabled={subcategoryEditSaving || !subcategoryEditForm.label.trim() || !subcategoryEditForm.category_key}
                            >
                                {subcategoryEditSaving ? <Loader2 size={14} className="spinner" /> : <Save size={14} />}
                                Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showTemplateModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-6)',
                        width: '100%',
                        maxWidth: 620,
                        maxHeight: '90vh',
                        overflow: 'auto',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 'var(--space-4)'
                        }}>
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>
                                {editingTemplate ? 'Edit Template' : 'Tambah Template'}
                            </h3>
                            <button
                                onClick={() => setShowTemplateModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--gray-500)' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Nama Template</label>
                            <input
                                type="text"
                                className="form-input"
                                value={templateForm.name}
                                onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                                placeholder="Contoh: Objection Harga - Value First"
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Kategori</label>
                                <select
                                    className="form-input"
                                    value={templateForm.category}
                                    onChange={e => {
                                        const nextCategory = e.target.value
                                        const firstSub = taxonomy.subcategories.find(s => s.category_key === nextCategory && s.is_active)
                                        setTemplateForm({
                                            ...templateForm,
                                            category: nextCategory,
                                            sub_category: nextCategory ? (firstSub?.key || '') : ''
                                        })
                                    }}
                                >
                                    <option value="">— Pilih Kategori —</option>
                                    {categoryOptions.map(c => (
                                        <option key={c.id} value={c.key}>
                                            {c.label || c.key} ({c.key}){c.is_active ? '' : ' [inactive]'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ color: !templateForm.category ? 'var(--gray-300)' : undefined }}>
                                    Sub-Kategori / Intent
                                </label>
                                <select
                                    className="form-input"
                                    value={templateForm.sub_category}
                                    disabled={!templateForm.category}
                                    onChange={e => setTemplateForm({ ...templateForm, sub_category: e.target.value })}
                                    style={{ opacity: !templateForm.category ? 0.45 : 1, cursor: !templateForm.category ? 'not-allowed' : 'pointer' }}
                                >
                                    <option value="">{templateForm.category ? '— Opsional / pilih intent —' : '← pilih kategori dulu'}</option>
                                    {templateSubcategoryOptions.map(opt => (
                                        <option key={opt.id} value={opt.key}>
                                            {opt.label || opt.key} ({opt.key}){opt.effective_is_active === false || opt.is_active === false ? ' [inactive]' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Isi Template</label>
                            <textarea
                                className="form-input form-textarea"
                                value={templateForm.content}
                                onChange={e => setTemplateForm({ ...templateForm, content: e.target.value })}
                                rows={7}
                                placeholder="Tulis template balasan..."
                            />
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-400)', marginTop: 'var(--space-1)' }}>
                                Template dipakai sebagai kerangka jawaban. Pastikan sesuai intent dan konteks percakapan (opening vs continuation).
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                            <button
                                className="btn"
                                onClick={() => setShowTemplateModal(false)}
                                style={{ background: 'var(--gray-100)', color: 'var(--gray-600)' }}
                            >
                                Batal
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={saveTemplate}
                                disabled={templateSaving || !templateForm.name.trim() || !templateForm.content.trim()}
                            >
                                {templateSaving ? <Loader2 size={14} className="spinner" /> : <Save size={14} />}
                                {editingTemplate ? 'Update' : 'Simpan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default BotTemplates
