import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase and tenant modules so posting.js can be imported in Node
vi.mock('../supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}))

vi.mock('./tenant', () => ({
  getTenantId: vi.fn(() => 'test-tenant-id'),
}))

import { postJournal, isLocked } from './posting.js'
import { supabase } from '../supabase'
import { getTenantId } from './tenant'

describe('postJournal()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects if fewer than two lines are provided', async () => {
    await expect(
      postJournal({ source: 'POS', posted_by: 'user1', lines: [{ code: '100', debit: 100 }] }),
    ).rejects.toThrow('A journal needs at least two lines.')
  })

  it('rejects if lines is not an array', async () => {
    await expect(
      postJournal({ source: 'POS', posted_by: 'user1', lines: null }),
    ).rejects.toThrow('A journal needs at least two lines.')
  })

  it('calls supabase.rpc with correct parameters', async () => {
    const mockJvId = 'jv-uuid-1234'
    supabase.rpc.mockResolvedValue({ data: mockJvId, error: null })

    const result = await postJournal({
      source: 'POS',
      posted_by: 'cashier',
      narration: 'POS-2026-0001',
      lines: [
        { code: '100119', debit: 525 },
        { code: '400107', credit: 500 },
        { code: '200902', credit: 25 },
      ],
    })

    expect(supabase.rpc).toHaveBeenCalledWith('post_journal', {
      p_jv_date: null,
      p_narration: 'POS-2026-0001',
      p_source: 'POS',
      p_posted_by: 'cashier',
      p_lines: [
        { code: '100119', debit: 525 },
        { code: '400107', credit: 500 },
        { code: '200902', credit: 25 },
      ],
    })
    expect(result).toBe(mockJvId)
  })

  it('throws when the RPC returns an error', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'Journal is unbalanced' } })

    await expect(
      postJournal({
        source: 'PAYROLL',
        posted_by: 'hr-admin',
        lines: [
          { code: 'A', debit: 100 },
          { code: 'B', credit: 90 },
        ],
      }),
    ).rejects.toThrow('Journal is unbalanced')
  })

  it('passes optional jv_date through to the RPC', async () => {
    supabase.rpc.mockResolvedValue({ data: 'uuid-xyz', error: null })

    await postJournal({
      jv_date: '2026-06-30',
      source: 'MANUAL',
      posted_by: 'accountant',
      lines: [
        { code: 'D', debit: 200 },
        { code: 'C', credit: 200 },
      ],
    })

    expect(supabase.rpc).toHaveBeenCalledWith('post_journal', expect.objectContaining({
      p_jv_date: '2026-06-30',
    }))
  })
})

describe('isLocked()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns false when company_settings fetch errors', async () => {
    const singleMock = { data: null, error: { message: 'not found' } }
    const limitMock  = { single: vi.fn(() => Promise.resolve(singleMock)) }
    const eqMock     = { limit: vi.fn(() => limitMock) }
    const selectMock = { eq: vi.fn(() => eqMock) }
    supabase.from.mockReturnValue({ select: vi.fn(() => selectMock) })
    getTenantId.mockReturnValue('tenant-abc')

    const result = await isLocked()
    expect(result).toBe(false)
  })

  it('returns true when maintenance_mode is true', async () => {
    const singleMock = { data: { maintenance_mode: true }, error: null }
    const limitMock  = { single: vi.fn(() => Promise.resolve(singleMock)) }
    const eqMock     = { limit: vi.fn(() => limitMock) }
    const selectMock = { eq: vi.fn(() => eqMock) }
    supabase.from.mockReturnValue({ select: vi.fn(() => selectMock) })
    getTenantId.mockReturnValue('tenant-abc')

    const result = await isLocked()
    expect(result).toBe(true)
  })

  it('returns false when maintenance_mode is false', async () => {
    const singleMock = { data: { maintenance_mode: false }, error: null }
    const limitMock  = { single: vi.fn(() => Promise.resolve(singleMock)) }
    const eqMock     = { limit: vi.fn(() => limitMock) }
    const selectMock = { eq: vi.fn(() => eqMock) }
    supabase.from.mockReturnValue({ select: vi.fn(() => selectMock) })
    getTenantId.mockReturnValue('tenant-abc')

    const result = await isLocked()
    expect(result).toBe(false)
  })

  it('filters by tenant_id when one is available', async () => {
    const singleMock = { data: { maintenance_mode: false }, error: null }
    const limitMock  = { single: vi.fn(() => Promise.resolve(singleMock)) }
    const eqMock     = { limit: vi.fn(() => limitMock) }
    const selectMock = { eq: vi.fn(() => eqMock) }
    const fromSpy    = { select: vi.fn(() => selectMock) }
    supabase.from.mockReturnValue(fromSpy)
    getTenantId.mockReturnValue('my-tenant')

    await isLocked()
    expect(selectMock.eq).toHaveBeenCalledWith('tenant_id', 'my-tenant')
  })

  it('uses a fallback query (no eq filter) when tenant_id is null', async () => {
    const singleMock = { data: { maintenance_mode: false }, error: null }
    const limitMock  = { single: vi.fn(() => Promise.resolve(singleMock)) }
    const selectMock = { limit: vi.fn(() => limitMock) }
    supabase.from.mockReturnValue({ select: vi.fn(() => selectMock) })
    getTenantId.mockReturnValue(null)

    const result = await isLocked()
    expect(result).toBe(false)
    expect(selectMock.limit).toHaveBeenCalledWith(1)
  })
})
