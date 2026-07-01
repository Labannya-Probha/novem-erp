INSERT INTO report_categories (code, name, description, sort_order) VALUES
('IFRS', 'IFRS Financial Reports', 'IAS/IFRS financial statements and schedules.', 10),
('HOTEL_KPI', 'Hotel KPI & Operations', 'Occupancy, reservation, rooms, guest ledger, housekeeping, and night audit reports.', 20),
('POS', 'Restaurant POS', 'Restaurant sales, outlet collection, and POS control reports.', 30),
('ACCOUNTING', 'Accounting Control', 'Ledger, receivable, payable, payment, and daily control reports.', 40)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order;

WITH category AS (
  SELECT id, code, name FROM report_categories
), inserted AS (
  INSERT INTO report_templates (
    category_id, report_code, report_name, report_category, ifrs_reference,
    data_source, grouping_option, sorting_option, export_permission, print_permission
  )
  SELECT c.id, v.report_code, v.report_name, c.name, v.ifrs_reference,
         v.data_source, v.grouping_option::jsonb, v.sorting_option::jsonb, TRUE, TRUE
  FROM (VALUES
    ('IFRS', 'IFRS-SFP',       'Statement of Financial Position',   'IAS 1',    'reporting.vw_statement_financial_position', '["classification"]',       '[{"key":"accountCode","direction":"asc"}]'),
    ('IFRS', 'IFRS-PNL',       'Statement of Profit or Loss',        'IAS 1',    'reporting.vw_profit_or_loss',               '["statementLine"]',        '[{"key":"accountCode","direction":"asc"}]'),
    ('IFRS', 'IFRS-CFS',       'Statement of Cash Flows',            'IAS 7',    'reporting.vw_cash_flows',                   '["cashFlowClass"]',        '[{"key":"accountCode","direction":"asc"}]'),
    ('IFRS', 'IFRS-SCE',       'Statement of Changes in Equity',     'IAS 1',    'reporting.vw_changes_in_equity',            '["equityComponent"]',      '[{"key":"accountCode","direction":"asc"}]'),
    ('IFRS', 'IFRS-REV-REC',   'Revenue Recognition Report',         'IFRS 15',  'reporting.vw_revenue_recognition',          '["performanceObligation"]','[{"key":"transactionDate","direction":"desc"}]'),
    ('IFRS', 'IFRS-DEF-REV',   'Deferred Revenue Report',            'IFRS 15',  'reporting.vw_deferred_revenue',             '["status"]',               '[{"key":"transactionDate","direction":"desc"}]'),
    ('IFRS', 'INV-MOV',        'Inventory Movement Report',          'IAS 2',    'reporting.vw_inventory_movement',           '["itemCategory"]',         '[{"key":"transactionDate","direction":"desc"}]'),
    ('IFRS', 'FA-REG',         'Fixed Asset Register',               'IAS 16',   'reporting.vw_fixed_asset_register',         '["assetClass"]',           '[{"key":"accountCode","direction":"asc"}]'),
    ('IFRS', 'FA-DEP',         'Depreciation Schedule',              'IAS 16',   'reporting.vw_depreciation_schedule',        '["assetClass"]',           '[{"key":"accountCode","direction":"asc"}]'),
    ('IFRS', 'LEASE-LIAB',     'Lease Liability Schedule',           'IFRS 16',  'reporting.vw_lease_liability',              '["leaseContract"]',        '[{"key":"transactionDate","direction":"asc"}]'),
    ('ACCOUNTING', 'AR-AGING', 'Accounts Receivable Aging',          NULL,       'reporting.vw_ar_aging',                     '["agingBucket"]',          '[{"key":"balance","direction":"desc"}]'),
    ('ACCOUNTING', 'AP-AGING', 'Accounts Payable Aging',             NULL,       'reporting.vw_ap_aging',                     '["agingBucket"]',          '[{"key":"balance","direction":"desc"}]'),
    ('HOTEL_KPI', 'OCC-RPT',   'Occupancy Report',                   NULL,       'reporting.vw_occupancy',                    '["roomType"]',             '[{"key":"transactionDate","direction":"desc"}]'),
    ('HOTEL_KPI', 'ADR-RPT',   'ADR Report',                         NULL,       'reporting.vw_adr',                          '["roomType"]',             '[{"key":"transactionDate","direction":"desc"}]'),
    ('HOTEL_KPI', 'REVPAR-RPT','RevPAR Report',                      NULL,       'reporting.vw_revpar',                       '["roomType"]',             '[{"key":"transactionDate","direction":"desc"}]'),
    ('HOTEL_KPI', 'ROOM-REV',  'Room Revenue Report',                NULL,       'reporting.vw_room_revenue',                 '["roomType"]',             '[{"key":"transactionDate","direction":"desc"}]'),
    ('HOTEL_KPI', 'GUEST-LEDGER','Guest Ledger Report',              NULL,       'reporting.vw_guest_ledger',                 '["guestName"]',            '[{"key":"transactionDate","direction":"desc"}]'),
    ('HOTEL_KPI', 'RES-RPT',   'Reservation Report',                 NULL,       'reporting.vw_reservations',                 '["reservationSource"]',    '[{"key":"transactionDate","direction":"desc"}]'),
    ('HOTEL_KPI', 'CHECKIN-RPT','Check-in Report',                   NULL,       'reporting.vw_check_ins',                    '["roomType"]',             '[{"key":"transactionDate","direction":"desc"}]'),
    ('HOTEL_KPI', 'CHECKOUT-RPT','Check-out Report',                 NULL,       'reporting.vw_check_outs',                   '["roomType"]',             '[{"key":"transactionDate","direction":"desc"}]'),
    ('HOTEL_KPI', 'NOSHOW-RPT','No-show Report',                     NULL,       'reporting.vw_no_shows',                     '["reservationSource"]',    '[{"key":"transactionDate","direction":"desc"}]'),
    ('HOTEL_KPI', 'CANCEL-RPT','Cancellation Report',                NULL,       'reporting.vw_cancellations',                '["reservationSource"]',    '[{"key":"transactionDate","direction":"desc"}]'),
    ('HOTEL_KPI', 'HK-STATUS', 'Housekeeping Status Report',         NULL,       'reporting.vw_housekeeping_status',          '["status"]',               '[{"key":"roomNo","direction":"asc"}]'),
    ('HOTEL_KPI', 'ROOM-AVAIL','Room Availability Report',           NULL,       'reporting.vw_room_availability',            '["roomType"]',             '[{"key":"roomNo","direction":"asc"}]'),
    ('POS', 'REST-SALES',      'Restaurant Sales Report',            NULL,       'reporting.vw_restaurant_sales',             '["outlet"]',               '[{"key":"transactionDate","direction":"desc"}]'),
    ('POS', 'POS-COLL',        'POS Collection Report',              NULL,       'reporting.vw_pos_collection',               '["paymentMethod"]',        '[{"key":"transactionDate","direction":"desc"}]'),
    ('ACCOUNTING', 'PAY-SUM',  'Payment Summary Report',             NULL,       'reporting.vw_payment_summary',              '["paymentMethod"]',        '[{"key":"transactionDate","direction":"desc"}]'),
    ('ACCOUNTING', 'DAILY-SALES','Daily Sales Report',               NULL,       'reporting.vw_daily_sales',                  '["department"]',           '[{"key":"transactionDate","direction":"desc"}]'),
    ('ACCOUNTING', 'NIGHT-AUDIT','Night Audit Report',               NULL,       'reporting.vw_night_audit',                  '["department"]',           '[{"key":"transactionDate","direction":"desc"}]')
  ) AS v(category_code, report_code, report_name, ifrs_reference, data_source, grouping_option, sorting_option)
  JOIN category c ON c.code = v.category_code
  ON CONFLICT (report_code) DO UPDATE SET
    report_name = EXCLUDED.report_name,
    ifrs_reference = EXCLUDED.ifrs_reference,
    data_source = EXCLUDED.data_source,
    grouping_option = EXCLUDED.grouping_option,
    sorting_option = EXCLUDED.sorting_option
  RETURNING id, report_code
)
INSERT INTO report_user_access (report_template_id, role, can_view, can_export, can_print)
SELECT id, role_name, TRUE, TRUE, TRUE
FROM inserted
CROSS JOIN (VALUES ('SUPERUSER'), ('ADMIN'), ('MANAGER'), ('ACCOUNTS'), ('FRONT_OFFICE'), ('RESTAURANT'), ('HOUSEKEEPING')) AS roles(role_name)
ON CONFLICT (report_template_id, user_id, role) DO NOTHING;

