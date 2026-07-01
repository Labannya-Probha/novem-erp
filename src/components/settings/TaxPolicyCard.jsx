import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'

const COUNTRY_FLAG = { BD: '🇧🇩', IN: '🇮🇳', AE: '🇦🇪', SG: '🇸🇬', TH: '🇹🇭', MY: '🇲🇾', '00': '🚫' }

const CHARGE_TYPE_META = {
  ROOM:           { label: 'Room / Accommodation',  icon: '🛏️',  color: 'blue'   },
  ROOM_CORPORATE: { label: 'Corporate Room (TDS)',   icon: '🏢',  color: 'purple' },
  RESTAURANT:     { label: 'Restaurant (F&B)',       icon: '🍽️',  color: 'orange' },
  FOOD:           { label: 'Food Service',           icon: '🥘',  color: 'amber'  },
  BEVERAGE:       { label: 'Beverage',               icon: '🥤',  color: 'cyan'   },
  MINIBAR:        { label: 'Mini Bar',               icon: '🍾',  color: 'purple' },
  LAUNDRY:        { label: 'Laundry',                icon: '👕',  color: 'cyan'   },
  SPA:            { label: 'Spa & Wellness',         icon: '💆',  color: 'amber'  },
  TRANSPORT:      { label: 'Transport / Transfer',   icon: '🚗',  color: 'slate'  },
  OTHER:          { label: 'Other Services',         icon: '🔧',  color: 'slate'  },
}
const ALL_CHARGE_TYPES = Object.keys(CHARGE_TYPE_META)
const COLOR_CLASSES = {
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-800',    head: 'bg-blue-100' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-800', head: 'bg-orange-100' },
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-800',   head: 'bg-amber-100' },
  cyan:   { bg: 'bg-cyan-50',   border: 'border-cyan-200',   badge: 'bg-cyan-100 text-cyan-800',     head: 'bg-cyan-100' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-800', head: 'bg-purple-100' },
  slate:  { bg: 'bg-slate-50',  border: 'border-slate-200',  badge: 'bg-slate-100 text-slate-700',   head: 'bg-slate-100' },
}

