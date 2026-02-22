import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'

function ConfirmModal({
    open,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    loading = false,
    danger = true,
    verificationText = '',
    verificationLabel = 'Verification',
    verificationPlaceholder,
    onConfirm,
    onCancel
}) {
    const [verificationInput, setVerificationInput] = useState('')

    useEffect(() => {
        if (!open) return

        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !loading) onCancel?.()
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [open, loading, onCancel])

    useEffect(() => {
        if (!open) {
            setVerificationInput('')
        }
    }, [open])

    if (!open) return null

    const requiresVerification = !!verificationText
    const verificationMatch = !requiresVerification || verificationInput.trim() === verificationText
    const confirmDisabled = loading || !verificationMatch

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" style={{ maxWidth: 420 }}>
                <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <div
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            background: danger ? 'var(--error-50)' : 'var(--warning-50)',
                            color: danger ? 'var(--error-500)' : 'var(--warning-600)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto var(--space-4)'
                        }}
                    >
                        <AlertTriangle size={24} />
                    </div>
                </div>

                <div className="modal-body" style={{ textAlign: 'center', paddingTop: 0 }}>
                    <h3 style={{ marginBottom: 'var(--space-2)' }}>{title}</h3>
                    <p style={{ color: 'var(--gray-600)', lineHeight: 'var(--line-height-relaxed)' }}>{description}</p>

                    {requiresVerification && (
                        <div style={{
                            marginTop: 'var(--space-4)',
                            textAlign: 'left',
                            border: '1px solid var(--warning-200)',
                            background: 'var(--warning-50)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-3)'
                        }}>
                            <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
                                {verificationLabel}
                            </label>
                            <p style={{
                                margin: 0,
                                marginBottom: 'var(--space-2)',
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--gray-600)'
                            }}>
                                Ketik <strong style={{ fontFamily: 'monospace' }}>{verificationText}</strong> untuk melanjutkan.
                            </p>
                            <input
                                autoFocus
                                className="form-input"
                                value={verificationInput}
                                onChange={(e) => setVerificationInput(e.target.value)}
                                placeholder={verificationPlaceholder || verificationText}
                            />
                        </div>
                    )}
                </div>

                <div className="modal-footer" style={{ justifyContent: 'center', gap: 'var(--space-3)' }}>
                    <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
                        {cancelLabel}
                    </button>
                    <button
                        className="btn"
                        onClick={onConfirm}
                        disabled={confirmDisabled}
                        style={{
                            background: danger ? 'var(--error-600)' : 'var(--warning-600)',
                            color: 'white'
                        }}
                    >
                        {loading ? <Loader2 size={16} className="spinner" /> : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ConfirmModal
