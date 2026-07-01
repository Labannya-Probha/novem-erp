-- Revoke SELECT from the anon role on every public-schema object so that none
-- of them are discoverable in the GraphQL schema before a user signs in.
-- Addresses Supabase linter warning: pg_graphql_anon_table_exposed (lint 0026).
--
-- Each REVOKE is wrapped in its own exception handler so the migration is safe
-- to run even if a listed table/view does not yet exist in the target database.

DO $$
DECLARE
  obj text;
  objects text[] := ARRAY[
    -- Core hotel / reservation tables
    'reservations',
    'reservation_rooms',
    'reservation_addons',
    'reservation_guests',
    'rooms',
    'properties',
    'folio_charges',
    'payments',
    'invoices',
    'quotations',
    'guests',
    'guest_ids',
    'loyalty_ledger',
    'night_audits',
    'day_closes',

    -- Food & beverage / facility tables
    'menu_categories',
    'menu_items',
    'recipe_items',
    'facility_items',
    'facility_sales',
    'pos_orders',
    'pos_order_items',

    -- Inventory / procurement tables
    'inv_items',
    'store_locations',
    'stock_transfers',
    'stock_returns',
    'transfer_items',
    'return_items',
    'purchase_orders',
    'po_items',
    'goods_receipts',
    'grn_items',
    'requisitions',
    'requisition_items',
    'consumption_entries',
    'consumption_lines',

    -- HR / payroll tables
    'employees',
    'attendance_records',
    'leave_types',
    'leave_applications',
    'comp_leave_register',
    'allowance_config',
    'payroll_runs',
    'payslips',
    'employee_compliance_records',
    'statutory_filings',
    'statutory_compliance_items',
    'task_categories',
    'tasks',

    -- Finance / accounting tables
    'chart_of_accounts',
    'journal_entries',
    'journal_lines',
    'accounting_transaction_mapping',
    'fixed_assets',
    'asset_depreciation',
    'tax_config',
    'vat_purchase_register',
    'vat_sales_register',
    'vds_certificates',
    'vendor_payments',
    'vendors',

    -- Company / admin tables
    'companies',
    'company_settings',
    'agencies',
    'shareholders',
    'app_users',
    'admin_feature_access',
    'role_privileges',
    'branding',
    'report_definitions',

    -- Operations / misc tables
    'audit_log',
    'doc_register',
    'incident_register',
    'lost_found_items',

    -- Views
    'v_ap_aging',
    'v_compliance_employee_status',
    'v_compliance_establishment_status',
    'v_employee_compliance_register',
    'v_employee_hris_summary',
    'v_employee_payslip_history',
    'v_guest_profile',
    'v_stock_balance'
  ];
BEGIN
  FOREACH obj IN ARRAY objects LOOP
    BEGIN
      EXECUTE format('REVOKE SELECT ON TABLE public.%I FROM anon', obj);
    EXCEPTION
      WHEN undefined_table THEN
        RAISE NOTICE 'Skipping %.%: object does not exist', 'public', obj;
    END;
  END LOOP;
END;
$$;