-- ── Standard fields for financial / IFRS reports ──────────────────────────
WITH tpl AS (SELECT id, report_code FROM report_templates WHERE report_code IN (
  'IFRS-SFP','IFRS-PNL','IFRS-CFS','IFRS-SCE','IFRS-REV-REC','IFRS-DEF-REV',
  'INV-MOV','FA-REG','FA-DEP','LEASE-LIAB','AR-AGING','AP-AGING'
))
INSERT INTO report_fields (report_template_id, field_key, field_label, data_type, alignment, column_width, is_visible, is_total, sort_order)
SELECT t.id, f.field_key, f.field_label, f.data_type, f.alignment, f.column_width, TRUE, f.is_total, f.sort_order
FROM tpl t
CROSS JOIN (VALUES
  ('slNo',          'SL No',          'number',   'center', 72,  FALSE,  1),
  ('accountCode',   'Account Code',   'code',     'center', 120, FALSE,  2),
  ('accountName',   'Account Name',   'text',     'left',   180, FALSE,  3),
  ('description',   'Description',    'text',     'left',   220, FALSE,  4),
  ('debit',         'Debit',          'currency', 'right',  120, TRUE,   5),
  ('credit',        'Credit',         'currency', 'right',  120, TRUE,   6),
  ('balance',       'Balance',        'currency', 'right',  130, TRUE,   7),
  ('remarks',       'Remarks',        'text',     'left',   200, FALSE,  8)
) AS f(field_key, field_label, data_type, alignment, column_width, is_total, sort_order)
ON CONFLICT (report_template_id, field_key) DO NOTHING;

