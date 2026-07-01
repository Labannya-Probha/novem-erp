-- ============================================================
-- Migration 014: Harden payroll journal posting
--   1. Seed default PAYROLL transaction mapping row
--   2. Balance payroll journals for deductions/allowances
-- ============================================================

DO $$
DECLARE
  v_columns text := 'transaction_type';
  v_values  text := quote_literal('PAYROLL');
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'accounting_transaction_mapping'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'accounting_transaction_mapping'
        AND column_name = 'label'
    ) THEN
      v_columns := v_columns || ', label';
      v_values := v_values || ', ' || quote_literal('Payroll');
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'accounting_transaction_mapping'
        AND column_name = 'notes'
    ) THEN
      v_columns := v_columns || ', notes';
      v_values := v_values || ', ' || quote_literal('Seeded default mapping row for payroll journals. Configure debit and credit accounts in Accounting → Transaction Mapping.');
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'accounting_transaction_mapping'
        AND column_name = 'created_by'
    ) THEN
      v_columns := v_columns || ', created_by';
      v_values := v_values || ', ' || quote_literal('system');
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'accounting_transaction_mapping'
        AND column_name = 'updated_by'
    ) THEN
      v_columns := v_columns || ', updated_by';
      v_values := v_values || ', ' || quote_literal('system');
    END IF;

    EXECUTE format(
      'INSERT INTO public.accounting_transaction_mapping (%1$s)
       SELECT %2$s
       WHERE NOT EXISTS (
         SELECT 1
         FROM public.accounting_transaction_mapping
         WHERE transaction_type = %3$L
       )',
      v_columns,
      v_values,
      'PAYROLL'
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_payroll_journal(
  p_payroll_run_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_run                   record;
  v_mapping               record;
  v_entry_id              uuid;
  v_jv_no                 text;
  v_total_gross           numeric;
  v_total_net             numeric;
  v_total_other_allowance numeric;
  v_total_deductions      numeric;
  v_total_expense         numeric;
  v_balance_delta         numeric;
BEGIN
  SELECT * INTO v_run
  FROM public.payroll_runs
  WHERE id = p_payroll_run_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll run % not found.', p_payroll_run_id;
  END IF;

  IF v_run.status <> 'APPROVED' THEN
    RAISE EXCEPTION 'Payroll run must be APPROVED before generating a journal (current status: %).', v_run.status;
  END IF;

  IF v_run.jv_id IS NOT NULL THEN
    RETURN v_run.jv_id;
  END IF;

  SELECT * INTO v_mapping
  FROM public.accounting_transaction_mapping
  WHERE transaction_type = 'PAYROLL'
    AND tenant_id = v_run.tenant_id
  LIMIT 1;

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
    RAISE EXCEPTION 'PAYROLL transaction mapping is not configured. '
      'Please add debit (Salary Expense) and credit (Salary Payable) accounts '
      'in Accounting → Transaction Mapping.';
  END IF;

  SELECT
    COALESCE(SUM(gross_salary), 0),
    COALESCE(SUM(net_payable), 0),
    COALESCE(SUM(other_allowance), 0),
    COALESCE(SUM(
      COALESCE(absent_deduction, 0)
      + COALESCE(advance_deduction, 0)
      + COALESCE(other_deduction, 0)
    ), 0)
  INTO
    v_total_gross,
    v_total_net,
    v_total_other_allowance,
    v_total_deductions
  FROM public.payslips
  WHERE payroll_run_id = p_payroll_run_id;

  IF v_total_gross = 0 AND v_total_other_allowance = 0 THEN
    RAISE EXCEPTION 'No payslips found for payroll run %.', p_payroll_run_id;
  END IF;

  v_total_expense := round(v_total_gross + v_total_other_allowance, 2);
  v_balance_delta := round(v_total_expense - (v_total_net + v_total_deductions), 2);

  v_jv_no := 'PAY-' || v_run.period_year
             || '-' || lpad(v_run.period_month::text, 2, '0');

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

  INSERT INTO public.journal_lines
    (entry_id, account_id, debit, credit, line_note, tenant_id)
  VALUES (
    v_entry_id,
    v_mapping.debit_account_id,
    v_total_expense,
    0,
    CASE
      WHEN v_total_other_allowance > 0 THEN 'Payroll expense incl. allowances'
      ELSE 'Gross salary expense'
    END,
    v_run.tenant_id
  );

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

  IF v_total_deductions > 0 THEN
    INSERT INTO public.journal_lines
      (entry_id, account_id, debit, credit, line_note, tenant_id)
    VALUES (
      v_entry_id,
      v_mapping.credit_account_id,
      0,
      v_total_deductions,
      'Payroll deductions clearing',
      v_run.tenant_id
    );
  END IF;

  IF v_balance_delta > 0 THEN
    INSERT INTO public.journal_lines
      (entry_id, account_id, debit, credit, line_note, tenant_id)
    VALUES (
      v_entry_id,
      v_mapping.credit_account_id,
      0,
      v_balance_delta,
      'Payroll balancing credit',
      v_run.tenant_id
    );
  ELSIF v_balance_delta < 0 THEN
    INSERT INTO public.journal_lines
      (entry_id, account_id, debit, credit, line_note, tenant_id)
    VALUES (
      v_entry_id,
      v_mapping.debit_account_id,
      ABS(v_balance_delta),
      0,
      'Payroll balancing debit',
      v_run.tenant_id
    );
  END IF;

  UPDATE public.payroll_runs
  SET jv_id = v_entry_id
  WHERE id = p_payroll_run_id;

  RETURN v_entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_payroll_and_post_jv(
  p_payroll_run_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_run                   record;
  v_mapping               record;
  v_entry_id              uuid;
  v_jv_no                 text;
  v_total_gross           numeric;
  v_total_net             numeric;
  v_total_other_allowance numeric;
  v_total_deductions      numeric;
  v_total_expense         numeric;
  v_balance_delta         numeric;
BEGIN
  SELECT * INTO v_run
  FROM public.payroll_runs
  WHERE id = p_payroll_run_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll run % not found.', p_payroll_run_id;
  END IF;

  IF v_run.status = 'APPROVED' THEN
    RAISE EXCEPTION
      'Payroll run % is already Approved. Use generate_payroll_journal() to re-generate the journal if needed.',
      p_payroll_run_id;
  END IF;

  SELECT * INTO v_mapping
  FROM public.accounting_transaction_mapping
  WHERE transaction_type = 'PAYROLL'
    AND tenant_id = v_run.tenant_id
  LIMIT 1;

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

  SELECT
    COALESCE(SUM(gross_salary), 0),
    COALESCE(SUM(net_payable), 0),
    COALESCE(SUM(other_allowance), 0),
    COALESCE(SUM(
      COALESCE(absent_deduction, 0)
      + COALESCE(advance_deduction, 0)
      + COALESCE(other_deduction, 0)
    ), 0)
  INTO
    v_total_gross,
    v_total_net,
    v_total_other_allowance,
    v_total_deductions
  FROM public.payslips
  WHERE payroll_run_id = p_payroll_run_id;

  IF v_total_gross = 0 AND v_total_other_allowance = 0 THEN
    RAISE EXCEPTION 'No payslips found for payroll run %.', p_payroll_run_id;
  END IF;

  v_total_expense := round(v_total_gross + v_total_other_allowance, 2);
  v_balance_delta := round(v_total_expense - (v_total_net + v_total_deductions), 2);

  v_jv_no := 'PAY-' || v_run.period_year
             || '-' || lpad(v_run.period_month::text, 2, '0');

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

  INSERT INTO public.journal_lines
    (entry_id, account_id, debit, credit, line_note, tenant_id)
  VALUES (
    v_entry_id,
    v_mapping.debit_account_id,
    v_total_expense,
    0,
    CASE
      WHEN v_total_other_allowance > 0 THEN 'Payroll expense incl. allowances'
      ELSE 'Gross salary expense'
    END,
    v_run.tenant_id
  );

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

  IF v_total_deductions > 0 THEN
    INSERT INTO public.journal_lines
      (entry_id, account_id, debit, credit, line_note, tenant_id)
    VALUES (
      v_entry_id,
      v_mapping.credit_account_id,
      0,
      v_total_deductions,
      'Payroll deductions clearing',
      v_run.tenant_id
    );
  END IF;

  IF v_balance_delta > 0 THEN
    INSERT INTO public.journal_lines
      (entry_id, account_id, debit, credit, line_note, tenant_id)
    VALUES (
      v_entry_id,
      v_mapping.credit_account_id,
      0,
      v_balance_delta,
      'Payroll balancing credit',
      v_run.tenant_id
    );
  ELSIF v_balance_delta < 0 THEN
    INSERT INTO public.journal_lines
      (entry_id, account_id, debit, credit, line_note, tenant_id)
    VALUES (
      v_entry_id,
      v_mapping.debit_account_id,
      ABS(v_balance_delta),
      0,
      'Payroll balancing debit',
      v_run.tenant_id
    );
  END IF;

  UPDATE public.payroll_runs
  SET
    status      = 'APPROVED',
    approved_at = NOW(),
    jv_id       = v_entry_id
  WHERE id = p_payroll_run_id;

  RETURN v_entry_id;
END;
$$;
