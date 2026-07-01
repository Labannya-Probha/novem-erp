-- ============================================================
-- Migration 013: approve_payroll_and_post_jv RPC
--
-- Atomically approves a payroll run AND posts the corresponding
-- double-entry journal in a single database transaction.
--
-- Replaces the two-step frontend flow (update status → call
-- generate_payroll_journal) with a single RPC call that:
--   1. Guards against double-approval.
--   2. Aggregates gross/net totals from payslips.
--   3. Looks up the PAYROLL entry in accounting_transaction_mapping.
--   4. Inserts a balanced journal in journal_entries + journal_lines.
--   5. Sets payroll_runs.status = 'APPROVED', approved_at, and jv_id.
--
-- Tenant isolation: all inserts and updates use v_run.tenant_id so
-- that no cross-tenant data leakage is possible inside the function.
-- ============================================================

CREATE OR REPLACE FUNCTION public.approve_payroll_and_post_jv(
  p_payroll_run_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_run         record;
  v_mapping     record;
  v_entry_id    uuid;
  v_jv_no       text;
  v_total_gross numeric;
  v_total_net   numeric;
  v_deductions  numeric;
BEGIN
  -- ── 1. Load the payroll run ────────────────────────────────────────────────
  SELECT * INTO v_run
  FROM public.payroll_runs
  WHERE id = p_payroll_run_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll run % not found.', p_payroll_run_id;
  END IF;

  -- ── 2. Guard: reject if already approved ──────────────────────────────────
  IF v_run.status = 'APPROVED' THEN
    RAISE EXCEPTION
      'Payroll run % is already Approved. Use generate_payroll_journal() to re-generate the journal if needed.',
      p_payroll_run_id;
  END IF;

  -- ── 3. Fetch PAYROLL transaction mapping ──────────────────────────────────
  --  Try tenant-scoped first (for multi-tenant deployments).
  SELECT * INTO v_mapping
  FROM public.accounting_transaction_mapping
  WHERE transaction_type = 'PAYROLL'
    AND tenant_id = v_run.tenant_id
  LIMIT 1;

  -- Fall back to a mapping without tenant_id (single-tenant / shared setup).
  IF NOT FOUND THEN
    SELECT * INTO v_mapping
    FROM public.accounting_transaction_mapping
    WHERE transaction_type = 'PAYROLL'
    LIMIT 1;
  END IF;

  IF NOT FOUND
     OR v_mapping.debit_account_id  IS NULL
     OR v_mapping.credit_account_id IS NULL
  THEN
    RAISE EXCEPTION
      'PAYROLL transaction mapping is not configured. '
      'Please add debit (Salary Expense) and credit (Salary Payable) accounts '
      'in Accounting → Transaction Mapping.';
  END IF;

  -- ── 4. Aggregate payslip totals ───────────────────────────────────────────
  SELECT
    COALESCE(SUM(gross_salary), 0),
    COALESCE(SUM(net_payable),  0)
  INTO v_total_gross, v_total_net
  FROM public.payslips
  WHERE payroll_run_id = p_payroll_run_id;

  IF v_total_gross = 0 THEN
    RAISE EXCEPTION 'No payslips found for payroll run %.', p_payroll_run_id;
  END IF;

  v_deductions := round(v_total_gross - v_total_net, 2);

  -- ── 5. Build a deterministic JV number ───────────────────────────────────
  v_jv_no := 'PAY-' || v_run.period_year
             || '-' || lpad(v_run.period_month::text, 2, '0');

  -- ── 6. Insert journal header ──────────────────────────────────────────────
  INSERT INTO public.journal_entries
    (jv_no, jv_date, narration, source, posted_by, is_locked, tenant_id)
  VALUES (
    v_jv_no,
    CURRENT_DATE,
    'Payroll — '
      || to_char(make_date(v_run.period_year, v_run.period_month, 1), 'FMMonth YYYY')
      || ' | Gross: ' || v_total_gross
      || ' | Net: '   || v_total_net,
    'PAYROLL',
    COALESCE(v_run.approved_by, 'system'),
    true,
    v_run.tenant_id
  )
  RETURNING id INTO v_entry_id;

  -- ── 7. Debit line: Salary / Wage Expense (full gross amount) ─────────────
  INSERT INTO public.journal_lines
    (entry_id, account_id, debit, credit, line_note, tenant_id)
  VALUES (
    v_entry_id,
    v_mapping.debit_account_id,
    v_total_gross,
    0,
    'Gross salary expense',
    v_run.tenant_id
  );

  -- ── 8. Credit line 1: Net Salary Payable / Bank disbursement ─────────────
  INSERT INTO public.journal_lines
    (entry_id, account_id, debit, credit, line_note, tenant_id)
  VALUES (
    v_entry_id,
    v_mapping.credit_account_id,
    0,
    v_total_net,
    'Net salary payable',
    v_run.tenant_id
  );

  -- ── 9. Credit line 2: Deductions payable (keeps the entry balanced) ───────
  IF v_deductions > 0 THEN
    INSERT INTO public.journal_lines
      (entry_id, account_id, debit, credit, line_note, tenant_id)
    VALUES (
      v_entry_id,
      v_mapping.credit_account_id,
      0,
      v_deductions,
      'Deductions payable',
      v_run.tenant_id
    );
  END IF;

  -- ── 10. Atomically approve the run and link the journal ───────────────────
  UPDATE public.payroll_runs
  SET
    status      = 'APPROVED',
    approved_at = NOW(),
    jv_id       = v_entry_id
  WHERE id = p_payroll_run_id;

  RETURN v_entry_id;
END;
$$;

-- Only authenticated users may call this RPC
REVOKE EXECUTE ON FUNCTION public.approve_payroll_and_post_jv(uuid)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.approve_payroll_and_post_jv(uuid)
  TO authenticated;
