import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

import { approvePayrollAndPostJv, generatePayrollJournal } from './generatePayrollJournal.js'
import { supabase } from '../supabase'

describe('approvePayrollAndPostJv()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls the approve_payroll_and_post_jv RPC with the correct run id', async () => {
    supabase.rpc.mockResolvedValue({ data: 'jv-uuid-approved', error: null })

    const result = await approvePayrollAndPostJv('run-id-001')

    expect(supabase.rpc).toHaveBeenCalledWith('approve_payroll_and_post_jv', {
      p_payroll_run_id: 'run-id-001',
    })
    expect(result).toBe('jv-uuid-approved')
  })

  it('throws a PostgrestError when the RPC returns an error', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: {
        message: 'Run is already APPROVED',
        code: 'P0001',
        details: null,
        hint: null,
      },
    })

    await expect(approvePayrollAndPostJv('run-id-002')).rejects.toMatchObject({
      name: 'PostgrestError',
      message: 'Run is already APPROVED',
      code: 'P0001',
    })
  })

  it('throws when payroll run has no payslips', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'No payslips found for this run', code: 'P0001', details: null, hint: null },
    })

    await expect(approvePayrollAndPostJv('run-id-empty')).rejects.toThrow('No payslips found')
  })
})

describe('generatePayrollJournal()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls the generate_payroll_journal RPC with the correct run id', async () => {
    supabase.rpc.mockResolvedValue({ data: 'jv-uuid-gen', error: null })

    const result = await generatePayrollJournal('run-id-003')

    expect(supabase.rpc).toHaveBeenCalledWith('generate_payroll_journal', {
      p_payroll_run_id: 'run-id-003',
    })
    expect(result).toBe('jv-uuid-gen')
  })

  it('throws when the run is not APPROVED', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Run is not APPROVED', code: 'P0001', details: null, hint: null },
    })

    await expect(generatePayrollJournal('run-id-draft')).rejects.toMatchObject({
      name: 'PostgrestError',
      message: 'Run is not APPROVED',
    })
  })

  it('is idempotent — returns existing jv_id on repeated calls', async () => {
    supabase.rpc.mockResolvedValue({ data: 'jv-uuid-existing', error: null })

    const first  = await generatePayrollJournal('run-id-already')
    const second = await generatePayrollJournal('run-id-already')

    expect(first).toBe('jv-uuid-existing')
    expect(second).toBe('jv-uuid-existing')
    expect(supabase.rpc).toHaveBeenCalledTimes(2)
  })
})
