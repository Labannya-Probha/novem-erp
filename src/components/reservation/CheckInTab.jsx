import { useState } from 'react'
import { BadgeCheck, BedDouble, LogIn, Plus, Printer, Trash2 } from 'lucide-react'
import { fmtBDT, fmtDate } from '../../lib/helpers'
import { todayISO } from '../../lib/helpers'
import { canManualCheckIn, getCheckInActionCopy } from '../../lib/noShowAutomation'
import { logAudit } from '../../lib/pms.api.js'
import { supabase } from '../../supabase'
import SearchableSelect from '../SearchableSelect.jsx'
import GuestIdManager from './GuestIdManager.jsx'

export function CheckInTab({ res, guest, resGuests, resRooms, rooms, reload, setStatus, userName, openCard, payments, flash, isAdmin, guestIds = [] }) {
  const locked = !isAdmin && ['CHECKED_IN', 'CHECKED_OUT', 'SETTLED'].includes(res.status)
  const [f, setF] = useState({
    special_instructions: res.special_instructions || '',
  })
  const [newGuest, setNewGuest] = useState('')
  const [roomSel, setRoomSel]   = useState('')
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  const assignRoom = async () => {
    if (locked) { flash('After check-in, only an administrator can change room assignment.'); return }
    if (!roomSel) return
    const room = rooms.find((r) => r.id === roomSel)
    await supabase.from('reservation_rooms').insert({ reservation_id: res.id, room_id: room.id, rate: res.room_rate || room.base_rate, from_date: res.check_in, to_date: res.check_out })
    setRoomSel(''); await reload()
  }
  const removeRoom = async (rrId) => {
    if (locked) { flash('Administrator access required after check-in.'); return }
    await supabase.from('reservation_rooms').delete().eq('id', rrId); await reload()
  }
  const updateRoomRate = async (rrId, rate) => {
    if (locked) { flash('Administrator access required after check-in.'); return }
    if (rate === '' || isNaN(+rate)) return
    await supabase.from('reservation_rooms').update({ rate: +rate }).eq('id', rrId); await reload()
  }
  const updateRoomDates = async (rrId, field, val) => {
    if (locked) { flash('Administrator access required after check-in.'); return }
    if (!val) return
    await supabase.from('reservation_rooms').update({ [field]: val }).eq('id', rrId); await reload()
  }
  const addGuest = async () => {
    if (locked) { flash('Administrator access required after check-in.'); return }
    if (!newGuest.trim()) return
    await supabase.from('reservation_guests').insert({ reservation_id: res.id, guest_name: newGuest.trim() })
    setNewGuest(''); await reload()
  }
  const removeGuest = async (gid) => {
    if (locked) { flash('Administrator access required after check-in.'); return }
    await supabase.from('reservation_guests').delete().eq('id', gid); await reload()
  }

  const doCheckIn = async () => {
    if (resRooms.length === 0) { flash('Assign at least one room before check-in.'); return }
    const notReadyRooms = resRooms.filter((rr) => {
      const hk = (rr.rooms?.hk_status || '').toLowerCase()
      return !['clean', 'inspected'].includes(hk)
    })
    if (notReadyRooms.length > 0) {
      flash(`Check-in blocked: room(s) not ready/clean (${notReadyRooms.map((rr) => rr.rooms?.room_no).join(', ')}).`)
      return
    }
    const wasNoShow = res.status === 'NO_SHOW'
    await setStatus('CHECKED_IN', {
      extra_pax: +(res.extra_pax || 0), extra_pax_rate: +(res.extra_pax_rate || 0),
      driver_accommodation: res.driver_accommodation, driver_count: +(res.driver_count || 0), driver_rate: +(res.driver_rate || 0),
      special_instructions: f.special_instructions,
      checked_in_at: new Date().toISOString(), checkin_by: userName,
    })
    if (wasNoShow) {
      await logAudit({
        actor: userName,
        action: 'NO_SHOW_OVERRIDE_CHECKIN',
        entity: 'reservation',
        entity_id: res.res_no,
        details: { from_status: 'NO_SHOW', to_status: 'CHECKED_IN', source: 'MANUAL_OVERRIDE' },
      })
    }
    flash(wasNoShow ? 'Guest checked in and no-show overridden. Print the Registration Card for signatures.' : 'Guest checked in. Print the Registration Card for signatures.')
  }

  const assignedIds = new Set(resRooms.map((r) => r.room_id))
  const checkInAction = getCheckInActionCopy(res.status)

  return (
    <>
      {locked && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-amber/10 text-amber text-sm font-medium">
          This reservation is checked in — room assignment and guest details are locked. Only an administrator can change them.
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5 space-y-4">
          <h3 className="font-display font-semibold text-pine">Room assignment</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <SearchableSelect
              className="flex-1"
              value={roomSel}
              onChange={setRoomSel}
              options={rooms.filter((r) => !assignedIds.has(r.id)).map((r) => ({
                value: r.id,
                label: `${r.room_no}${r.room_name ? ` — ${r.room_name}` : ''} · ${r.room_type} (${fmtBDT(r.base_rate)})`
              }))}
              placeholder="Select room…"
            />
            <button className="btn-primary justify-center" onClick={assignRoom}><BedDouble size={15} /> Assign</button>
          </div>
          {resRooms.map((rr) => (
            <div key={rr.id} className="text-sm border border-leaf rounded-lg px-3 py-2 space-y-2">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="font-semibold">Room {rr.rooms?.room_no}{rr.rooms?.room_name ? ` · ${rr.rooms.room_name}` : ''} <span className="text-pine/50 font-normal">· {rr.rooms?.room_type}</span></span>
                <span className="flex items-center gap-2 money flex-wrap">
                  {locked ? (
                    <>{fmtBDT(rr.rate)}/night</>
                  ) : (
                    <>
                      <input type="number" defaultValue={rr.rate} onBlur={(e) => updateRoomRate(rr.id, e.target.value)} className="input !w-28 !py-1 money text-right" title="Edit rate — then Repost room charges in Folio" />/night
                      <button onClick={() => removeRoom(rr.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                    </>
                  )}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-pine/60">
                <span>Stay:</span>
                {locked ? (
                  <span className="money">{fmtDate(rr.from_date || res.check_in)} → {fmtDate(rr.to_date || res.check_out)}</span>
                ) : (
                  <>
                    <input type="date" defaultValue={rr.from_date || res.check_in} onBlur={(e) => updateRoomDates(rr.id, 'from_date', e.target.value)} className="input !py-1 !w-36" />
                    <span>→</span>
                    <input type="date" defaultValue={rr.to_date || res.check_out} onBlur={(e) => updateRoomDates(rr.id, 'to_date', e.target.value)} className="input !py-1 !w-36" />
                  </>
                )}
              </div>
            </div>
          ))}
          {rooms.length === 0 && <p className="text-xs text-amber">No rooms defined yet — add your room inventory in Settings → Rooms.</p>}

          <h3 className="font-display font-semibold text-pine pt-2">All guest names (for Registration Card)</h3>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Add accompanying guest name" value={newGuest} onChange={(e) => setNewGuest(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addGuest()} />
            <button className="btn-ghost" onClick={addGuest}><Plus size={15} /></button>
          </div>
          {resGuests.map((g) => (
            <div key={g.id} className="flex justify-between items-center text-sm px-3 py-1.5 border-b border-leaf/60">
              <span>{g.guest_name} {g.is_primary && <span className="status-chip bg-forest/15 text-forest ml-2">Primary</span>}</span>
              {!g.is_primary && <button onClick={() => removeGuest(g.id)} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>}
            </div>
          ))}
        </div>

        <div className="card p-5 space-y-4">
          <h3 className="font-display font-semibold text-pine">Check-in details</h3>

          {/* ── Multi-ID Section ── */}
          <GuestIdManager
            reservationId={res.id}
            resGuests={resGuests}
            guestIds={guestIds}
            locked={locked}
            reload={reload}
            flash={flash}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-1 sm:col-span-2">
              <label className="label">Notes / special instructions</label>
              <textarea className="input" rows={2} value={f.special_instructions} onChange={(e) => set('special_instructions', e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            {canManualCheckIn(res.status) ? (
              <button className="btn-primary flex-1 justify-center" onClick={doCheckIn}><LogIn size={16} /> {checkInAction.label}</button>
            ) : (
              <div className="text-sm text-forest font-semibold flex items-center gap-2">
                <BadgeCheck size={16} /> Checked in {res.checked_in_at && `· ${fmtDate(res.checked_in_at)}`} {res.checkin_by && `by ${res.checkin_by}`}
              </div>
            )}
            <button className="btn-amber flex-1 justify-center" onClick={openCard}><Printer size={16} /> Registration Card</button>
          </div>
          {checkInAction.hint && canManualCheckIn(res.status) && <p className="text-xs text-pine/50">{checkInAction.hint}</p>}
          <p className="text-xs text-pine/50">
            Advance on record: <span className="money font-semibold">{fmtBDT(payments.filter((p) => p.payment_class === 'ADVANCE').reduce((a, p) => a + +p.amount, 0))}</span> — shown on the card.
          </p>
        </div>
      </div>
    </>
  )
}

export default CheckInTab
