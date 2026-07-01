import { describe, it, expect } from 'vitest'
import {
  canManualCheckIn,
  getCheckInActionCopy,
  getNoShowCutoff,
  localISODate,
  shouldAutoNoShow,
  NO_SHOW_CUTOFF_HOUR,
  NO_SHOW_CUTOFF_MINUTE,
} from './noShowAutomation.js'

describe('constants', () => {
  it('cutoff is 12:05', () => {
    expect(NO_SHOW_CUTOFF_HOUR).toBe(12)
    expect(NO_SHOW_CUTOFF_MINUTE).toBe(5)
  })
})

describe('localISODate()', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(localISODate(new Date('2026-06-24T08:00:00'))).toBe('2026-06-24')
  })

  it('uses today by default (result is a valid date string)', () => {
    expect(localISODate()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('getNoShowCutoff()', () => {
  it('returns a Date set to 12:05 on the given check-in date', () => {
    const cutoff = getNoShowCutoff('2026-06-24')
    expect(cutoff.getHours()).toBe(12)
    expect(cutoff.getMinutes()).toBe(5)
    expect(cutoff.getSeconds()).toBe(0)
  })
})

describe('shouldAutoNoShow()', () => {
  it('returns false before 12:05', () => {
    expect(
      shouldAutoNoShow(
        { status: 'CONFIRMED', check_in: '2026-06-24' },
        new Date('2026-06-24T12:04:59'),
      ),
    ).toBe(false)
  })

  it('returns true at exactly 12:05', () => {
    expect(
      shouldAutoNoShow(
        { status: 'CONFIRMED', check_in: '2026-06-24' },
        new Date('2026-06-24T12:05:00'),
      ),
    ).toBe(true)
  })

  it('returns true after 12:05 on check-in day', () => {
    expect(
      shouldAutoNoShow(
        { status: 'CONFIRMED', check_in: '2026-06-24' },
        new Date('2026-06-24T14:00:00'),
      ),
    ).toBe(true)
  })

  it('returns false if check_in date is different from today', () => {
    // Future booking — not yet due
    expect(
      shouldAutoNoShow(
        { status: 'CONFIRMED', check_in: '2026-06-25' },
        new Date('2026-06-24T14:00:00'),
      ),
    ).toBe(false)
    // Yesterday's booking — already should have been handled
    expect(
      shouldAutoNoShow(
        { status: 'CONFIRMED', check_in: '2026-06-23' },
        new Date('2026-06-24T14:00:00'),
      ),
    ).toBe(false)
  })

  it('returns false for CHECKED_IN even after 12:05', () => {
    expect(
      shouldAutoNoShow(
        { status: 'CHECKED_IN', check_in: '2026-06-24' },
        new Date('2026-06-24T14:00:00'),
      ),
    ).toBe(false)
  })

  it('returns false for CHECKED_OUT', () => {
    expect(
      shouldAutoNoShow(
        { status: 'CHECKED_OUT', check_in: '2026-06-24' },
        new Date('2026-06-24T14:00:00'),
      ),
    ).toBe(false)
  })

  it('returns false for NO_SHOW (already transitioned)', () => {
    expect(
      shouldAutoNoShow(
        { status: 'NO_SHOW', check_in: '2026-06-24' },
        new Date('2026-06-24T14:00:00'),
      ),
    ).toBe(false)
  })

  it('returns false when check_in is missing', () => {
    expect(
      shouldAutoNoShow(
        { status: 'CONFIRMED', check_in: null },
        new Date('2026-06-24T14:00:00'),
      ),
    ).toBe(false)
  })
})

describe('canManualCheckIn()', () => {
  it('returns true for CONFIRMED', () => expect(canManualCheckIn('CONFIRMED')).toBe(true))
  it('returns true for NO_SHOW (staff override)', () => expect(canManualCheckIn('NO_SHOW')).toBe(true))
  it('returns false for CHECKED_IN', () => expect(canManualCheckIn('CHECKED_IN')).toBe(false))
  it('returns false for CHECKED_OUT', () => expect(canManualCheckIn('CHECKED_OUT')).toBe(false))
  it('returns false for SETTLED', () => expect(canManualCheckIn('SETTLED')).toBe(false))
})

describe('getCheckInActionCopy()', () => {
  it('returns override copy for NO_SHOW', () => {
    const { label, hint } = getCheckInActionCopy('NO_SHOW')
    expect(label).toBe('Override no-show & check in')
    expect(hint).toContain('12:05')
  })

  it('returns default copy for CONFIRMED', () => {
    const { label, hint } = getCheckInActionCopy('CONFIRMED')
    expect(label).toBe('Check in guest')
    expect(hint).toBe('')
  })
})
