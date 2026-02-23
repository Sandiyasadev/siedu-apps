import { Building2, ExternalLink } from 'lucide-react'

function WorkspacesPanel({ loading, workspaces, formatDateTime, onOpenWorkspaceDashboard }) {
    return (
        <div className="card">
            <div className="card-header">
                <h2 className="card-title">Daftar Workspace</h2>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
                {loading ? (
                    <div style={{ padding: 'var(--space-4)' }}><div className="spinner" /></div>
                ) : workspaces.length === 0 ? (
                    <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                        <div className="empty-state-icon"><Building2 size={24} /></div>
                        <p className="text-sm text-muted">Belum ada workspace</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Nama</th>
                                    <th>Slug</th>
                                    <th>User</th>
                                    <th>Bot</th>
                                    <th>Dibuat</th>
                                    <th style={{ width: 1 }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {workspaces.map((w) => (
                                    <tr key={w.id}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{w.name}</div>
                                            <div className="text-xs text-muted">{w.id}</div>
                                        </td>
                                        <td className="text-sm">{w.slug || '—'}</td>
                                        <td>{w.user_count || 0}</td>
                                        <td>{w.bot_count || 0}</td>
                                        <td className="text-sm text-muted">{formatDateTime(w.created_at)}</td>
                                        <td>
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => onOpenWorkspaceDashboard?.(w)}
                                                title={`Buka dashboard workspace: ${w.name || w.id}`}
                                                style={{ whiteSpace: 'nowrap' }}
                                            >
                                                <ExternalLink size={14} />
                                                Buka Dashboard Workspace
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

export default WorkspacesPanel
