import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../App'

// Hooks
import { useTaxonomy } from './bot-templates/hooks/useTaxonomy'
import { useTemplates } from './bot-templates/hooks/useTemplates'

// Components
import { TaxonomySidebar } from './bot-templates/components/TaxonomySidebar'
import { CategoryModal, SubcategoryModal } from './bot-templates/components/TaxonomyModals'
import { TemplateWorkspace } from './bot-templates/components/TemplateWorkspace'
import { TemplateEditorModal } from './bot-templates/components/TemplateModals'
import ConfirmModal from '../components/ConfirmModal'

export default function BotTemplates() {
    const { bot } = useOutletContext()
    const { getToken } = useAuth()

    const [notice, setNotice] = useState('')
    const [error, setError] = useState('')
    const flashNotice = (msg) => {
        setNotice(msg)
        setTimeout(() => setNotice(''), 3000)
    }

    // --- Hooks ---
    const {
        taxonomy, loading: taxonomyLoading, actionLoading: taxActionLoading,
        fetchTaxonomy, createCategory, updateCategory, deleteCategory, toggleCategory,
        createSubcategory, updateSubcategory, deleteSubcategory, toggleSubcategory, applyDefaultTaxonomy
    } = useTaxonomy(bot?.id, getToken, setError)

    const {
        templates, loading: templatesLoading, actionLoading: tplActionLoading,
        filter, setFilter, fetchTemplates, saveTemplate, deleteTemplate, toggleTemplate, applyDefaultTemplates
    } = useTemplates(bot?.id, getToken, setError)

    useEffect(() => { fetchTaxonomy() }, [fetchTaxonomy])
    useEffect(() => { fetchTemplates() }, [fetchTemplates])

    // --- Modal States ---
    const [modals, setModals] = useState({
        template: false,
        category: false,
        subcategory: false,
        confirm: null
    })

    // Form States
    const [editingCategory, setEditingCategory] = useState(null)
    const [editingSubcategory, setEditingSubcategory] = useState(null)
    const [editingTemplate, setEditingTemplate] = useState(null)

    // Saving states specifically for modal buttons
    const [savingCat, setSavingCat] = useState(false)
    const [savingSub, setSavingSub] = useState(false)
    const [savingTpl, setSavingTpl] = useState(false)
    const [confirmDeleting, setConfirmDeleting] = useState(false)

    // --- Handlers: Taxonomy ---
    const handleSaveCategory = async (payload) => {
        setSavingCat(true)
        try {
            if (editingCategory?.id) {
                await updateCategory(editingCategory.id, payload)
                flashNotice('Kategori diperbarui')
            } else {
                await createCategory(payload)
                flashNotice('Kategori ditambahkan')
            }
            setModals(m => ({ ...m, category: false }))
        } finally { setSavingCat(false) }
    }

    const handleSaveSubcategory = async (payload) => {
        setSavingSub(true)
        try {
            if (editingSubcategory?.id) {
                await updateSubcategory(editingSubcategory.id, payload)
                flashNotice('Intent diperbarui')
            } else {
                await createSubcategory(payload)
                flashNotice('Intent ditambahkan')
            }
            setModals(m => ({ ...m, subcategory: false }))
        } finally { setSavingSub(false) }
    }

    // --- Handlers: Templates ---
    const handleAddTemplate = () => {
        setEditingTemplate({
            category: filter.category || taxonomy.categories.find(c => c.is_active)?.key || '',
            sub_category: filter.sub_category !== '__all__' ? filter.sub_category : ''
        })
        setModals(m => ({ ...m, template: true }))
    }

    const handleSaveTemplate = async (payload) => {
        setSavingTpl(true)
        try {
            await saveTemplate(editingTemplate?.id, payload)
            flashNotice(editingTemplate?.id ? 'Template diperbarui' : 'Template ditambahkan')
            setModals(m => ({ ...m, template: true })) // keep true briefly to unmount smooth
            setModals(m => ({ ...m, template: false }))
        } finally { setSavingTpl(false) }
    }

    // --- Handlers: Confirmations & Toggles ---
    const confirmAction = async () => {
        if (!modals.confirm) return
        setConfirmDeleting(true)
        const { type, id, entity } = modals.confirm
        try {
            if (type === 'template') await deleteTemplate(id)
            else if (type === 'category') await deleteCategory(id)
            else if (type === 'subcategory') await deleteSubcategory(id)
            else if (type === 'template-deactivate') await toggleTemplate(entity.id, false)
            else if (type === 'category-deactivate') await toggleCategory(entity.id, false)
            else if (type === 'subcategory-deactivate') await toggleSubcategory(entity.id, false)

            flashNotice('Aksi berhasil dilakukan')
            setModals(m => ({ ...m, confirm: null }))
        } catch (err) {
            setError(err.message || 'Gagal melakukan aksi')
        } finally { setConfirmDeleting(false) }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
            {/* Header / Notice Bar */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                    Manajemen Template AI (Intent Classification)
                </h2>
                <p style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                    Kelola daftar respons chatbot berdasarkan pemahaman intent LLM.
                </p>
                {error && <div style={{ background: 'var(--error-50)', color: 'var(--error-700)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-3)' }}>{error}</div>}
                {notice && <div style={{ background: 'var(--success-50)', color: 'var(--success-700)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-3)' }}>{notice}</div>}
            </div>

            {/* Split Pane Layout */}
            <div className="card" style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: 0 }}>
                {taxonomyLoading && taxonomy.categories.length === 0 ? (
                    <div style={{ padding: '2rem', flex: 1, textAlign: 'center', color: 'var(--gray-500)' }}>Memuat taksonomi...</div>
                ) : (
                    <>
                        <div style={{ width: '320px', flexShrink: 0 }}>
                            <TaxonomySidebar
                                taxonomy={taxonomy}
                                filter={filter}
                                setFilter={setFilter}
                                onAddCategory={() => { setEditingCategory(null); setModals(m => ({ ...m, category: true })) }}
                                onEditCategory={(cat) => { setEditingCategory(cat); setModals(m => ({ ...m, category: true })) }}
                                onToggleCategory={async (cat) => {
                                    if (cat.is_active) {
                                        setModals(m => ({ ...m, confirm: { type: 'category-deactivate', entity: cat, title: 'Nonaktifkan Kategori', description: `Kategori "${cat.label}" dan semua intent di dalamnya akan diabaikan oleh bot.` } }))
                                    } else {
                                        await toggleCategory(cat.id, true)
                                        flashNotice(`Kategori "${cat.label}" diaktifkan`)
                                    }
                                }}
                                onDeleteCategory={(cat) => setModals(m => ({ ...m, confirm: { type: 'category', id: cat.id, title: 'Hapus Kategori', description: `Kategori "${cat.label}" dan semua intent di dalamnya akan dihapus permanen.`, isDanger: true } }))}
                                onAddSubcategory={(catKey) => { setEditingSubcategory({ category_key: catKey }); setModals(m => ({ ...m, subcategory: true })) }}
                                onEditSubcategory={(sub) => { setEditingSubcategory(sub); setModals(m => ({ ...m, subcategory: true })) }}
                                onToggleSubcategory={async (sub) => {
                                    if (sub.is_active) {
                                        setModals(m => ({ ...m, confirm: { type: 'subcategory-deactivate', entity: sub, title: 'Nonaktifkan Intent', description: `Intent "${sub.label}" akan diabaikan oleh bot.` } }))
                                    } else {
                                        await toggleSubcategory(sub.id, true)
                                        flashNotice(`Intent "${sub.label}" diaktifkan`)
                                    }
                                }}
                                onDeleteSubcategory={(sub) => setModals(m => ({ ...m, confirm: { type: 'subcategory', id: sub.id, title: 'Hapus Intent', description: `Intent "${sub.label}" akan dihapus permanen.`, isDanger: true } }))}
                            />
                        </div>
                        <div style={{ flex: 1, display: 'flex', minWidth: 0, borderLeft: '1px solid var(--gray-200)' }}>
                            <TemplateWorkspace
                                templates={templates}
                                loading={templatesLoading}
                                filter={filter}
                                actionLoading={tplActionLoading}
                                onAddTemplate={handleAddTemplate}
                                onEditTemplate={(t) => { setEditingTemplate(t); setModals(m => ({ ...m, template: true })) }}
                                onToggleTemplate={async (t) => {
                                    if (t.is_active) {
                                        setModals(m => ({ ...m, confirm: { type: 'template-deactivate', entity: t, title: 'Nonaktifkan Template', description: 'Template ini akan diabaikan oleh bot.' } }))
                                    } else {
                                        await toggleTemplate(t.id, true)
                                        flashNotice('Template diaktifkan')
                                    }
                                }}
                                onDeleteTemplate={(t) => setModals(m => ({ ...m, confirm: { type: 'template', id: t.id, title: 'Hapus Template', description: 'Template ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.', isDanger: true } }))}
                            />
                        </div>
                    </>
                )}
            </div>

            {/* Modals */}
            <CategoryModal
                isOpen={modals.category}
                onClose={() => setModals(m => ({ ...m, category: false }))}
                onSave={handleSaveCategory}
                initialData={editingCategory}
                isEdit={!!editingCategory?.id}
                loading={savingCat}
            />

            <SubcategoryModal
                isOpen={modals.subcategory}
                onClose={() => setModals(m => ({ ...m, subcategory: false }))}
                onSave={handleSaveSubcategory}
                initialData={editingSubcategory}
                categories={taxonomy.categories}
                isEdit={!!editingSubcategory?.id}
                loading={savingSub}
            />

            <TemplateEditorModal
                isOpen={modals.template}
                onClose={() => setModals(m => ({ ...m, template: false }))}
                onSave={handleSaveTemplate}
                initialData={editingTemplate}
                loading={savingTpl}
                taxonomy={taxonomy}
            />

            {modals.confirm && (
                <ConfirmModal
                    open={true}
                    title={modals.confirm.title}
                    description={modals.confirm.description}
                    confirmLabel={modals.confirm.isDanger ? 'Ya, Hapus' : 'Ya, Lanjutkan'}
                    danger={modals.confirm.isDanger}
                    onConfirm={confirmAction}
                    onCancel={() => setModals(m => ({ ...m, confirm: null }))}
                    loading={confirmDeleting}
                />
            )}
        </div>
    )
}
