-- ============================================================
-- Migration 012: Accounting Automation
--   1. Payment trigger  — auto-post journal on payments INSERT
--   2. Payroll RPC      — generate_payroll_journal(uuid)
--   3. Generic RPC      — post_journal(…) used by src/lib/posting.js
-- ============================================================
-- SAFETY: no existing columns are dropped or altered.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- PART 1 — jv_id link on payroll_runs
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS jv_id uuid REFERENCES public.journal_entries(id);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_jv_id ON public.payroll_runs (jv_id);

-- ─────────────────────────────────────────────────────────────
-- PART 2 — post_journal() generic RPC
--
-- Called by src/lib/posting.js:
--   supabase.rpc('post_journal', { p_jv_date, p_narration,
--                                  p_source, p_posted_by, p_lines })
-- p_lines is JSONB array of:
--   { account_id?: uuid, code?: text, debit?: numeric,
--     credit?: numeric, note?: text }
-- Returns the new journal_entries.id (uuid).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_journal(
  p_jv_date   date    DEFAULT NULL,
  p_narration text    DEFAULT NULL,
  p_source    text    DEFAULT NULL,
  p_posted_by text    DEFAULT NULL,
  p_lines     jsonb   DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entry_id  uuid;
  v_line      jsonb;
  v_acct_id   uuid;
  v_debit     numeric;
  v_credit    numeric;
  v_total_dr  numeric := 0;
  v_total_cr  numeric := 0;
  v_jv_no     text;
  v_seq       bigint;
  v_tid       uuid;
BEGIN
  -- Minimum two lines
  IF jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'A journal entry requires at least 2 lines.';
  END IF;

  -- Balance check
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_total_dr := v_total_dr + COALESCE((v_line->>'debit')::numeric,  0);
    v_total_cr := v_total_cr + COALESCE((v_line->>'credit')::numeric, 0);
  END LOOP;
  IF round(v_total_dr, 2) <> round(v_total_cr, 2) THEN
    RAISE EXCEPTION 'Journal not balanced: debits=% credits=%', v_total_dr, v_total_cr;
  END IF;

  -- Tenant context (current user's tenant)
  BEGIN
    v_tid := public.current_tenant_id();
  EXCEPTION WHEN OTHERS THEN
    v_tid := NULL;
  END;

  -- JV number — use tenant sequence with timestamp fallback
  BEGIN
    SELECT public.next_tenant_seq('jv_no_seq') INTO v_seq;
    v_jv_no := 'JV-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(v_seq::text, 6, '0');
  EXCEPTION WHEN OTHERS THEN
    v_jv_no := 'JV-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || substr(gen_random_uuid()::text, 1, 4);
  END;

  -- Insert header
  INSERT INTO public.journal_entries
    (jv_no, jv_date, narration, source, posted_by, is_locked, tenant_id)
  VALUES
    (v_jv_no, COALESCE(p_jv_date, CURRENT_DATE), p_narration,
     p_source, p_posted_by, true, v_tid)
  RETURNING id INTO v_entry_id;

  -- Insert lines
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    -- Resolve account: by UUID or by COA code
    IF (v_line->>'account_id') IS NOT NULL AND (v_line->>'account_id') <> '' THEN
      v_acct_id := (v_line->>'account_id')::uuid;
    ELSIF (v_line->>'code') IS NOT NULL AND (v_line->>'code') <> '' THEN
      SELECT id INTO v_acct_id
      FROM public.chart_of_accounts
      WHERE code = (v_line->>'code') AND is_active = true
      LIMIT 1;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Account code % not found in chart of accounts', v_line->>'code';
      END IF;
    ELSE
      RAISE EXCEPTION 'Each journal line must have account_id or code';
    END IF;

    v_debit  := COALESCE((v_line->>'debit')::numeric,  0);
    v_credit := COALESCE((v_line->>'credit')::numeric, 0);

    INSERT INTO public.journal_lines
      (entry_id, account_id, debit, credit, line_note, tenant_id)
    VALUES
      (v_entry_id, v_acct_id, v_debit, v_credit,
       v_line->>'note', v_tid);
  END LOOP;

  RETURN v_entry_id;
END;
$$;

-- Only authenticated users may call post_journal
REVOKE EXECUTE ON FUNCTION public.post_journal(date, text, text, text, jsonb)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.post_journal(date, text, text, text, jsonb)
  TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- PART 3 — Payment trigger
--
-- After every INSERT on public.payments, look up the matching
-- accounting_transaction_mapping entry (PAYMENT_<METHOD> first,
-- then the generic PAYMENT fallback) and atomically write the
-- double-entry journal.  Silently skips if:
--   • amount = 0
--   • no mapping row found
--   • debit_account_id or credit_account_id is NULL
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_payment_journal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mapping  record;
  v_entry_id uuid;
  v_jv_no    text;
  v_amt      numeric;
BEGIN
  v_amt := COALESCE(NEW.amount, 0);
  IF v_amt = 0 THEN RETURN NEW; END IF;

  -- 1. Try method-specific mapping (e.g. PAYMENT_CASH, PAYMENT_BKASH)
  SELECT * INTO v_mapping
  FROM public.accounting_transaction_mapping
  WHERE transaction_type = 'PAYMENT_' || UPPER(COALESCE(NEW.method, ''))
  LIMIT 1;

  -- 2. Fall back to the generic PAYMENT mapping
  IF NOT FOUND THEN
    SELECT * INTO v_mapping
    FROM public.accounting_transaction_mapping
    WHERE transaction_type = 'PAYMENT'
    LIMIT 1;
  END IF;

  -- 3. Skip silently if no usable mapping
  IF NOT FOUND
     OR v_mapping.debit_account_id  IS NULL
     OR v_mapping.credit_account_id IS NULL
  THEN
    RETURN NEW;
  END IF;

  -- Unique JV number — timestamp + first 8 chars of payment UUID
  v_jv_no := 'PMT-' || to_char(now(), 'YYYYMMDD') || '-'
             || upper(substr(NEW.id::text, 1, 8));

  -- Insert journal header
  INSERT INTO public.journal_entries
    (jv_no, jv_date, narration, source, posted_by, is_locked, tenant_id)
  VALUES (
    v_jv_no,
    COALESCE(NEW.received_date::date, CURRENT_DATE),
    'Payment received — '
      || COALESCE(NEW.method, '')
      || CASE WHEN NEW.reference IS NOT NULL
              THEN ' / ' || NEW.reference
              ELSE '' END,
    'PAYMENT',
    COALESCE(NEW.received_by, 'system'),
    true,
    NEW.tenant_id
  )
  RETURNING id INTO v_entry_id;

  -- Insert balancing lines (handle refunds via negative amount)
  IF v_amt > 0 THEN
    -- Normal payment: Dr cash/bank account, Cr accounts-receivable / revenue
    INSERT INTO public.journal_lines
      (entry_id, account_id, debit, credit, line_note, tenant_id)
    VALUES
      (v_entry_id, v_mapping.debit_account_id,  v_amt, 0,     'Payment received — debit',  NEW.tenant_id),
      (v_entry_id, v_mapping.credit_account_id, 0,     v_amt, 'Payment received — credit', NEW.tenant_id);
  ELSE
    -- Refund / reversal: swap Dr/Cr
    INSERT INTO public.journal_lines
      (entry_id, account_id, debit, credit, line_note, tenant_id)
    VALUES
      (v_entry_id, v_mapping.credit_account_id, ABS(v_amt), 0,          'Refund — debit',  NEW.tenant_id),
      (v_entry_id, v_mapping.debit_account_id,  0,          ABS(v_amt), 'Refund — credit', NEW.tenant_id);
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger function must not be directly callable by client roles
REVOKE EXECUTE ON FUNCTION public.trg_payment_journal()
  FROM PUBLIC, anon, authenticated;

-- Attach trigger (idempotent)
DROP TRIGGER IF EXISTS trg_after_payment_insert ON public.payments;
CREATE TRIGGER trg_after_payment_insert
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_payment_journal();

-- ─────────────────────────────────────────────────────────────
-- PART 4 — generate_payroll_journal(p_payroll_run_id uuid)
--
-- Called from the front-end (src/lib/generatePayrollJournal.js)
-- after a payroll run is approved.
--
-- Logic:
--   • Verifies run is APPROVED
--   • Idempotent — returns existing jv_id if already generated
--   • Looks up PAYROLL mapping in accounting_transaction_mapping
--   • Computes SUM(gross_salary) and SUM(net_payable) from payslips
--   • Posts a balanced journal:
--       Dr  Salary Expense account  =  gross_salary total
--       Cr  Salary Payable account  =  net_payable  total
--       Cr  Deductions Payable      =  gross − net  (if > 0, same credit account)
--   • UPDATEs payroll_runs.jv_id
--   • Returns the new journal_entries.id
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_payroll_journal(
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
  -- Fetch the run
  SELECT * INTO v_run
  FROM public.payroll_runs
  WHERE id = p_payroll_run_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll run % not found.', p_payroll_run_id;
  END IF;

  -- Must be APPROVED
  IF v_run.status <> 'APPROVED' THEN
    RAISE EXCEPTION 'Payroll run must be APPROVED before generating a journal (current status: %).', v_run.status;
  END IF;

  -- Idempotency: return existing journal if already generated
  IF v_run.jv_id IS NOT NULL THEN
    RETURN v_run.jv_id;
  END IF;

  -- Fetch PAYROLL mapping
  SELECT * INTO v_mapping
  FROM public.accounting_transaction_mapping
  WHERE transaction_type = 'PAYROLL'
  LIMIT 1;

  IF NOT FOUND
     OR v_mapping.debit_account_id  IS NULL
     OR v_mapping.credit_account_id IS NULL
  THEN
    RAISE EXCEPTION 'PAYROLL transaction mapping is not configured. '
      'Please add it in Accounting → Transaction Mapping.';
  END IF;

  -- Aggregate payslip totals
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

  -- JV number: PAY-YYYY-MM
  v_jv_no := 'PAY-' || v_run.period_year
             || '-' || lpad(v_run.period_month::text, 2, '0');

  -- Insert journal header
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

  -- Debit line: Salary / Wage Expense  (full gross)
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

  -- Credit line 1: Net Salary Payable / Cash disbursement
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

  -- Credit line 2: Deductions payable (keeps the entry balanced)
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

  -- Link the journal back to the payroll run
  UPDATE public.payroll_runs
  SET jv_id = v_entry_id
  WHERE id = p_payroll_run_id;

  RETURN v_entry_id;
END;
$$;

-- Only authenticated users may call this RPC
REVOKE EXECUTE ON FUNCTION public.generate_payroll_journal(uuid)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.generate_payroll_journal(uuid)
  TO authenticated;
