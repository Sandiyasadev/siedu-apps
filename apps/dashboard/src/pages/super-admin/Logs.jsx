import { useSuperAdminData } from './SuperAdminDataContext'
import {
    RefreshCw, AlertCircle
} from 'lucide-react'
import ApplyLogsPanel from './panels/ApplyLogsPanel'

function SuperAdminLogs() {
    const {
        refreshing, error, applyLogs, fetchAll
    } = useSuperAdminData()

    const formatDateTime = (value) => {
        if (!value) return '—'
        try { return new Date(value).toLocaleString() } catch { return value }
    }

    return (
        <div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">Log Apply Preset</h1>
                    <p className="page-subtitle">Riwayat apply preset terbaru untuk audit operasional dan troubleshooting.</p>
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

            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                <ApplyLogsPanel
                    applyLogs={applyLogs}
                    formatDateTime={formatDateTime}
                />
            </div>
        </div>
    )
}

export default SuperAdminLogs
