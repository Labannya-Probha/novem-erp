import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { Save, Activity, Building2, Users, CreditCard, Database, Search } from 'lucide-react'
import { MetricCard, InputField, SelectField } from './settingsHelpers'
import { PLAN_OPTIONS, SUBSCRIPTION_STATUSES, BILLING_CYCLES } from './settingsConfig'
import { todayISO } from '../../lib/helpers'

const defaultLicenseEndDate = () => {
  const date = new Date(`${todayISO()}T00:00:00`)
  date.setMonth(date.getMonth() + 2)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function SaasTenantAdminCard() {
  const [rows, setRows] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState({})
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const load = async () => {
    setBusy(true)
    const [propertiesRes, companyRes, usersRes, subscriptionsRes] = await Promise.all([
      supabase.from('properties').select('id, slug, name, is_active, created_at').order('created_at', { ascending: false }),
      supabase.from('company_settings').select('tenant_id, name, legal_name, logo_url, currency, email, phone, primary_color, sidebar_bg_color'),
      supabase.from('app_users').select('tenant_id, role, is_active'),
      supabase.from('tenant_subscriptions').select('*'),
    ])
    setBusy(false)
    const error = propertiesRes.error || companyRes.error || usersRes.error || subscriptionsRes.error
    if (error) { flash(error.message); return }

    const companies = new Map((companyRes.data || []).map((c) => [c.tenant_id, c]))
    const subscriptions = new Map((subscriptionsRes.data || []).map((s) => [s.tenant_id, s]))
    const users = usersRes.data || []
    const nextRows = (propertiesRes.data || []).map((property) => {
      const company = companies.get(property.id) || {}
      const subscription = subscriptions.get(property.id) || {}
      const tenantUsers = users.filter((u) => u.tenant_id === property.id)
      return {
        ...property,
        company,
        subscription,
        userCount: tenantUsers.length,
        activeUserCount: tenantUsers.filter((u) => u.is_active).length,
        adminCount: tenantUsers.filter((u) => ['SUPERUSER', 'ADMIN'].includes(u.role)).length,
      }
    })
    setRows(nextRows)
    const selected = selectedId ? nextRows.find((r) => r.id === selectedId) : nextRows[0]
    if (selected) selectTenant(selected)
  }

  useEffect(() => { load() }, [])

  const selectTenant = (tenant) => {
    setSelectedId(tenant.id)
    const sub = tenant.subscription || {}
    setForm({
      tenant_id: tenant.id,
      plan_code: sub.plan_code || 'PROFESSIONAL',
      status: sub.status || 'ACTIVE',
      user_limit: sub.user_limit || 25,
      property_limit: sub.property_limit || 1,
      storage_limit_mb: sub.storage_limit_mb || 10240,
      billing_email: sub.billing_email || tenant.company?.email || '',
      billing_cycle: sub.billing_cycle || 'MONTHLY',
      monthly_fee: sub.monthly_fee || 0,
      currency: sub.currency || tenant.company?.currency || 'BDT',
      next_billing_date: sub.next_billing_date || defaultLicenseEndDate(),
      modules_enabled: sub.modules_enabled || {
        reservations: true, frontOffice: true, pos: true, accounting: true,
        inventory: true, hr: true, reports: true,
      },
      notes: sub.notes || '',
    })
  }

  const saveSubscription = async () => {
    if (!form.tenant_id) return
    setBusy(true)
    const payload = {
      ...form,
      user_limit: +form.user_limit || 0,
      property_limit: +form.property_limit || 1,
      storage_limit_mb: +form.storage_limit_mb || 0,
      monthly_fee: +form.monthly_fee || 0,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('tenant_subscriptions').upsert(payload, { onConflict: 'tenant_id' })
    setBusy(false)
    if (error) flash(error.message)
    else { flash('Tenant subscription saved.'); load() }
  }

  const setModule = (key, value) => {
    setForm((prev) => ({
      ...prev,
      modules_enabled: { ...(prev.modules_enabled || {}), [key]: value },
    }))
  }

  const filtered = rows.filter((r) => {
    const haystack = `${r.name} ${r.slug} ${r.company?.legal_name || ''} ${r.company?.email || ''}`.toLowerCase()
    return haystack.includes(query.toLowerCase())
  })
  const selected = rows.find((r) => r.id === selectedId)
  const totalUsers = rows.reduce((sum, row) => sum + row.userCount, 0)
  const activeTenants = rows.filter((row) => row.is_active && row.subscription?.status !== 'SUSPENDED').length
  const mrr = rows.reduce((sum, row) => sum + Number(row.subscription?.monthly_fee || 0), 0)

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between mb-4">
        <div>
          <h2 className="font-display font-semibold text-pine flex items-center gap-2">
            <Building2 size={18} className="text-forest" /> SaaS tenant control
          </h2>
          <p className="text-xs text-pine/50 mt-1">Tenant status, plan, user limit, billing, module entitlement and usage overview.</p>
        </div>
        <button className="btn-ghost" onClick={load} disabled={busy}><Activity size={15} /> Refresh live data</button>
      </div>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}

      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <MetricCard icon={Building2} label="Tenants" value={rows.length} />
        <MetricCard icon={Activity} label="Active tenants" value={activeTenants} />
        <MetricCard icon={Users} label="Users" value={totalUsers} />
        <MetricCard icon={CreditCard} label="Billable MRR" value={`${form.currency || 'BDT'} ${mrr.toLocaleString()}`} />
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
        <div className="border border-leaf rounded-xl overflow-hidden">
          <div className="p-3 border-b border-leaf bg-paper flex items-center gap-2">
            <Search size={15} className="text-pine/40" />
            <input className="w-full bg-transparent outline-none text-sm" placeholder="Search tenant, slug, email..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="table-scroll max-h-[520px]">
            <table className="w-full">
              <thead><tr><th className="th">Tenant</th><th className="th">Plan</th><th className="th text-right">Users</th><th className="th">Status</th><th className="th">Billing</th></tr></thead>
              <tbody>
                {filtered.map((tenant) => (
                  <tr key={tenant.id} onClick={() => selectTenant(tenant)} className={`cursor-pointer ${selectedId === tenant.id ? 'bg-forest/10' : ''}`}>
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg border border-leaf bg-white flex items-center justify-center overflow-hidden">
                          {tenant.company?.logo_url ? <img src={tenant.company.logo_url} alt="" className="h-full w-full object-contain" /> : <Building2 size={17} className="text-pine/35" />}
                        </div>
                        <div>
                          <div className="font-semibold text-pine">{tenant.company?.name || tenant.name}</div>
                          <div className="text-xs text-pine/45">{tenant.slug || tenant.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="td">{tenant.subscription?.plan_code || 'Not set'}</td>
                    <td className="td text-right money">{tenant.activeUserCount}/{tenant.subscription?.user_limit || '-'}</td>
                    <td className="td"><span className={`status-chip ${tenant.subscription?.status === 'SUSPENDED' ? 'bg-red-50 text-red-600' : 'bg-forest/15 text-forest'}`}>{tenant.subscription?.status || 'ACTIVE'}</span></td>
                    <td className="td text-sm">{tenant.subscription?.next_billing_date || defaultLicenseEndDate()}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td className="td text-pine/40" colSpan={5}>No tenants found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-leaf rounded-xl p-4 bg-white">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-display font-semibold text-pine">{selected.company?.name || selected.name}</h3>
                  <p className="text-xs text-pine/45">{selected.company?.email || 'No billing email'} - {selected.company?.phone || 'No phone'}</p>
                </div>
                <span className="status-chip">{selected.activeUserCount} active users</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Plan" value={form.plan_code} onChange={(v) => setForm({ ...form, plan_code: v })} options={PLAN_OPTIONS} />
                <SelectField label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={SUBSCRIPTION_STATUSES} />
                <InputField label="User limit" type="number" value={form.user_limit} onChange={(v) => setForm({ ...form, user_limit: v })} />
                <InputField label="Property limit" type="number" value={form.property_limit} onChange={(v) => setForm({ ...form, property_limit: v })} />
                <InputField label="Storage MB" type="number" value={form.storage_limit_mb} onChange={(v) => setForm({ ...form, storage_limit_mb: v })} />
                <InputField label="Monthly fee" type="number" value={form.monthly_fee} onChange={(v) => setForm({ ...form, monthly_fee: v })} />
                <InputField label="Currency" value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} />
                <SelectField label="Billing cycle" value={form.billing_cycle} onChange={(v) => setForm({ ...form, billing_cycle: v })} options={BILLING_CYCLES} />
                <div className="col-span-2"><InputField label="Billing email" value={form.billing_email} onChange={(v) => setForm({ ...form, billing_email: v })} /></div>
                <InputField label="Next billing date" type="date" value={form.next_billing_date} onChange={(v) => setForm({ ...form, next_billing_date: v })} />
                <div>
                  <label className="label">Tenant DB ID</label>
                  <div className="input flex items-center text-xs text-pine/55 truncate"><Database size={13} className="mr-2 shrink-0" />{selected.id}</div>
                </div>
              </div>
              <div className="mt-4">
                <label className="label">Enabled modules</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(form.modules_enabled || {}).map(([key, value]) => (
                    <label key={key} className="flex items-center justify-between gap-2 rounded-lg border border-leaf px-3 py-2 text-sm">
                      <span className="capitalize text-pine">{key.replace(/([A-Z])/g, ' $1')}</span>
                      <input type="checkbox" checked={!!value} onChange={(e) => setModule(key, e.target.checked)} />
                    </label>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <label className="label">Internal notes</label>
                <textarea className="input" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <button className="btn-primary mt-4 w-full" onClick={saveSubscription} disabled={busy}><Save size={15} /> Save SaaS controls</button>
            </>
          ) : (
            <div className="text-sm text-pine/45">Select a tenant to manage subscription controls.</div>
          )}
        </div>
      </div>
    </div>
  )
}