-- ── Standard fields for hotel KPI reports ────────────────────────────────
WITH tpl AS (SELECT id, report_code FROM report_templates WHERE report_code IN (
  'OCC-RPT','ADR-RPT','REVPAR-RPT','ROOM-REV','GUEST-LEDGER',
  'RES-RPT','CHECKIN-RPT','CHECKOUT-RPT','NOSHOW-RPT','CANCEL-RPT',
  'HK-STATUS','ROOM-AVAIL'
))
INSERT INTO report_fields (report_template_id, field_key, field_label, data_type, alignment, column_width, is_visible, is_total, sort_order)
SELECT t.id, f.field_key, f.field_label, f.data_type, f.alignment, f.column_width, TRUE, f.is_total, f.sort_order
FROM tpl t
CROSS JOIN (VALUES
  ('slNo',              'SL No',              'number',   'center', 72,  FALSE,  1),
  ('transactionDate',   'Transaction Date',   'date',     'center', 130, FALSE,  2),
  ('reservationNo',     'Reservation No',     'code',     'center', 140, FALSE,  3),
  ('guestId',           'Guest ID',           'code',     'center', 110, FALSE,  4),
  ('guestName',         'Guest Name',         'text',     'left',   180, FALSE,  5),
  ('roomNo',            'Room No',            'code',     'center', 95,  FALSE,  6),
  ('roomType',          'Room Type',          'text',     'left',   130, FALSE,  7),
  ('reservationSource', 'Reservation Source', 'text',     'left',   160, FALSE,  8),
  ('grossAmount',       'Gross Amount',       'currency', 'right',  130, TRUE,   9),
  ('netAmount',         'Net Amount',         'currency', 'right',  130, TRUE,   10),
  ('status',            'Status',             'status',   'center', 110, FALSE,  11)
) AS f(field_key, field_label, data_type, alignment, column_width, is_total, sort_order)
ON CONFLICT (report_template_id, field_key) DO NOTHING;