export default function TaxPolicyCard({ tenantId, isAdmin }) {
  const [countries,       setCountries]       = useState([])
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [templateRows,    setTemplateRows]    = useState([])
  const [activeConfig,    setActiveConfig]    = useState([])
  const [editMap,         setEditMap]         = useState({})
  const [saving,          setSaving]          = useState(false)
  const [saveMsg,         setSaveMsg]         = useState('')
  const [loading,         setLoading]         = useState(true)
  const [effectiveFrom,   setEffectiveFrom]   = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    supabase.from('tax_policies').select('country_code, country_name').order('country_name')
      .then(({ data }) => {
        if (!data) return
        const seen = new Set()
        const unique = []
        for (const r of data) {
          if (!seen.has(r.country_code)) { seen.add(r.country_code); unique.push(r) }
        }
        setCountries(unique)
      })
  }, [])

  useEffect(() => {
    if (!tenantId) { setLoading(false); return }
    setLoading(true)
    supabase.from('tax_config').select('*').eq('tenant_id', tenantId)
      .order('effective_from', { ascending: false })
      .then(({ data }) => {
        setLoading(false)
        if (!data || data.length === 0) return
        const latestMap = {}
        for (const row of data) {
          if (!latestMap[row.charge_type]) latestMap[row.charge_type] = row
        }
        const latest = Object.values(latestMap)
        setActiveConfig(latest)
        const em = {}
        for (const row of latest) {
          em[row.charge_type] = {
            tax_pct:            Number(row.tax_pct ?? row.vat_pct ?? 0),
            service_charge_pct: Number(row.service_charge_pct ?? 0),
            tds_pct:            Number(row.tds_pct ?? 0),
            vds_pct:            Number(row.vds_pct ?? 0),
            sd_pct:             Number(row.sd_pct ?? 0),
            is_tax_inclusive:   row.is_tax_inclusive ?? false,
          }
        }
        setEditMap(em)
        setEffectiveFrom(latest[0]?.effective_from ?? new Date().toISOString().split('T')[0])
      })
  }, [tenantId])

  useEffect(() => {
    if (!selectedCountry) return
    supabase.from('tax_policies').select('*').eq('country_code', selectedCountry.country_code)
      .order('charge_type')
      .then(({ data }) => setTemplateRows(data || []))
  }, [selectedCountry])

  useEffect(() => {
    if (countries.length === 0 || activeConfig.length === 0) return
    const cc = activeConfig[0]?.country_code || 'BD'
    const found = countries.find(c => c.country_code === cc)
    if (found) setSelectedCountry(found)
  }, [countries, activeConfig])

  function applyTemplate() {
    const em = {}
    for (const row of templateRows) {
      em[row.charge_type] = {
        tax_pct:            Number(row.tax_pct),
        service_charge_pct: Number(row.service_charge_pct),
        tds_pct:            Number(row.tds_pct),
        vds_pct:            Number(row.vds_pct),
        sd_pct:             Number(row.sd_pct),
        is_tax_inclusive:   row.is_tax_inclusive,
      }
    }
    setEditMap(em)
    setSaveMsg('✅ Template applied — review and save to confirm.')
  }

  function handleField(chargeType, field, value) {
    setEditMap(prev => ({
      ...prev,
      [chargeType]: {
        ...prev[chargeType],
        [field]: field === 'is_tax_inclusive' ? value : Number(value),
      },
    }))
  }

  async function handleSave() {
    if (!selectedCountry) { setSaveMsg('❌ Please select a country first.'); return }
    setSaving(true); setSaveMsg('')
    try {
      for (const ct of Object.keys(editMap)) {
        const vals = editMap[ct]
        const tmpl = templateRows.find(r => r.charge_type === ct)
        const payload = {
          tenant_id:          tenantId,
          charge_type:        ct,
          country_code:       selectedCountry.country_code,
          tax_name:           tmpl?.tax_name ?? 'VAT',
          tax_pct:            vals.tax_pct,
          vat_pct:            vals.tax_pct,
          service_charge_pct: vals.service_charge_pct,
          tds_pct:            vals.tds_pct,
          vds_pct:            vals.vds_pct,
          sd_pct:             vals.sd_pct,
          is_tax_inclusive:   vals.is_tax_inclusive,
          effective_from:     effectiveFrom,
        }
        const existing = activeConfig.find(r => r.charge_type === ct)
        if (existing) {
          await supabase.from('tax_config').update(payload).eq('id', existing.id)
        } else {
          await supabase.from('tax_config').insert(payload)
        }
      }
      setSaveMsg('✅ Tax policy saved successfully.')
      const { data } = await supabase.from('tax_config').select('*').eq('tenant_id', tenantId).order('effective_from', { ascending: false })
      if (data) {
        const lm = {}
        for (const row of data) { if (!lm[row.charge_type]) lm[row.charge_type] = row }
        setActiveConfig(Object.values(lm))
      }
    } catch (e) {
      setSaveMsg('❌ Save failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) return (
    <div className="card p-5 text-pine/50 text-sm">Tax policy configuration is available to administrators only.</div>
  )

  const chargeTypesInEdit = Object.keys(editMap)

  return (
    <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-green-700 to-emerald-600 px-6 py-4 flex items-center gap-3">
        <span className="text-2xl">🏛️</span>
        <div>
          <h3 className="text-white font-bold text-lg">Tax Policy Configuration</h3>
          <p className="text-green-100 text-sm">Country-wise tax rates applied to each charge type</p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <label className="block text-sm font-semibold text-blue-800 mb-2">🌍 Select Country / Tax Jurisdiction</label>
          <div className="flex flex-wrap gap-2">
            {countries.map(c => (
              <button
                key={c.country_code}
                onClick={() => setSelectedCountry(c)}
                className="px-4 py-2 rounded-full text-sm font-medium border transition-all"
                style={
                  selectedCountry?.country_code === c.country_code
                    ? { backgroundColor: '#1d4ed8', color: '#ffffff', borderColor: '#1d4ed8', boxShadow: '0 2px 6px rgba(0,0,0,0.18)' }
                    : { backgroundColor: '#ffffff', color: '#374151', borderColor: '#d1d5db' }
                }
              >
                {COUNTRY_FLAG[c.country_code] || '🌐'} {c.country_name}
                {c.country_code !== '00' && <span className="ml-1 text-xs opacity-70">({c.country_code})</span>}
              </button>
            ))}
          </div>
          {selectedCountry && templateRows.length > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={applyTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
              >
                ⬇️ Load {selectedCountry.country_name} Template
              </button>
              <span className="text-xs text-blue-600">Loads standard rates — edit before saving</span>
            </div>
          )}
        </div>

        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <p className="text-sm font-semibold text-gray-700 mb-2">⚙️ Active Charge Types</p>
          <div className="flex flex-wrap gap-2">
            {ALL_CHARGE_TYPES.map(ct => {
              const meta = CHARGE_TYPE_META[ct]
              const active = ct in editMap
              return (
                <button
                  key={ct}
                  onClick={() => {
                    if (active) {
                      setEditMap(prev => { const n = { ...prev }; delete n[ct]; return n })
                    } else {
                      setEditMap(prev => ({
                        ...prev,
                        [ct]: { tax_pct: 0, service_charge_pct: 0, tds_pct: 0, vds_pct: 0, sd_pct: 0, is_tax_inclusive: false }
                      }))
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                  style={active
                    ? { backgroundColor: '#14532d', color: '#ffffff', borderColor: '#14532d' }
                    : { backgroundColor: '#ffffff', color: '#6b7280', borderColor: '#d1d5db' }
                  }
                >
                  {meta.icon} {meta.label}
                  {active ? ' ✓' : ' +'}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2">Active types দেখাবে নিচে। + click করে নতুন type যোগ করো, ✓ click করে সরাও।</p>
        </div>

        <div className="flex items-center gap-4">
          <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">📅 Effective From:</label>
          <input
            type="date"
            value={effectiveFrom}
            onChange={e => setEffectiveFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading current policy…</div>
        ) : chargeTypesInEdit.length === 0 ? (
          <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            <div className="text-4xl mb-2">🌍</div>
            <p className="font-medium text-gray-600">Select a country and click "Load Template" to begin</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chargeTypesInEdit.map(ct => {
              const meta   = CHARGE_TYPE_META[ct] || { label: ct, icon: '💰', color: 'slate' }
              const colors = COLOR_CLASSES[meta.color] || COLOR_CLASSES.slate
              const vals   = editMap[ct] || {}
              const tmpl   = templateRows.find(r => r.charge_type === ct)
              return (
                <div key={ct} className={`rounded-xl border ${colors.border} overflow-hidden`}>
                  <div className={`${colors.head} px-4 py-3 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{meta.icon}</span>
                      <span className="font-semibold text-gray-800 text-sm">{meta.label}</span>
                    </div>
                    {tmpl && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
                        {tmpl.tax_name}
                      </span>
                    )}
                  </div>
                  <div className={`${colors.bg} p-4 space-y-3`}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tax / VAT %</label>
                        <input type="number" min="0" max="100" step="0.01"
                          value={vals.tax_pct ?? 0}
                          onChange={e => handleField(ct, 'tax_pct', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Service Charge %</label>
                        <input type="number" min="0" max="100" step="0.01"
                          value={vals.service_charge_pct ?? 0}
                          onChange={e => handleField(ct, 'service_charge_pct', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    {(Number(vals.tds_pct) > 0 || Number(vals.vds_pct) > 0 || Number(vals.sd_pct) > 0 || ct === 'ROOM_CORPORATE') && (
                      <div className="grid grid-cols-3 gap-2">
                        {['tds_pct','vds_pct','sd_pct'].map(field => (
                          <div key={field}>
                            <label className="block text-xs font-medium text-gray-600 mb-1">{field.split('_')[0].toUpperCase()} %</label>
                            <input type="number" min="0" max="100" step="0.01"
                              value={vals[field] ?? 0}
                              onChange={e => handleField(ct, field, e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-1 focus:ring-green-500"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox"
                        checked={vals.is_tax_inclusive ?? false}
                        onChange={e => handleField(ct, 'is_tax_inclusive', e.target.checked)}
                        className="w-4 h-4 rounded text-green-600"
                      />
                      <span className="text-xs text-gray-600">Tax inclusive in price</span>
                    </label>
                    {tmpl?.notes && (
                      <p className="text-xs text-gray-500 italic bg-white/60 rounded px-2 py-1">ℹ️ {tmpl.notes}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {chargeTypesInEdit.length > 0 && (
          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800 disabled:opacity-50 transition"
            >
              {saving ? '⏳ Saving…' : '💾 Save Tax Policy'}
            </button>
            {saveMsg && (
              <span className={`text-sm font-medium ${saveMsg.startsWith('✅') ? 'text-green-700' : 'text-red-600'}`}>
                {saveMsg}
              </span>
            )}
          </div>
        )}

        {activeConfig.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Currently Active Policy
              {activeConfig[0]?.country_code && (
                <span className="ml-2 normal-case font-normal text-gray-400">
                  — {COUNTRY_FLAG[activeConfig[0].country_code] || '🌐'} {activeConfig[0].country_code}
                  &nbsp;| Effective: {activeConfig[0].effective_from}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {activeConfig.map(r => {
                const meta = CHARGE_TYPE_META[r.charge_type] || { label: r.charge_type, icon: '💰' }
                return (
                  <span key={r.charge_type} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-700">
                    {meta.icon} {meta.label}:&nbsp;
                    <strong>{Number(r.tax_pct ?? r.vat_pct ?? 0)}%</strong>
                    {Number(r.service_charge_pct) > 0 && <> + {Number(r.service_charge_pct)}% SC</>}
                    {Number(r.tds_pct) > 0 && <> + {Number(r.tds_pct)}% TDS</>}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
