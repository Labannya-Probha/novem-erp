import { useEffect, useMemo, useState } from 'react'
import { createAvailabilityFilters, getAvailabilityPreview } from '../services/availabilityService'

export function useAvailability(initialFilters) {
  const [filters, setFilters] = useState(() => createAvailabilityFilters(initialFilters))
  const [results, setResults] = useState([])
  const [roomTypeOptions, setRoomTypeOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const validationError = useMemo(() => {
    if (!filters.checkIn || !filters.checkOut) return 'Check-in and check-out are required.'
    if (filters.checkOut <= filters.checkIn) return 'Check-out must be after check-in.'
    return ''
  }, [filters.checkIn, filters.checkOut])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (validationError) {
        setResults([])
        setLoading(false)
        setError(validationError)
        return
      }

      setLoading(true)
      setError('')

      try {
        const preview = await getAvailabilityPreview(filters)
        if (cancelled) return
        setResults(preview.results)
        setRoomTypeOptions(preview.roomTypeOptions)
      } catch (loadError) {
        if (cancelled) return
        setResults([])
        setError(loadError?.message || 'Failed to load availability.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [filters, validationError])

  return {
    filters,
    setFilters,
    results,
    roomTypeOptions,
    loading,
    error,
  }
}