-- ── Standard fields for POS reports ──────────────────────────────────────
WITH tpl AS (SELECT id, report_code FROM report_templates WHERE report_code IN ('REST-SALES','POS-COLL'))
INSERT INTO report_fields (report_template_id, field_key, field_label, data_type, alignment, column_width, is_visible, is_total, sort_order)
SELECT t.id, f.field_key, f.field_label, f.data_type, f.alignment, f.column_width, TRUE, f.is_total, f.sort_order
FROM tpl t
CROSS JOIN (VALUES
  ('slNo',            'SL No',          'number',   'center', 72,  FALSE, 1),
  ('transactionDate', 'Date',           'date',     'center', 130, FALSE, 2),
  ('documentNo',      'Document No',    'code',     'center', 130, FALSE, 3),
  ('department',      'Department',     'text',     'left',   140, FALSE, 4),
  ('costCenter',      'Cost Center',    'code',     'center', 120, FALSE, 5),
  ('description',     'Description',   'text',     'left',   220, FALSE, 6),
  ('quantity',        'Quantity',       'number',   'right',  95,  FALSE, 7),
  ('rate',            'Rate',           'currency', 'right',  110, FALSE, 8),
  ('grossAmount',     'Gross Amount',   'currency', 'right',  130, TRUE,  9),
  ('discount',        'Discount',       'currency', 'right',  115, TRUE,  10),
  ('vat',             'VAT',            'currency', 'right',  110, TRUE,  11),
  ('serviceCharge',   'Service Charge', 'currency', 'right',  130, TRUE,  12),
  ('netAmount',       'Net Amount',     'currency', 'right',  130, TRUE,  13),
  ('paymentMethod',   'Payment Method', 'text',     'left',   145, FALSE, 14),
  ('createdBy',       'Created By',     'text',     'left',   130, FALSE, 15),
  ('status',          'Status',         'status',   'center', 110, FALSE, 16)
) AS f(field_key, field_label, data_type, alignment, column_width, is_total, sort_order)
ON CONFLICT (report_template_id, field_key) DO NOTHING;

-- ── Standard fields for accounting control reports ────────────────────────
WITH tpl AS (SELECT id, report_code FROM report_templates WHERE report_code IN ('PAY-SUM','DAILY-SALES','NIGHT-AUDIT'))
INSERT INTO report_fields (report_template_id, field_key, field_label, data_type, alignment, column_width, is_visible, is_total, sort_order)
SELECT t.id, f.field_key, f.field_label, f.data_type, f.alignment, f.column_width, TRUE, f.is_total, f.sort_order
FROM tpl t
CROSS JOIN (VALUES
  ('slNo',            'SL No',          'number',   'center', 72,  FALSE, 1),
  ('transactionDate', 'Date',           'date',     'center', 130, FALSE, 2),
  ('documentNo',      'Document No',    'code',     'center', 130, FALSE, 3),
  ('reservationNo',   'Reservation No', 'code',     'center', 140, FALSE, 4),
  ('guestName',       'Guest Name',     'text',     'left',   180, FALSE, 5),
  ('roomNo',          'Room No',        'code',     'center', 95,  FALSE, 6),
  ('department',      'Department',     'text',     'left',   140, FALSE, 7),
  ('accountName',     'Account Name',   'text',     'left',   180, FALSE, 8),
  ('description',     'Description',    'text',     'left',   220, FALSE, 9),
  ('grossAmount',     'Gross Amount',   'currency', 'right',  130, TRUE,  10),
  ('discount',        'Discount',       'currency', 'right',  115, TRUE,  11),
  ('vat',             'VAT',            'currency', 'right',  110, TRUE,  12),
  ('serviceCharge',   'Service Charge', 'currency', 'right',  130, TRUE,  13),
  ('netAmount',       'Net Amount',     'currency', 'right',  130, TRUE,  14),
  ('paymentMethod',   'Payment Method', 'text',     'left',   145, FALSE, 15),
  ('status',          'Status',         'status',   'center', 110, FALSE, 16)
) AS f(field_key, field_label, data_type, alignment, column_width, is_total, sort_order)
ON CONFLICT (report_template_id, field_key) DO NOTHING;

