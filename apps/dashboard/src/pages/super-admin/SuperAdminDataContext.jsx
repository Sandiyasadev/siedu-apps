import { createContext, useContext } from 'react'
import { useAuth } from '../../App'
import useSuperAdminCore from './hooks/useSuperAdminCore'
import useTaxonomyPresetEditor from './hooks/useTaxonomyPresetEditor'
import useTemplatePresetEditor from './hooks/useTemplatePresetEditor'

const SuperAdminDataContext = createContext(null)

function SuperAdminDataProvider({ children }) {
    const { getToken } = useAuth()

    const core = useSuperAdminCore({ getToken })

    const taxonomyEditor = useTaxonomyPresetEditor({
        getToken,
        fetchAll: core.fetchAll,
        setError: core.setError,
        setActionNotice: core.setActionNotice,
        setDetailLoading: core.setDetailLoading,
        setTaxonomyDetail: core.setTaxonomyDetail,
        taxonomySubcategoryForm: core.taxonomySubcategoryForm,
        setTaxonomySubcategoryForm: core.setTaxonomySubcategoryForm,
        setEditingPresetCategoryId: core.setEditingPresetCategoryId,
        setTaxonomyCategoryForm: core.setTaxonomyCategoryForm,
        taxonomyDetail: core.taxonomyDetail,
        setEditingPresetSubcategoryId: core.setEditingPresetSubcategoryId,
        setTaxonomyEditorSaving: core.setTaxonomyEditorSaving,
        editingPresetCategoryId: core.editingPresetCategoryId,
        editingPresetSubcategoryId: core.editingPresetSubcategoryId,
        taxonomyCategoryForm: core.taxonomyCategoryForm,
    })

    const templateEditor = useTemplatePresetEditor({
        getToken,
        fetchAll: core.fetchAll,
        setError: core.setError,
        setActionNotice: core.setActionNotice,
        setDetailLoading: core.setDetailLoading,
        setTemplateDetail: core.setTemplateDetail,
        setTemplatePresetForm: core.setTemplatePresetForm,
        editingTemplatePresetItemId: core.editingTemplatePresetItemId,
        templatePresetItemForm: core.templatePresetItemForm,
        setTemplatePresetItemForm: core.setTemplatePresetItemForm,
        templateDetail: core.templateDetail,
        templatePresetForm: core.templatePresetForm,
        setTemplatePresetSaving: core.setTemplatePresetSaving,
        setTemplateImportForm: core.setTemplateImportForm,
        templateImportForm: core.templateImportForm,
        setTemplateImportLoading: core.setTemplateImportLoading,
        setLastTemplateImportSummary: core.setLastTemplateImportSummary,
        setEditingTemplatePresetItemId: core.setEditingTemplatePresetItemId,
        setTemplateEditorSaving: core.setTemplateEditorSaving,
    })

    const value = {
        ...core,
        ...taxonomyEditor,
        ...templateEditor,
    }

    return (
        <SuperAdminDataContext.Provider value={value}>
            {children}
        </SuperAdminDataContext.Provider>
    )
}

function useSuperAdminData() {
    const context = useContext(SuperAdminDataContext)
    if (!context) {
        throw new Error('useSuperAdminData must be used within SuperAdminDataProvider')
    }
    return context
}

export { SuperAdminDataProvider, useSuperAdminData }
