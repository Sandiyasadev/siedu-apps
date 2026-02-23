import { Building2, Clock3, FileText, ListTree } from 'lucide-react'

function StatsCards({
    loading,
    workspaces,
    totalUsers,
    totalBots,
    taxonomyPresets,
    templatePresets,
    applyLogs,
}) {
    return (
        <div className="stats-grid mb-6">
            <div className="stat-card">
                <div className="stat-icon primary"><Building2 size={22} /></div>
                <div className="stat-content">
                    <h3>Workspace</h3>
                    <div className="stat-value">{loading ? '—' : workspaces.length}</div>
                    <p className="text-xs text-muted">{totalUsers} user • {totalBots} bot</p>
                </div>
            </div>
            <div className="stat-card">
                <div className="stat-icon green"><ListTree size={22} /></div>
                <div className="stat-content">
                    <h3>Taxonomy Preset</h3>
                    <div className="stat-value">{loading ? '—' : taxonomyPresets.length}</div>
                    <p className="text-xs text-muted">
                        {(taxonomyPresets || []).filter((p) => p.status === 'published').length} published
                    </p>
                </div>
            </div>
            <div className="stat-card">
                <div className="stat-icon blue"><FileText size={22} /></div>
                <div className="stat-content">
                    <h3>Template Preset</h3>
                    <div className="stat-value">{loading ? '—' : templatePresets.length}</div>
                    <p className="text-xs text-muted">
                        {(templatePresets || []).reduce((sum, p) => sum + (p.items_count || 0), 0)} item preset
                    </p>
                </div>
            </div>
            <div className="stat-card">
                <div className="stat-icon yellow"><Clock3 size={22} /></div>
                <div className="stat-content">
                    <h3>Log Apply Terbaru</h3>
                    <div className="stat-value">{loading ? '—' : applyLogs.length}</div>
                    <p className="text-xs text-muted">20 event terakhir</p>
                </div>
            </div>
        </div>
    )
}

export default StatsCards
