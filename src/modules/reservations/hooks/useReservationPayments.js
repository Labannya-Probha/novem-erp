import { useEffect, useState } from 'react'
import { getReservationPaymentCount } from '../services/paymentService'

export function useReservationPayments() {
  const [summary, setSummary] = useState({ total: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const total = await getReservationPaymentCount()
        if (!cancelled) setSummary({ total })
      } catch {
        if (!cancelled) setSummary({ total: null })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return { summary, loading }
}