-- ── Standard filters (applied to all 29 reports) ──────────────────────────
INSERT INTO report_filters (report_template_id, filter_key, filter_label, filter_type, default_value, options, is_required, sort_order)
SELECT t.id, f.filter_key, f.filter_label, f.filter_type, f.default_value, f.options::jsonb, FALSE, f.sort_order
FROM report_templates t
CROSS JOIN (VALUES
  ('dateFrom',          'Date From',          'date',   'monthStart', '[]',                                                                                 1),
  ('dateTo',            'Date To',            'date',   'today',      '[]',                                                                                 2),
  ('property',          'Property',           'select', 'All Properties', '["All Properties","Aura Stay Demo","City Branch"]',                              3),
  ('outlet',            'Outlet',             'select', 'All Outlets', '["All Outlets","Restaurant","Room Service","Banquet"]',                             4),
  ('department',        'Department',         'select', 'All Departments', '["All Departments","Rooms","Restaurant","Accounting","Housekeeping","Inventory"]', 5),
  ('costCenter',        'Cost Center',        'select', 'All Cost Centers', '["All Cost Centers","ROOMS","F&B","ADMIN","HK","CASHIER"]',                    6),
  ('roomType',          'Room Type',          'select', 'All Room Types', '["All Room Types","Deluxe","Suite","Family Villa"]',                             7),
  ('guestType',         'Guest Type',         'select', 'All Guest Types', '["All Guest Types","FIT","Corporate","OTA","Group"]',                          8),
  ('reservationSource', 'Reservation Source', 'select', 'All Sources', '["All Sources","Direct","OTA","Corporate","Walk-in"]',                             9),
  ('paymentMethod',     'Payment Method',     'select', 'All Methods', '["All Methods","Cash","Card","Mobile Banking","Bank Transfer","Room Charge"]',     10),
  ('status',            'Status',             'select', 'All Status',  '["All Status","Open","Approved","Posted","Settled","Cancelled"]',                  11),
  ('user',              'User',               'select', 'All Users',   '["All Users"]',                                                                    12),
  ('currency',          'Currency',           'select', 'BDT',         '["BDT","USD"]',                                                                    13)
) AS f(filter_key, filter_label, filter_type, default_value, options, sort_order)
ON CONFLICT (report_template_id, filter_key) DO NOTHING;

-- ── KPI definitions ────────────────────────────────────────────────────────
INSERT INTO report_kpis (report_template_id, kpi_key, kpi_label, value_type, sort_order)
SELECT t.id, k.kpi_key, k.kpi_label, k.value_type, k.sort_order
FROM report_templates t
CROSS JOIN (VALUES
  ('totalRevenue',         'Total Revenue',               'currency',  1),
  ('roomRevenue',          'Room Revenue',                'currency',  2),
  ('restaurantRevenue',    'Restaurant Revenue',          'currency',  3),
  ('otherRevenue',         'Other Revenue',               'currency',  4),
  ('occupancy',            'Occupancy %',                 'percent',   5),
  ('adr',                  'ADR',                         'currency',  6),
  ('revpar',               'RevPAR',                      'currency',  7),
  ('totalGuests',          'Total Guests',                'number',    8),
  ('checkIns',             'Check-ins',                   'number',    9),
  ('checkOuts',            'Check-outs',                  'number',    10),
  ('cancellations',        'Cancellations',               'number',    11),
  ('noShows',              'No-shows',                    'number',    12),
  ('cashCollection',       'Cash Collection',             'currency',  13),
  ('cardCollection',       'Card Collection',             'currency',  14),
  ('mobileCollection',     'Mobile Banking Collection',   'currency',  15),
  ('outstandingReceivable','Outstanding Receivable',      'currency',  16),
  ('vatPayable',           'VAT Payable',                 'currency',  17),
  ('netProfit',            'Net Profit',                  'currency',  18),
  ('gop',                  'GOP',                         'currency',  19),
  ('ebitdaMargin',         'EBITDA Margin',               'percent',   20)
) AS k(kpi_key, kpi_label, value_type, sort_order)
ON CONFLICT (report_template_id, kpi_key) DO NOTHING;
