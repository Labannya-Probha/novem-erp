// src/lib/generatePayrollJournal.js
// ────────────────────────────────────────────────────────────────────────────
// Payroll journal automation.
//
// approvePayrollAndPostJv(payrollRunId) — preferred, atomic RPC.
//   Approves the run AND posts the double-entry journal in a single database
//   transaction via the approve_payroll_and_post_jv Postgres function:
//   • Rejects if the run is already APPROVED.
//   • Reads PAYROLL entry from accounting_transaction_mapping.
//   • Aggregates SUM(gross_salary) and SUM(net_payable) from payslips.
//   • Inserts a balanced journal in journal_entries + journal_lines.
//   • Sets payroll_runs.status = 'APPROVED', approved_at, and jv_id atomically.
//
// generatePayrollJournal(payrollRunId) — legacy helper (kept for compatibility).
//   Call this when a run is already APPROVED and only the journal is missing.
//   The underlying RPC is idempotent: subsequent calls return the existing jv_id.
// ────────────────────────────────────────────────────────────────────────────
import { supabase } from '../supabase'

/**
 * Atomically approve a payroll run and post its double-entry journal.
 *
 * @param {string} payrollRunId  UUID of the payroll_runs row.
 * @returns {Promise<string>}    The new journal_entries.id (uuid).
 * @throws {Error}               If the run is already Approved, has no payslips,
 *                               or the PAYROLL mapping is not configured.
 */
export async function approvePayrollAndPostJv(payrollRunId) {
  const { data, error } = await supabase.rpc('approve_payroll_and_post_jv', {
    p_payroll_run_id: payrollRunId,
  })
  if (error) throw new Error(error.message)
  return data
}

/**
 * Generate (or return the existing) payroll journal for an already-approved run.
 *
 * @param {string} payrollRunId  UUID of the payroll_runs row.
 * @returns {Promise<string>}    The journal_entries.id (uuid).
 * @throws {Error}               If the run is not APPROVED, has no payslips,
 *                               or the PAYROLL mapping is not configured.
 */
export async function generatePayrollJournal(payrollRunId) {
  const { data, error } = await supabase.rpc('generate_payroll_journal', {
    p_payroll_run_id: payrollRunId,
  })
  if (error) throw new Error(error.message)
  return data
}
