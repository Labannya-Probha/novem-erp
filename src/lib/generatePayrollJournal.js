// src/lib/generatePayrollJournal.js
// ────────────────────────────────────────────────────────────────────────────
// Payroll journal automation.
//
// Call generatePayrollJournal(payrollRunId) immediately after a payroll run is
// set to APPROVED.  The underlying Postgres RPC is atomic and idempotent:
//   • It verifies the run is APPROVED.
//   • It reads the PAYROLL entry from accounting_transaction_mapping to resolve
//     the debit (Salary Expense) and credit (Salary Payable) GL accounts.
//   • It aggregates SUM(gross_salary) and SUM(net_payable) from payslips.
//   • It inserts a balanced journal entry in journal_entries + journal_lines
//     (wrapped in a single PL/pgSQL transaction).
//   • It writes the new journal_entries.id back to payroll_runs.jv_id.
//   • Subsequent calls for the same run return the existing jv_id unchanged.
// ────────────────────────────────────────────────────────────────────────────
import { supabase } from '../supabase'

/**
 * Generate (or return the existing) payroll journal for an approved run.
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
