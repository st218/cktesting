import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'

export default function DealForm() {
    const { id } = useParams()
    const isEdit = !!id
    const navigate = useNavigate()
    const { user } = useAuth()
    const toast = useToast()

    const [sources, setSources] = useState([])
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(isEdit)

    const [form, setForm] = useState({
        commodity_type: '',
        source_name: '',
        deal_text: '',
        price_type: 'lme_discount',
        price: '',
        price_currency: 'USD',
        gross_discount: '',
        commission: '',
        net_discount: '',
        quantity: '',
        quantity_unit: 'kg',
        origin_country: '',
        shipping_terms: '',
        payment_method: '',
        date_received: new Date().toISOString().split('T')[0],
        status: 'unassigned',
        additional_notes: '',
    })

    useEffect(() => { loadSources() }, [])
    useEffect(() => { if (isEdit) loadDeal() }, [id])

    async function loadSources() {
        const { data } = await supabase.from('sources').select('*').order('name')
        setSources(data || [])
    }

    async function loadDeal() {
        const { data, error } = await supabase
            .from('deals')
            .select('*')
            .eq('id', id)
            .single()

        if (error || !data) {
            toast.error('Deal not found')
            navigate('/')
            return
        }

        setForm({
            commodity_type: data.commodity_type || '',
            source_name: data.source_name || '',
            deal_text: data.deal_text || '',
            price_type: data.price_type || 'fixed_price',
            price: data.price ?? '',
            price_currency: data.price_currency || 'USD',
            gross_discount: data.gross_discount ?? '',
            commission: data.commission ?? '',
            net_discount: data.net_discount ?? '',
            quantity: data.quantity ?? '',
            quantity_unit: data.quantity_unit || 'kg',
            origin_country: data.origin_country || '',
            shipping_terms: data.shipping_terms || '',
            payment_method: data.payment_method || '',
            date_received: data.date_received || '',
            status: data.status || 'unassigned',
            additional_notes: data.additional_notes || '',
        })
        setFetching(false)
    }

    function handleChange(e) {
        const { name, value } = e.target
        setForm(prev => {
            const next = { ...prev, [name]: value }
            // Auto-calc net discount
            if (name === 'gross_discount' || name === 'commission') {
                const gross = parseFloat(name === 'gross_discount' ? value : prev.gross_discount) || 0
                const comm = parseFloat(name === 'commission' ? value : prev.commission) || 0
                next.net_discount = (gross - comm).toFixed(1)
            }
            return next
        })
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setLoading(true)

        // Find source to link
        const source = sources.find(s => s.name === form.source_name)

        const payload = {
            commodity_type: form.commodity_type,
            source_name: form.source_name,
            source_id: source?.id || null,
            source_reliability: source?.reliability_rating || null,
            deal_text: form.deal_text || null,
            price_type: form.price_type,
            price: form.price_type === 'fixed_price' ? (parseFloat(form.price) || null) : null,
            price_currency: form.price_currency,
            gross_discount: form.price_type === 'lme_discount' ? (parseFloat(form.gross_discount) || null) : null,
            commission: form.price_type === 'lme_discount' ? (parseFloat(form.commission) || null) : null,
            net_discount: form.price_type === 'lme_discount' ? (parseFloat(form.net_discount) || null) : null,
            quantity: parseFloat(form.quantity) || null,
            quantity_unit: form.quantity_unit,
            origin_country: form.origin_country || null,
            shipping_terms: form.shipping_terms || null,
            payment_method: form.payment_method || null,
            date_received: form.date_received,
            status: form.status,
            additional_notes: form.additional_notes || null,
        }

        try {
            if (isEdit) {
                const { error } = await supabase.from('deals').update(payload).eq('id', id)
                if (error) throw error
                toast.success('Deal updated successfully!')
                navigate(`/deals/${id}`)
            } else {
                payload.created_by = user.id
                const { data, error } = await supabase.from('deals').insert(payload).select().single()
                if (error) throw error
                toast.success('Deal created successfully!')
                navigate(`/deals/${data.id}`)
            }
        } catch (err) {
            toast.error(err.message || 'Failed to save deal')
        } finally {
            setLoading(false)
        }
    }

    if (fetching) {
        return <div className="loading-spinner"><div className="spinner" /></div>
    }

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>{isEdit ? 'Edit Deal' : '➕ Add New Deal'}</h1>
                    <p className="subtitle">{isEdit ? 'Update deal information' : 'Enter deal information manually'}</p>
                </div>
            </div>

            <div className="card">
                <div className="card-body">
                    <form onSubmit={handleSubmit}>
                        {/* Basic Info */}
                        <div className="form-section">
                            <div className="form-section-title">📦 Basic Information</div>

                            <div className="form-group">
                                <label>Commodity Type <span className="required">*</span></label>
                                <input
                                    className="form-control"
                                    name="commodity_type"
                                    value={form.commodity_type}
                                    onChange={handleChange}
                                    placeholder="e.g., Gold, Copper Cathodes, Aluminum Ingots"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Source/Contact <span className="required">*</span></label>
                                <select
                                    className="form-control"
                                    name="source_name"
                                    value={form.source_name}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">-- Select Source --</option>
                                    {sources.map(s => (
                                        <option key={s.id} value={s.name}>
                                            {s.name} ({s.reliability_rating}/10)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Deal Details</label>
                                <textarea
                                    className="form-control"
                                    name="deal_text"
                                    value={form.deal_text}
                                    onChange={handleChange}
                                    placeholder="Paste raw deal message from WhatsApp/WeChat here..."
                                />
                            </div>
                        </div>

                        {/* Pricing */}
                        <div className="form-section">
                            <div className="form-section-title">💰 Pricing</div>

                            <div className="form-group">
                                <label>Price Type</label>
                                <select className="form-control" name="price_type" value={form.price_type} onChange={handleChange}>
                                    <option value="lme_discount">LME Discount (for metals)</option>
                                    <option value="fixed_price">Fixed Price</option>
                                </select>
                            </div>

                            {form.price_type === 'lme_discount' ? (
                                <>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Gross Discount (%)</label>
                                            <input className="form-control" type="number" step="0.1" name="gross_discount" value={form.gross_discount} onChange={handleChange} placeholder="-12.0" />
                                        </div>
                                        <div className="form-group">
                                            <label>Commission (%)</label>
                                            <input className="form-control" type="number" step="0.1" name="commission" value={form.commission} onChange={handleChange} placeholder="3.0" />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Net Discount (%)</label>
                                        <input className="form-control" type="number" step="0.1" name="net_discount" value={form.net_discount} readOnly style={{ background: 'var(--gray-50)' }} />
                                        <div className="form-help">Auto-calculated: Gross − Commission</div>
                                    </div>
                                </>
                            ) : (
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Price</label>
                                        <input className="form-control" type="number" step="0.01" name="price" value={form.price} onChange={handleChange} placeholder="1970.00" />
                                    </div>
                                    <div className="form-group">
                                        <label>Currency</label>
                                        <select className="form-control" name="price_currency" value={form.price_currency} onChange={handleChange}>
                                            <option value="USD">USD</option>
                                            <option value="CNY">CNY</option>
                                            <option value="EUR">EUR</option>
                                            <option value="GBP">GBP</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Quantity & Origin */}
                        <div className="form-section">
                            <div className="form-section-title">🌍 Logistics</div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Quantity</label>
                                    <input className="form-control" type="number" step="0.01" name="quantity" value={form.quantity} onChange={handleChange} placeholder="500" />
                                </div>
                                <div className="form-group">
                                    <label>Unit</label>
                                    <select className="form-control" name="quantity_unit" value={form.quantity_unit} onChange={handleChange}>
                                        <option value="kg">kg (kilograms)</option>
                                        <option value="MT">MT (metric tons)</option>
                                        <option value="tons">tons</option>
                                        <option value="oz">oz (ounces)</option>
                                        <option value="lbs">lbs (pounds)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Origin Country</label>
                                    <input className="form-control" name="origin_country" value={form.origin_country} onChange={handleChange} placeholder="e.g., Ghana, China, Russia" />
                                </div>
                                <div className="form-group">
                                    <label>Shipping Terms</label>
                                    <input className="form-control" name="shipping_terms" value={form.shipping_terms} onChange={handleChange} placeholder="e.g., CIF, FOB, DDP" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Payment Method</label>
                                <select className="form-control" name="payment_method" value={form.payment_method} onChange={handleChange}>
                                    <option value="">-- Select --</option>
                                    <option value="SBLC">SBLC (Standby Letter of Credit)</option>
                                    <option value="LC">LC (Letter of Credit)</option>
                                    <option value="DLC">DLC (Documentary Letter of Credit)</option>
                                    <option value="BCL">BCL (Bank Comfort Letter)</option>
                                    <option value="Wire Transfer">Wire Transfer</option>
                                    <option value="T/T">T/T (Telegraphic Transfer)</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>

                        {/* Date & Status */}
                        <div className="form-section">
                            <div className="form-section-title">📅 Status</div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Date Received <span className="required">*</span></label>
                                    <input className="form-control" type="date" name="date_received" value={form.date_received} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Status</label>
                                    <select className="form-control" name="status" value={form.status} onChange={handleChange}>
                                        <option value="unassigned">Unassigned</option>
                                        <option value="under_review">Under Review</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="on_hold">On Hold</option>
                                        <option value="done">Done</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Additional Notes</label>
                                <textarea className="form-control" name="additional_notes" value={form.additional_notes} onChange={handleChange} placeholder="Any other important information..." />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                                {loading ? 'Saving...' : (isEdit ? '💾 Update Deal' : '💾 Save Deal')}
                            </button>
                            <button type="button" className="btn btn-secondary btn-lg" onClick={() => navigate(-1)}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    )
}
