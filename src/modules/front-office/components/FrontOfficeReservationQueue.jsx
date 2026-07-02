import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../supabase'
import { fmtDate, todayISO, STATUS_COLORS } from '../../../lib/helpers'

function roomsLabel(row) {
  const rooms = (row.reservation_rooms || [])
    .map((rr) => rr.rooms?.room_no || rr.rooms?.room_name)
    .filter(Boolean)
  return rooms.length ? rooms.join(', ') : '-'
}

export default function FrontOfficeReservationQueue({
  title,
  description,
  filter,
  empty,
  openReservation,
  targetTab,
}) {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(true)
  const today = todayISO()

  useEffect(() => {
    let mounted = true
    setBusy(true)
    supabase
      .from('reservations')
      .select('id,res_no,reservation_name,check_in,check_out,status,guests:primary_guest_id(full_name,phone),reservation_rooms(rooms(room_no,room_name))')
      .in('status', ['QUERY', 'QUOTED', 'CONFIRMED', 'CHECKED_IN'])
      .order('check_in', { ascending: false })
      .limit(250)
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) {
          console.error('FrontOfficeReservationQueue fetch error:', error)
          setRows([])
        } else {
          setRows(data || [])
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error('FrontOfficeReservationQueue unexpected error:', err)
          setRows([])
        }
      })
      .finally(() => {
        if (mounted) setBusy(false)
      })
    return () => { mounted = false }
  }, [])

  const visibleRows = useMemo(() => rows.filter((row) => filter(row, today)), [rows, filter, today])

  return (
    <div className="card p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h2 className="font-display text-lg font-bold text-pine">{title}</h2>
          {description && <p className="text-sm text-pine/55">{description}</p>}
        </div>
        <span className="status-chip bg-leaf/40 text-pine">{visibleRows.length} records</span>
      </div>

      {busy ? (
        <div className="text-sm text-pine/50">Loading...</div>
      ) : visibleRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-leaf p-8 text-center text-sm text-pine/50">{empty}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-pine/50 border-b border-leaf">
                <th className="py-2 pr-3 font-semibold">Guest</th>
                <th className="py-2 pr-3 font-semibold">Reservation</th>
                <th className="py-2 pr-3 font-semibold">Room</th>
                <th className="py-2 pr-3 font-semibold">Stay</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id} className="border-b border-leaf/50 last:border-0">
                  <td className="py-3 pr-3">
                    <div className="font-semibold text-ink">{row.reservation_name || row.guests?.full_name || '-'}</div>
                    <div className="text-xs text-pine/50">{row.guests?.phone || '-'}</div>
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs text-pine/70">{row.res_no}</td>
                  <td className="py-3 pr-3 text-pine/70">{roomsLabel(row)}</td>
                  <td className="py-3 pr-3 text-pine/70">{fmtDate(row.check_in)} to {fmtDate(row.check_out)}</td>
                  <td className="py-3 pr-3">
                    <span className={`status-chip ${STATUS_COLORS[row.status] || 'bg-stone-100 text-stone-600'}`}>
                      {row.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      className="btn-ghost !py-1.5 !text-xs"
                      onClick={() => openReservation(row.id, typeof targetTab === 'function' ? targetTab(row, today) : targetTab)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
