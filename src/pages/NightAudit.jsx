import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, rateFor, computeCharge } from '../lib/helpers'
import { ShieldAlert, Play, CheckCircle2, AlertTriangle, Calendar, Moon, Sparkles } from 'lucide-react'

export default function NightAudit({ userName, userRole, requestAdminPermission }) {
  const [businessDate, setBusinessDate] = useState(() => {
    return localStorage.getItem('resort_business_date') || todayISO()
  })
  const [step, setStep] = useState('IDLE') // IDLE, CHECKING, READY, RUNNING, DONE
  const [checks, setChecks] = useState({
    openOrders: [],
    pendingDepartures: [],
    pendingArrivals: [],
    inHouseCount: 0,
  })
  const [auditResult, setAuditResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Load the current audit checklist status
  const runChecks = async () => {
    setStep('CHECKING')
    setErrorMsg('')
    try {
      // 1. Get open restaurant orders
      const { data: openOrders } = await supabase
        .from('pos_orders')
        .select('*')
        .eq('status', 'OPEN')

      // 2. Get departures that are still checked in
      const { data: pendingDepartures } = await supabase
        .from('reservations')
        .select('*, guests:primary_guest_id(full_name), reservation_rooms(rooms(room_no))')
        .eq('status', 'CHECKED_IN')
        .lte('check_out', businessDate)

      // 3. Get expected arrivals that have not checked in or cancelled
      const { data: pendingArrivals } = await supabase
        .from('reservations')
        .select('*, guests:primary_guest_id(full_name)')
        .in('status', ['QUERY', 'QUOTED', 'CONFIRMED'])
        .lte('check_in', businessDate)

      // 4. In-house guest count
      const { count: inHouseCount } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'CHECKED_IN')

      setChecks({
        openOrders: openOrders || [],
        pendingDepartures: pendingDepartures || [],
        pendingArrivals: pendingArrivals || [],
        inHouseCount: inHouseCount || 0,
      })
      setStep('READY')
    } catch (e) {
      setErrorMsg(e.message)
      setStep('IDLE')
    }
  }

  useEffect(() => {
    runChecks()
  }, [businessDate])

  const startNightAudit = () => {
    // Audit requires Admin permissions
    requestAdminPermission(async () => {
      // Block if there are open restaurant orders
      if (checks.openOrders.length > 0) {
        setErrorMsg('Night Audit Blocked: Please settle or cancel all open restaurant POS orders first.')
        return
      }

      setStep('RUNNING')
      try {
        const nextDate = new Date(new Date(businessDate + 'T00:00:00').getTime() + 86400000)
          .toISOString()
          .slice(0, 10)

        // 1. Fetch active checked-in reservations
        const { data: activeRes } = await supabase
          .from('reservations')
          .select('*, reservation_rooms(id, room_id, rate, rooms(room_no))')
          .eq('status', 'CHECKED_IN')

        // Fetch tax config
        const { data: taxConfig } = await supabase.from('tax_config').select('*')
        const rate = rateFor(taxConfig, 'ROOM', businessDate)

        let postedCount = 0
        let postedRevenue = 0

        // 2. Loop through active reservations and post nightly charges
        if (activeRes && activeRes.length > 0) {
          const rowsToInsert = []
          for (const res of activeRes) {
            // Check if room charge was already posted for this date
            const { data: existing } = await supabase
              .from('folio_charges')
              .select('id')
              .eq('reservation_id', res.id)
              .eq('charge_date', businessDate)
              .eq('charge_type', 'ROOM')
              .limit(1)

            if (existing && existing.length > 0) {
              continue // Already posted for tonight
            }

            // Post room charges for assigned rooms
            for (const rr of res.reservation_rooms || []) {
              const charge = computeCharge(rr.rate, res.discount_pct, rate)
              rowsToInsert.push({
                reservation_id: res.id,
                charge_date: businessDate,
                charge_type: 'ROOM',
                description: `Room ${rr.rooms?.room_no} — Night of ${fmtDate(businessDate)} (Auto Night Audit)`,
                ...charge,
                created_by: userName,
              })
              postedRevenue += charge.total
              postedCount++
            }

            // Post extra pax charges if configured
            if (res.extra_pax > 0 && res.extra_pax_rate > 0) {
              const charge = computeCharge(res.extra_pax * res.extra_pax_rate, res.discount_pct, rate)
              rowsToInsert.push({
                reservation_id: res.id,
                charge_date: businessDate,
                charge_type: 'ROOM',
                description: `Extra Pax × ${res.extra_pax} — ${fmtDate(businessDate)} (Auto Night Audit)`,
                ...charge,
                created_by: userName,
              })
              postedRevenue += charge.total
            }

            // Post driver accommodation if configured
            if (res.driver_accommodation && res.driver_count > 0 && res.driver_rate > 0) {
              const charge = computeCharge(res.driver_count * res.driver_rate, res.discount_pct, rate)
              rowsToInsert.push({
                reservation_id: res.id,
                charge_date: businessDate,
                charge_type: 'ROOM',
                description: `Driver Accom. × ${res.driver_count} — ${fmtDate(businessDate)} (Auto Night Audit)`,
                ...charge,
                created_by: userName,
              })
              postedRevenue += charge.total
            }
          }

          if (rowsToInsert.length > 0) {
            const { error: insertError } = await supabase.from('folio_charges').insert(rowsToInsert)
            if (insertError) throw insertError
          }
        }

        // 3. Compile revenue summaries for the audited day
        // POS orders revenue
        const { data: posOrders } = await supabase
          .from('pos_orders')
          .select('total')
          .neq('status', 'CANCELLED')
          .gte('created_at', `${businessDate}T00:00:00`)
          .lte('created_at', `${businessDate}T23:59:59`)

        const posRevenue = (posOrders || []).reduce((sum, o) => sum + Number(o.total || 0), 0)

        // Other folio charges posted today
        const { data: otherCharges } = await supabase
          .from('folio_charges')
          .select('total')
          .eq('charge_date', businessDate)
          .in('charge_type', ['TEA_SALE', 'PICKLE_SALE', 'SPORTS_RENTAL', 'LAUNDRY', 'OTHER'])

        const otherRevenue = (otherCharges || []).reduce((sum, c) => sum + Number(c.total || 0), 0)

        // Total payments collected
        const { data: payments } = await supabase
          .from('payments')
          .select('amount, method')
          .eq('received_date', businessDate)

        const totalPayments = (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0)
        const paymentSummary = (payments || []).reduce((acc, p) => {
          acc[p.method] = (acc[p.method] || 0) + Number(p.amount)
          return acc
        }, {})

        // 4. Save audit log/report
        const report = {
          date: businessDate,
          run_at: new Date().toISOString(),
          run_by: userName,
          rooms_occupied: checks.inHouseCount,
          room_revenue: postedRevenue,
          pos_revenue: posRevenue,
          other_revenue: otherRevenue,
          total_revenue: postedRevenue + posRevenue + otherRevenue,
          total_payments: totalPayments,
          payment_summary: paymentSummary,
          posted_charges_count: postedCount,
        }

        const existingReports = JSON.parse(localStorage.getItem('night_audit_reports') || '[]')
        localStorage.setItem('night_audit_reports', JSON.stringify([report, ...existingReports]))

        // 5. Advance system date
        localStorage.setItem('resort_business_date', nextDate)
        
        // Dispatch event so App.jsx or others can react
        window.dispatchEvent(new Event('branding_update'))

        setAuditResult(report)
        setBusinessDate(nextDate)
        setStep('DONE')
      } catch (err) {
        setErrorMsg('Night Audit Failed: ' + err.message)
        setStep('READY')
      }
    }, "Execute Night Audit")
  }

  const hasIssues = checks.openOrders.length > 0 || checks.pendingArrivals.length > 0 || checks.pendingDepartures.length > 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-pine flex items-center gap-2">
          <Moon size={24} className="text-amber" /> Night Audit Center
        </h1>
        <p className="text-sm text-pine/60">
          Roll the resort business date, auto-post nightly room charges, and generate daily revenue statements.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 bg-white flex flex-col justify-between">
          <div>
            <div className="label">Resort Business Date</div>
            <div className="text-3xl font-display font-bold text-pine flex items-center gap-2 mt-1">
              <Calendar className="text-forest" size={24} /> {fmtDate(businessDate)}
            </div>
          </div>
          <p className="text-[11px] text-pine/50 mt-3">All hotel transactions and room charges post under this date.</p>
        </div>

        <div className="card p-5 bg-white flex flex-col justify-between">
          <div>
            <div className="label">Occupied Rooms (Tonight)</div>
            <div className="text-3xl font-display font-bold text-pine mt-1">
              {checks.inHouseCount} Rooms
            </div>
          </div>
          <p className="text-[11px] text-pine/50 mt-3">Charges will be posted to these folios during the audit run.</p>
        </div>

        <div className="card p-5 bg-white flex flex-col justify-between border-dashed border-2 border-forest/30">
          <div>
            <div className="label">Audit Control</div>
            <p className="text-xs text-pine/70 mt-2">
              Runs end-of-day processes, posts room taxes, and rolls dates forward.
            </p>
          </div>
          <button
            className={`btn-primary w-full justify-center mt-3 ${step === 'CHECKING' || step === 'RUNNING' ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={step === 'READY' ? startNightAudit : runChecks}
            disabled={step === 'RUNNING' || step === 'CHECKING'}
          >
            {step === 'RUNNING' ? (
              <span>Auditing…</span>
            ) : (
              <>
                <Play size={16} /> Run Night Audit
              </>
            )}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold flex items-center gap-3">
          <ShieldAlert size={20} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Checklist Grid */}
      <div className="card p-6 bg-white space-y-4">
        <h3 className="font-display font-bold text-pine text-lg border-b border-leaf pb-2">Pre-Audit Checklist</h3>

        <div className="space-y-3">
          {/* Check 1: Open Restaurant Orders */}
          <div className="flex items-start gap-4 p-3 rounded-lg border border-leaf hover:bg-leaf/10">
            {checks.openOrders.length > 0 ? (
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
            ) : (
              <CheckCircle2 className="text-forest shrink-0 mt-0.5" size={18} />
            )}
            <div className="flex-1 text-sm">
              <div className="font-semibold text-pine">Open POS Restaurant Orders</div>
              <p className="text-xs text-pine/60 mt-0.5">All restaurant orders must be settled or cancelled.</p>
              {checks.openOrders.length > 0 && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100 font-mono">
                  Blocked: {checks.openOrders.length} active order(s) pending (e.g. {checks.openOrders.map(o => o.order_no).join(', ')}).
                </div>
              )}
            </div>
          </div>

          {/* Check 2: Unprocessed Departures */}
          <div className="flex items-start gap-4 p-3 rounded-lg border border-leaf hover:bg-leaf/10">
            {checks.pendingDepartures.length > 0 ? (
              <AlertTriangle className="text-amber shrink-0 mt-0.5" size={18} />
            ) : (
              <CheckCircle2 className="text-forest shrink-0 mt-0.5" size={18} />
            )}
            <div className="flex-1 text-sm">
              <div className="font-semibold text-pine">Pending Departures</div>
              <p className="text-xs text-pine/60 mt-0.5">Guests due to check out on or before today.</p>
              {checks.pendingDepartures.length > 0 && (
                <div className="mt-2 space-y-1">
                  {checks.pendingDepartures.map(d => (
                    <div key={d.id} className="text-xs bg-amber/10 border border-amber/20 text-amber-800 p-1.5 rounded flex justify-between">
                      <span>{d.reservation_name || d.guests?.full_name} ({d.res_no})</span>
                      <span>Room {d.reservation_rooms?.map(x => x.rooms?.room_no).join(', ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Check 3: Unprocessed Arrivals */}
          <div className="flex items-start gap-4 p-3 rounded-lg border border-leaf hover:bg-leaf/10">
            {checks.pendingArrivals.length > 0 ? (
              <AlertTriangle className="text-amber shrink-0 mt-0.5" size={18} />
            ) : (
              <CheckCircle2 className="text-forest shrink-0 mt-0.5" size={18} />
            )}
            <div className="flex-1 text-sm">
              <div className="font-semibold text-pine">Pending Arrivals / Queries</div>
              <p className="text-xs text-pine/60 mt-0.5">Guests expected to check in on or before today.</p>
              {checks.pendingArrivals.length > 0 && (
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {checks.pendingArrivals.map(a => (
                    <div key={a.id} className="text-xs bg-amber/10 border border-amber/20 text-amber-800 p-1.5 rounded flex justify-between">
                      <span>{a.reservation_name || a.guests?.full_name} ({a.res_no})</span>
                      <span>Status: {a.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {hasIssues && (
          <div className="p-3 text-xs bg-amber/5 text-amber-700 border border-amber/20 rounded-lg">
            <b>Warning:</b> There are unresolved items in the checklist. Pending arrivals/departures will not block the audit, but nightly room charges will post to all active checked-in rooms. Open POS orders MUST be settled.
          </div>
        )}
      </div>

      {/* Done summary modal/overlay */}
      {step === 'DONE' && auditResult && (
        <div className="fixed inset-0 bg-ink/70 z-50 flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 bg-white space-y-4 shadow-xl border-forest animate-fade-in">
            <div className="flex items-center gap-3 text-forest">
              <Sparkles size={28} className="text-amber animate-pulse" />
              <h2 className="font-display text-xl font-bold text-pine">Night Audit Completed!</h2>
            </div>
            <p className="text-sm text-pine/70">
              The resort business date has been successfully rolled forward to <b>{fmtDate(businessDate)}</b>. Daily charges have been posted.
            </p>

            <div className="bg-leaf/40 rounded-xl p-4 space-y-2 text-sm money border border-leaf">
              <div className="flex justify-between border-b border-leaf pb-1">
                <span className="font-semibold text-pine">Audited Date:</span>
                <span>{fmtDate(auditResult.date)}</span>
              </div>
              <div className="flex justify-between">
                <span>Auto Room Charges Posted:</span>
                <span>{auditResult.posted_charges_count} lines</span>
              </div>
              <div className="flex justify-between">
                <span>Nightly Room Revenue:</span>
                <span className="font-semibold text-forest">{fmtBDT(auditResult.room_revenue)}</span>
              </div>
              <div className="flex justify-between">
                <span>Restaurant POS Sales:</span>
                <span className="font-semibold text-forest">{fmtBDT(auditResult.pos_revenue)}</span>
              </div>
              <div className="flex justify-between">
                <span>Other Facilities Sales:</span>
                <span className="font-semibold text-forest">{fmtBDT(auditResult.other_revenue)}</span>
              </div>
              <div className="flex justify-between border-t border-pine/20 pt-1 text-base font-bold">
                <span>Total Daily Revenue:</span>
                <span className="text-pine">{fmtBDT(auditResult.total_revenue)}</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-pine/20 pt-1 font-semibold">
                <span>Total Payments Collected:</span>
                <span className="text-forest">{fmtBDT(auditResult.total_payments)}</span>
              </div>
            </div>

            <button className="btn-primary w-full justify-center" onClick={() => { setStep('IDLE'); setAuditResult(null); runChecks() }}>
              Close Statement
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
