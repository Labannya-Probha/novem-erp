import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canManualCheckIn,
  getCheckInActionCopy,
  shouldAutoNoShow,
} from './noShowAutomation.js'

test('before 12:05 no confirmed booking is auto no-show', () => {
  assert.equal(
    shouldAutoNoShow(
      { status: 'CONFIRMED', check_in: '2026-06-24' },
      new Date('2026-06-24T12:04:59'),
    ),
    false,
  )
})

test('after 12:05 same-day confirmed booking becomes eligible for auto no-show', () => {
  assert.equal(
    shouldAutoNoShow(
      { status: 'CONFIRMED', check_in: '2026-06-24' },
      new Date('2026-06-24T12:05:00'),
    ),
    true,
  )
})

test('already checked-in booking is never auto no-showed', () => {
  assert.equal(
    shouldAutoNoShow(
      { status: 'CHECKED_IN', check_in: '2026-06-24' },
      new Date('2026-06-24T13:00:00'),
    ),
    false,
  )
})

test('manual check-in remains available for no-show bookings', () => {
  assert.equal(canManualCheckIn('NO_SHOW'), true)
  assert.deepEqual(getCheckInActionCopy('NO_SHOW'), {
    label: 'Override no-show & check in',
    hint: 'Auto no-show after 12:05 PM can still be manually overridden by staff check-in.',
  })
})
