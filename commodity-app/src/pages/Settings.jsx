import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../components/Toast'

export default function Settings() {
    const [settings, setSettings] = useState([])
    const [sources, setSources] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [editValues, setEditValues] = useState({})
    const [activeTab, setActiveTab] = useState('ai')
    const [newSource, setNewSource] = useState({ name: '', reliability_rating: 5 })
    const [editingSourceId, setEditingSourceId] = useState(null)

    useEffect(() => {
        loadSettings()
        loadSources()
    }, [])

    async function loadSettings() {
        const { data, error } = await supabase.from('app_settings').select('*')
        if (error) {
            console.error('Error loading settings:', error)
        } else {
            setSettings(data || [])
            const vals = {}
                ; (data || []).forEach(s => { vals[s.key] = s.value })
            setEditValues(vals)
        }
        setLoading(false)
    }

    async function loadSources() {
        const { data } = await supabase.from('sources').select('*').order('name')
        setSources(data || [])
    }

    async function saveSettings() {
        setSaving(true)
        try {
            for (const setting of settings) {
                if (editValues[setting.key] !== setting.value) {
                    const { error } = await supabase
                        .from('app_settings')
                        .update({ value: editValues[setting.key], updated_at: new Date().toISOString() })
                        .eq('key', setting.key)
                    if (error) throw error
                }
            }
            toast.success('Settings saved successfully!')
            loadSettings()
        } catch (err) {
            toast.error(err.message || 'Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    async function addSource() {
        if (!newSource.name.trim()) return
        const { error } = await supabase.from('sources').insert({
            name: newSource.name.trim(),
            reliability_rating: parseFloat(newSource.reliability_rating) || 5,
        })
        if (error) {
            toast.error(error.message)
        } else {
            toast.success('Source added!')
            setNewSource({ name: '', reliability_rating: 5 })
            loadSources()
        }
    }

    async function updateSource(sourceId, updates) {
        const { error } = await supabase.from('sources').update(updates).eq('id', sourceId)
        if (error) {
            toast.error(error.message)
        } else {
            toast.success('Source updated!')
            setEditingSourceId(null)
            loadSources()
        }
    }

    async function deleteSource(sourceId) {
        if (!window.confirm('Delete this source?')) return
        const { error } = await supabase.from('sources').delete().eq('id', sourceId)
        if (error) {
            toast.error(error.message)
        } else {
            toast.success('Source deleted')
            loadSources()
        }
    }

    const toast = useToast()

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>

    const aiSettings = [
        { key: 'anthropic_api_key', label: 'Anthropic API Key', desc: 'Required for AI deal scoring', secret: true },
        {
            key: 'ai_model', label: 'AI Model', desc: 'Claude model to use for analysis', options: [
                { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5 (Recommended)' },
                { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
                { value: 'claude-haiku-4-20250414', label: 'Claude Haiku 4 (Faster, cheaper)' },
            ]
        },
        { key: 'ai_temperature', label: 'Temperature', desc: 'Controls randomness (0.0 = precise, 1.0 = creative)', type: 'range', min: 0, max: 1, step: 0.1 },
        { key: 'ai_max_tokens', label: 'Max Output Tokens', desc: 'Maximum length of AI response', type: 'number' },
    ]

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>⚙️ Settings</h1>
                    <p className="subtitle">Admin configuration panel</p>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
                <button
                    className={`btn ${activeTab === 'ai' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('ai')}
                >🤖 AI Configuration</button>
                <button
                    className={`btn ${activeTab === 'sources' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('sources')}
                >🏢 Sources</button>
            </div>

            {/* AI Configuration Tab */}
            {activeTab === 'ai' && (
                <div className="card">
                    <div className="card-header">
                        <h3>🤖 AI & Scoring Configuration</h3>
                        <button className="btn btn-primary btn-sm" onClick={saveSettings} disabled={saving}>
                            {saving ? 'Saving...' : '💾 Save Changes'}
                        </button>
                    </div>
                    <div className="card-body">
                        {aiSettings.map(s => {
                            const val = editValues[s.key] ?? ''
                            return (
                                <div key={s.key} className="setting-item">
                                    <div className="setting-info">
                                        <label>{s.label}</label>
                                        <p>{s.desc}</p>
                                    </div>
                                    <div className="setting-control">
                                        {s.options ? (
                                            <select
                                                className="form-control"
                                                value={val}
                                                onChange={e => setEditValues(prev => ({ ...prev, [s.key]: e.target.value }))}
                                            >
                                                {s.options.map(o => (
                                                    <option key={o.value} value={o.value}>{o.label}</option>
                                                ))}
                                            </select>
                                        ) : s.type === 'range' ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <input
                                                    type="range"
                                                    min={s.min}
                                                    max={s.max}
                                                    step={s.step}
                                                    value={val}
                                                    onChange={e => setEditValues(prev => ({ ...prev, [s.key]: e.target.value }))}
                                                    style={{ flex: 1 }}
                                                />
                                                <span style={{ fontWeight: 600, color: 'var(--gray-700)', minWidth: '32px' }}>{val}</span>
                                            </div>
                                        ) : (
                                            <input
                                                className="form-control"
                                                type={s.secret ? 'password' : s.type || 'text'}
                                                value={val}
                                                onChange={e => setEditValues(prev => ({ ...prev, [s.key]: e.target.value }))}
                                                placeholder={s.secret ? '••••••••••••••••' : ''}
                                            />
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Sources Tab */}
            {activeTab === 'sources' && (
                <div className="card">
                    <div className="card-header">
                        <h3>🏢 Source Management</h3>
                    </div>
                    <div className="card-body">
                        {/* Add Source Form */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', padding: '16px', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
                            <input
                                className="form-control"
                                placeholder="Source name..."
                                value={newSource.name}
                                onChange={e => setNewSource(prev => ({ ...prev, name: e.target.value }))}
                                style={{ flex: 1 }}
                            />
                            <input
                                className="form-control"
                                type="number"
                                min="0"
                                max="10"
                                step="0.1"
                                placeholder="Rating"
                                value={newSource.reliability_rating}
                                onChange={e => setNewSource(prev => ({ ...prev, reliability_rating: e.target.value }))}
                                style={{ width: '100px' }}
                            />
                            <button className="btn btn-primary btn-sm" onClick={addSource}>+ Add</button>
                        </div>

                        {/* Sources Table */}
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Source Name</th>
                                    <th>Reliability</th>
                                    <th>Total Deals</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sources.map(source => (
                                    <tr key={source.id}>
                                        <td>
                                            {editingSourceId === source.id ? (
                                                <input className="form-control" defaultValue={source.name}
                                                    id={`edit-name-${source.id}`} style={{ padding: '6px 10px' }}
                                                />
                                            ) : (
                                                <strong>{source.name}</strong>
                                            )}
                                        </td>
                                        <td>
                                            {editingSourceId === source.id ? (
                                                <input className="form-control" type="number" min="0" max="10" step="0.1"
                                                    defaultValue={source.reliability_rating}
                                                    id={`edit-rating-${source.id}`} style={{ width: '80px', padding: '6px 10px' }}
                                                />
                                            ) : (
                                                <span style={{ fontWeight: 600, color: source.reliability_rating >= 7 ? 'var(--success-600)' : source.reliability_rating >= 4 ? 'var(--warning-600)' : 'var(--danger-600)' }}>
                                                    {source.reliability_rating}/10
                                                </span>
                                            )}
                                        </td>
                                        <td>{source.total_deals || 0}</td>
                                        <td>
                                            {editingSourceId === source.id ? (
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button className="btn btn-primary btn-sm" onClick={() => {
                                                        const name = document.getElementById(`edit-name-${source.id}`).value
                                                        const rating = parseFloat(document.getElementById(`edit-rating-${source.id}`).value)
                                                        updateSource(source.id, { name, reliability_rating: rating })
                                                    }}>Save</button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingSourceId(null)}>Cancel</button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingSourceId(source.id)}>✏️</button>
                                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger-500)' }} onClick={() => deleteSource(source.id)}>🗑</button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {sources.length === 0 && (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '32px' }}>
                                            No sources yet. Add one above.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </>
    )
}
