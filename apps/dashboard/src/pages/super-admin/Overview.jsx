import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../App'
import { useSuperAdminData } from './SuperAdminDataContext'
import {
    RefreshCw, AlertCircle, CheckCircle2
} from 'lucide-react'
import StatsCards from './panels/StatsCards'
import BootstrapDefaultPresetsPanel from './panels/BootstrapDefaultPresetsPanel'

function SuperAdminOverview() {
    const { user } = useAuth()
    const {
        loading, refreshing, error, actionNotice,
        workspaces, taxonomyPresets, templatePresets, applyLogs,
        bootstrapForm, setBootstrapForm, bootstrapLoading,
        selectedWorkspaceId, bootstrapDefaultPresets,
        lastBootstrapSummary, fetchAll
    } = useSuperAdminData()

    const totalBots = workspaces.reduce((sum, w) => sum + (w.bot_count || 0), 0)
    const totalUsers = workspaces.reduce((sum, w) => sum + (w.user_count || 0), 0)

    return (
        <div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">Ringkasan Super Admin</h1>
                    <p className="page-subtitle">Lihat kondisi platform dan bootstrap preset default dari source lokal backend.</p>
                </div>
                <button className="btn btn-secondary" onClick={() => fetchAll(true)} disabled={refreshing}>
                    <RefreshCw size={16} className={refreshing ? 'spinner' : ''} />
                    Muat Ulang
                </button>
            </header>

            {error && (
                <div className="card" style={{ marginBottom: 'var(--space-4)', borderColor: 'var(--error-200)', background: 'var(--error-50)' }}>
                    <div className="card-body" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                        <AlertCircle size={18} style={{ color: 'var(--error-600)', marginTop: 2 }} />
                        <div>
                            <div style={{ fontWeight: 600, color: 'var(--error-700)' }}>Gagal memuat data</div>
                            <div className="text-sm" style={{ color: 'var(--error-700)' }}>{error}</div>
                        </div>
                    </div>
                </div>
            )}

            {actionNotice && (
                <div className="card" style={{
                    marginBottom: 'var(--space-4)',
                    borderColor: actionNotice.type === 'success' ? 'var(--success-200)' : 'var(--warning-200)',
                    background: actionNotice.type === 'success' ? 'var(--success-50)' : 'var(--warning-50)'
                }}>
                    <div className="card-body" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            {actionNotice.type === 'success'
                                ? <CheckCircle2 size={16} style={{ color: 'var(--success-700)' }} />
                                : <AlertCircle size={16} style={{ color: 'var(--warning-700)' }} />}
                            <span className="text-sm" style={{ color: actionNotice.type === 'success' ? 'var(--success-700)' : 'var(--warning-700)' }}>
                                {actionNotice.message}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            <StatsCards
                loading={loading}
                workspaces={workspaces}
                totalUsers={totalUsers}
                totalBots={totalBots}
                taxonomyPresets={taxonomyPresets}
                templatePresets={templatePresets}
                applyLogs={applyLogs}
            />

            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                <BootstrapDefaultPresetsPanel
                    bootstrapForm={bootstrapForm}
                    setBootstrapForm={setBootstrapForm}
                    bootstrapLoading={bootstrapLoading}
                    selectedWorkspaceId={selectedWorkspaceId}
                    workspaces={workspaces}
                    bootstrapDefaultPresets={bootstrapDefaultPresets}
                    lastBootstrapSummary={lastBootstrapSummary}
                />
            </div>
        </div>
    )
}

export default SuperAdminOverview
