import { useState } from 'react'
import { useParams, useNavigate, useOutletContext } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE } from '../config/api'
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, Eye, EyeOff, ExternalLink } from 'lucide-react'
import { CHANNEL_TYPES, getChannelType } from '../config/channels'

const ACTIVE_CHANNELS = new Set(['telegram', 'whatsapp'])

const STEPS = ['Select Type', 'Configure', 'Setup Webhook']

function ChannelCreate() {
    const { botId } = useParams()
    const { bot } = useOutletContext()
    const { getToken } = useAuth()
    const navigate = useNavigate()

    const [step, setStep] = useState(0)
    const [selectedType, setSelectedType] = useState(null)
    const [name, setName] = useState('')
    const [config, setConfig] = useState({})
    const [showPasswords, setShowPasswords] = useState({})
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [createdChannel, setCreatedChannel] = useState(null)
    const [copiedId, setCopiedId] = useState(null)

    const handleSelectType = (type) => {
        setSelectedType(type)
        setName(`${CHANNEL_TYPES[type].label} - ${bot?.name || 'Bot'}`)
        setConfig({})
        setError('')
    }

    const handleConfigChange = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }))
    }

    const toggleShowPassword = (key) => {
        setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const validateStep = () => {
        if (step === 0) {
            return selectedType !== null
        }
        if (step === 1) {
            const channelType = getChannelType(selectedType)
            for (const field of channelType.configFields) {
                if (field.required && !config[field.key]) {
                    setError(`${field.label} is required`)
                    return false
                }
            }
            return true
        }
        return true
    }

    const handleNext = async () => {
        setError('')
        if (!validateStep()) return

        if (step === 1) {
            await createChannel()
        } else {
            setStep(step + 1)
        }
    }

    const handleBack = () => {
        setError('')
        if (step > 0) {
            setStep(step - 1)
        }
    }

    const createChannel = async () => {
        setSaving(true)
        setError('')
        const token = getToken()

        try {
            const res = await fetch(`${API_BASE}/v1/bots/${botId}/channels`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    channel_type: selectedType,
                    name,
                    config
                })
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Failed to create channel')
                return
            }

            setCreatedChannel(data.channel)
            setStep(2)
        } catch (err) {
            setError('Failed to create channel')
            console.error(err)
        } finally {
            setSaving(false)
        }
    }

    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const getWebhookUrl = () => {
        if (!createdChannel) return ''
        return `${API_BASE}/v1/hooks/${createdChannel.channel_type}/${createdChannel.public_id}`
    }

    const renderStepIndicator = () => (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-8)' }}>
            {STEPS.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 'var(--radius-full)',
                        background: i < step ? 'var(--success-500)' : i === step ? 'var(--primary-500)' : 'var(--gray-200)',
                        color: i <= step ? 'white' : 'var(--gray-500)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: 'var(--font-size-sm)'
                    }}>
                        {i < step ? <Check size={16} /> : i + 1}
                    </div>
                    <span style={{
                        marginLeft: 'var(--space-2)',
                        marginRight: 'var(--space-4)',
                        color: i <= step ? 'var(--gray-900)' : 'var(--gray-400)',
                        fontWeight: i === step ? 600 : 400,
                        fontSize: 'var(--font-size-sm)'
                    }}>
                        {s}
                    </span>
                    {i < STEPS.length - 1 && (
                        <div style={{
                            width: 40,
                            height: 2,
                            background: i < step ? 'var(--success-500)' : 'var(--gray-200)',
                            marginRight: 'var(--space-4)'
                        }} />
                    )}
                </div>
            ))}
        </div>
    )

    const renderTypeSelection = () => (
        <div>
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, marginBottom: 'var(--space-2)', textAlign: 'center' }}>
                Select Channel Type
            </h2>
            <p style={{ color: 'var(--gray-500)', textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                Choose the messaging platform you want to connect
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                {Object.entries(CHANNEL_TYPES).map(([key, type]) => {
                    const Icon = type.icon
                    const isAllowed = ACTIVE_CHANNELS.has(key)
                    const isSelected = selectedType === key

                    return (
                        <div
                            key={key}
                            onClick={() => isAllowed && handleSelectType(key)}
                            style={{
                                padding: 'var(--space-4)',
                                border: `2px solid ${isSelected ? type.color : 'var(--gray-200)'}`,
                                borderRadius: 'var(--radius-lg)',
                                cursor: isAllowed ? 'pointer' : 'default',
                                background: isSelected ? `${type.color}10` : 'white',
                                transition: 'all 0.15s ease',
                                opacity: isAllowed ? 1 : 0.5,
                                pointerEvents: isAllowed ? 'auto' : 'none',
                                position: 'relative'
                            }}
                        >
                            {!isAllowed && (
                                <div style={{
                                    position: 'absolute',
                                    top: 10,
                                    right: 10,
                                    background: 'var(--gray-100)',
                                    color: 'var(--gray-500)',
                                    fontSize: '10px',
                                    padding: '2px 6px',
                                    borderRadius: 'var(--radius-full)',
                                    fontWeight: 600,
                                    textTransform: 'uppercase'
                                }}>
                                    Soon
                                </div>
                            )}
                            <div style={{
                                width: 48,
                                height: 48,
                                background: type.color,
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                marginBottom: 'var(--space-3)'
                            }}>
                                <Icon size={24} />
                            </div>
                            <h3 style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>{type.label}</h3>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--gray-500)' }}>
                                {type.description}
                            </p>
                        </div>
                    )
                })}
            </div>
        </div>
    )

    const renderConfiguration = () => {
        const channelType = getChannelType(selectedType)
        const Icon = channelType.icon

        return (
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                    <div style={{
                        width: 48,
                        height: 48,
                        background: channelType.color,
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                    }}>
                        <Icon size={24} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>
                            Configure {channelType.label}
                        </h2>
                        <p style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)' }}>
                            Enter your credentials to connect
                        </p>
                    </div>
                </div>

                <div style={{ maxWidth: 500 }}>
                    {/* Channel Name */}
                    <div className="form-group">
                        <label className="form-label">Channel Name</label>
                        <input
                            type="text"
                            className="form-input"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="My Channel"
                        />
                    </div>

                    {/* Dynamic Config Fields */}
                    {channelType.configFields.map(field => (
                        <div key={field.key} className="form-group">
                            <label className="form-label">
                                {field.label}
                                {field.required && <span style={{ color: 'var(--error-500)' }}> *</span>}
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={field.type === 'password' && !showPasswords[field.key] ? 'password' : 'text'}
                                    className="form-input"
                                    value={config[field.key] || ''}
                                    onChange={e => handleConfigChange(field.key, e.target.value)}
                                    placeholder={field.placeholder}
                                    style={{ paddingRight: field.type === 'password' ? 40 : undefined }}
                                />
                                {field.type === 'password' && (
                                    <button
                                        type="button"
                                        onClick={() => toggleShowPassword(field.key)}
                                        style={{
                                            position: 'absolute',
                                            right: 8,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: 'var(--gray-400)'
                                        }}
                                    >
                                        {showPasswords[field.key] ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                )}
                            </div>
                            {field.helpText && (
                                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--gray-500)', marginTop: 'var(--space-1)' }}>
                                    {field.helpText}
                                </p>
                            )}
                        </div>
                    ))}

                    {/* Setup Instructions */}
                    {channelType.setupInstructions && (
                        <div style={{
                            background: 'var(--gray-50)',
                            padding: 'var(--space-4)',
                            borderRadius: 'var(--radius-md)',
                            marginTop: 'var(--space-4)'
                        }}>
                            <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>Setup Instructions</h4>
                            <ol style={{ paddingLeft: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--gray-600)' }}>
                                {channelType.setupInstructions.map((instruction, i) => (
                                    <li key={i} style={{ marginBottom: 'var(--space-1)' }}>{instruction}</li>
                                ))}
                            </ol>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    const renderWebhookSetup = () => {
        const channelType = getChannelType(selectedType)
        const Icon = channelType.icon
        const webhookUrl = getWebhookUrl()

        return (
            <div>
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                    <div style={{
                        width: 64,
                        height: 64,
                        background: 'var(--success-500)',
                        borderRadius: 'var(--radius-full)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        margin: '0 auto var(--space-4)'
                    }}>
                        <Check size={32} />
                    </div>
                    <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                        Channel Created!
                    </h2>
                    <p style={{ color: 'var(--gray-500)' }}>
                        Complete the webhook setup to start receiving messages
                    </p>
                </div>

                <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
                    <div className="card-body">
                        {/* Webhook URL */}
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                            <label className="form-label">Webhook URL</label>
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={webhookUrl}
                                    readOnly
                                    style={{ flex: 1 }}
                                />
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                                >
                                    {copiedId === 'webhook' ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Secret */}
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                            <label className="form-label">Webhook Secret</label>
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={createdChannel?.secret || ''}
                                    readOnly
                                    style={{ flex: 1 }}
                                />
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => copyToClipboard(createdChannel?.secret, 'secret')}
                                >
                                    {copiedId === 'secret' ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                            </div>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--gray-500)', marginTop: 'var(--space-1)' }}>
                                Use this secret for webhook signature verification
                            </p>
                        </div>

                        {/* Platform-specific webhook command */}
                        {channelType.webhookSetup && (
                            <div style={{
                                background: 'var(--gray-900)',
                                padding: 'var(--space-4)',
                                borderRadius: 'var(--radius-md)',
                                marginTop: 'var(--space-4)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                    <span style={{ color: 'var(--gray-400)', fontSize: 'var(--font-size-sm)' }}>
                                        Register webhook command
                                    </span>
                                    <button
                                        className="btn btn-ghost"
                                        style={{ color: 'var(--gray-400)', padding: '4px 8px' }}
                                        onClick={() => copyToClipboard(
                                            channelType.webhookSetup
                                                .replace('{WEBHOOK_URL}', webhookUrl)
                                                .replace('{SECRET}', createdChannel?.secret || '')
                                                .replace('{BOT_TOKEN}', '<YOUR_BOT_TOKEN>'),
                                            'command'
                                        )}
                                    >
                                        {copiedId === 'command' ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                </div>
                                <code style={{
                                    display: 'block',
                                    color: 'var(--success-400)',
                                    fontSize: 'var(--font-size-sm)',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all'
                                }}>
                                    {channelType.webhookSetup
                                        .replace('{WEBHOOK_URL}', webhookUrl)
                                        .replace('{SECRET}', createdChannel?.secret || '')
                                        .replace('{BOT_TOKEN}', '<YOUR_BOT_TOKEN>')}
                                </code>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div>
            {/* Back Button */}
            <button
                onClick={() => navigate(`/bots/${botId}/channels`)}
                className="btn btn-ghost"
                style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-1) var(--space-2)' }}
            >
                <ArrowLeft size={16} />
                Back to Channels
            </button>

            {/* Card Container */}
            <div className="card">
                <div className="card-body" style={{ padding: 'var(--space-6)' }}>
                    {/* Step Indicator */}
                    {renderStepIndicator()}

                    {/* Error Message */}
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

                    {/* Step Content */}
                    {step === 0 && renderTypeSelection()}
                    {step === 1 && renderConfiguration()}
                    {step === 2 && renderWebhookSetup()}

                    {/* Navigation Buttons */}
                    <div style={{
                        display: 'flex',
                        justifyContent: step === 0 ? 'flex-end' : 'space-between',
                        marginTop: 'var(--space-8)',
                        paddingTop: 'var(--space-4)',
                        borderTop: '1px solid var(--gray-200)'
                    }}>
                        {step > 0 && step < 2 && (
                            <button className="btn btn-secondary" onClick={handleBack}>
                                <ArrowLeft size={16} />
                                Back
                            </button>
                        )}

                        {step < 2 ? (
                            <button
                                className="btn btn-primary"
                                onClick={handleNext}
                                disabled={step === 0 ? !selectedType : saving}
                            >
                                {saving ? (
                                    <Loader2 size={16} className="spinner" />
                                ) : step === 1 ? (
                                    'Create Channel'
                                ) : (
                                    <>
                                        Next
                                        <ArrowRight size={16} />
                                    </>
                                )}
                            </button>
                        ) : (
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate(`/bots/${botId}/channels/${createdChannel.id}`)}
                                style={{ marginLeft: 'auto' }}
                            >
                                Go to Channel Settings
                                <ArrowRight size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ChannelCreate
