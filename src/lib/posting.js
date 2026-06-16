// src/lib/posting.js
// ────────────────────────────────────────────────────────────────────────────
// THE SINGLE WRITE-PATH TO THE GENERAL LEDGER.
// Every module — POS sales, HR payroll, inventory stock-outs, night audit —
// posts through postJournal(). No module ever inserts into journal_entries /
// journal_lines directly. This calls the post_journal() Postgres RPC, which is
// atomic, balanced-checked, privilege-gated ('accounting.post'), blocked during
// maintenance mode, and audit-stamped — so a journal can never land
// half-written or out of balance.
// ────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase'

/**
 * Post a balanced journal entry to the ledger.
 *
 * @param {object}  p
 * @param {string} [p.jv_date]   'YYYY-MM-DD'. Defaults to today (server-side).
 * @param {string}  p.source     Origin module: 'POS' | 'NIGHT_AUDIT' | 'PAYROLL'
 *                               | 'INVENTORY' | 'MANUAL' | 'AR' | 'AP' ...
 * @param {string}  p.posted_by  User name/id, recorded on the entry + audit log.
 * @param {string} [p.narration] Free-text description.
 * @param {Array}   p.lines      [{ code | account_id, debit?, credit?, note? }]
 *                               Each line is debit XOR credit; the sum of debits
 *                               must equal the sum of credits.
 * @returns {Promise<string>}    The new journal_entries.id (uuid).
 *
 * @example
 *   // A restaurant sale of 500 + 25 VAT settled in cash:
 *   await postJournal({
 *     source: 'POS', posted_by: userName,
 *     narration: 'POS-2026-0042',
 *     lines: [
 *       { code: '100119', debit: 525 },   // Reception Cash
 *       { code: '400107', credit: 500 },  // Restaurant Sales
 *       { code: '200902', credit: 25 },   // VAT Output
 *     ],
 *   })
 */
export async function postJournal({ jv_date = null, source, posted_by, narration = null, lines }) {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new Error('A journal needs at least two lines.')
  }
  const { data, error } = await supabase.rpc('post_journal', {
    p_jv_date:   jv_date,
    p_narration: narration,
    p_source:    source,
    p_posted_by: posted_by,
    p_lines:     lines,
  })
  if (error) throw new Error(error.message)
  return data
}

/** Convenience: read the live maintenance-mode flag (for banners / guards). */
export async function isLocked() {
  const { data, error } = await supabase
    .from('company_settings').select('maintenance_mode').order('id').limit(1).single()
  if (error) return false
  return !!data?.maintenance_mode
}
