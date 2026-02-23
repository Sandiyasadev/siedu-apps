function ApplyLogsPanel({ applyLogs, formatDateTime }) {
    return (
        <div className="card">
            <div className="card-header">
                <h2 className="card-title">Riwayat Apply Preset (Terbaru)</h2>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Waktu</th>
                                <th>Scope</th>
                                <th>Mode</th>
                                <th>Workspace</th>
                                <th>Bot</th>
                            </tr>
                        </thead>
                        <tbody>
                            {applyLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-sm text-muted">Belum ada log apply preset</td>
                                </tr>
                            ) : applyLogs.map((log) => (
                                <tr key={log.id}>
                                    <td className="text-sm text-muted">{formatDateTime(log.created_at)}</td>
                                    <td><span className="badge badge-info">{log.action_scope}</span></td>
                                    <td className="text-sm">{log.mode}</td>
                                    <td className="text-xs text-muted">{log.workspace_id || '—'}</td>
                                    <td className="text-xs text-muted">{log.bot_id || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default ApplyLogsPanel
