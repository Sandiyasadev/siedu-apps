import { Link, useOutletContext } from 'react-router-dom'
import { Database, ArrowRight } from 'lucide-react'

function BotKnowledge() {
    const { bot } = useOutletContext()

    return (
        <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                Knowledge Base
            </h2>

            <div className="card">
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <Database size={32} />
                    </div>
                    <h3>Knowledge Base Management</h3>
                    <p>
                        Manage knowledge base files for <strong>{bot?.name}</strong> from the main Knowledge Base page.
                    </p>
                    <Link to="/knowledge-base" className="btn btn-primary">
                        Go to Knowledge Base
                        <ArrowRight size={16} />
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default BotKnowledge
