import { supabase } from '../supabase'

const PAYMENT_PREFIX = 'RP-DEMO'

export async function generateReservationPaymentNo() {
  let seq = null
  const { data, error } = await supabase.rpc('next_tenant_seq', { p_seq_name: 'reservation_payment' })
  if (!error && data !== null && data !== undefined) {
    seq = Number(data)
  }

  if (!seq || Number.isNaN(seq) || seq <= 0) {
    seq = Number(String(Date.now()).slice(-8))
  }

  return `${PAYMENT_PREFIX}-${String(seq).padStart(8, '0')}`
}

export function toPaymentReference(paymentNo, trxRef) {
  const cleanRef = (trxRef || '').trim()
  return cleanRef ? `${paymentNo} | ${cleanRef}` : paymentNo
}

export function parsePaymentReference(reference) {
  const raw = (reference || '').trim()
  if (!raw) return { paymentNo: '', reference: '' }

  const parts = raw.split('|').map((s) => s.trim())
  const first = parts[0] || ''
  if (/^RP-DEMO-\d{8,}$/.test(first)) {
    return {
      paymentNo: first,
      reference: parts.slice(1).join(' | '),
    }
  }

  return { paymentNo: '', reference: raw }
}
