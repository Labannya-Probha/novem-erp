-- Keep reports visible and align Facility Items with the Service Bills UI.

DO $$
BEGIN
  IF to_regclass('public.facility_items') IS NOT NULL THEN
    ALTER TABLE public.facility_items
      DROP CONSTRAINT IF EXISTS facility_items_category_check;

    ALTER TABLE public.facility_items
      ADD CONSTRAINT facility_items_category_check
      CHECK (
        category IS NULL OR category IN (
          'OTHER', 'GENERAL', 'SERVICE', 'SHOP', 'LAUNDRY', 'SPA',
          'TRANSPORT', 'MINIBAR', 'FOOD', 'ROOM_SERVICE', 'MISC'
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.report_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  name text NOT NULL,
  key_fields text,
  status text NOT NULL DEFAULT 'READY',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department, name)
);

GRANT SELECT ON public.report_definitions TO authenticated;
ALTER TABLE public.report_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS report_definitions_authenticated_select ON public.report_definitions;
CREATE POLICY report_definitions_authenticated_select
  ON public.report_definitions FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.report_definitions (department, name, key_fields, status)
VALUES
  ('Operations', 'Management Dashboard', 'Occupancy %, ADR, RevPAR, Total F&B Rev, Satisfaction Score', 'READY'),
  ('Operations', 'Sales & Reservations', 'Date, Guest Name, Room Type, Source, Status, Total Amount, Deposit, Balance', 'READY'),
  ('Operations', 'Occupancy & RevPAR', 'Date, Rooms Sold, Total Rooms, Occupancy %, Room Revenue, RevPAR', 'READY'),
  ('Operations', 'Guest Ledger', 'Room No., Guest Name, Opening Bal, Room Charges, F&B Charges, Taxes, Payments, Closing Bal', 'READY'),
  ('Operations', 'City Ledger', 'Account Name, Invoice Date, Service, Due Date, Amount, Aging (0-30, 31-60, 60+)', 'READY'),
  ('Operations', 'Agency Commission', 'Date, Booking Ref, Guest Name, Gross Rev, Comm %, Comm Amount, Net Revenue', 'READY'),
  ('Operations', 'Shareholder Entitlement', 'Period, Net Profit, Distribution %, Entitlement Amount, Payout Status', 'READY'),
  ('Restaurant', 'POS Sales Summary', 'Category, Qty Sold, Gross Sales, Discount, Net Sales, Taxes, Total', 'READY'),
  ('Restaurant', 'KOT Register', 'Date/Time, KOT No., Table No., Waiter, Item, Qty, Status (Served/Void), Signature', 'READY'),
  ('Restaurant', 'F&B Daily Revenue', 'Total POS Sales, Add: Room Service, Less: Comp/Staff Meals, Net F&B Revenue', 'READY'),
  ('Accounting', 'Profit & Loss', 'Revenue, COGS, Gross Profit, Operating Expenses, Net Profit/Loss', 'READY'),
  ('Accounting', 'Balance Sheet', 'Assets (Current/Fixed), Liabilities (Current/Long-term), Equity', 'READY'),
  ('Accounting', 'Cash Flow Statement', 'Operating Activities, Investing Activities, Financing Activities, Net Cash Flow', 'READY'),
  ('Accounting', 'Trial Balance', 'Account Name, Account Type, Debit Balance, Credit Balance', 'READY'),
  ('Accounting', 'General Ledger', 'Date, Ref/Voucher No., Description, Account, Debit, Credit, Balance', 'READY'),
  ('Accounting', 'Bank Book', 'Date, Particulars, Chq No., Deposit, Withdrawal, Bank Balance', 'READY'),
  ('Accounting', 'Cash Book', 'Date, Particulars, Cash In, Cash Out, Closing Cash Balance', 'READY'),
  ('Accounting', 'Bank Reconciliation', 'Book Balance, Bank Statement Balance, Uncleared Chqs, Deposits in Transit', 'READY'),
  ('Accounting', 'Retained Earnings', 'Opening Retained Earnings, Net Income, Dividends Paid, Ending Balance', 'READY'),
  ('Accounting', 'NAV / Equity Report', 'Total Assets, Total Liabilities, Net Assets, Shares Outstanding, NAV per Share', 'READY'),
  ('Accounting', 'AP Aging', 'Vendor Name, Due Date, Total Due, Current, 30 Days, 60 Days, 90+ Days', 'READY'),
  ('Accounting', 'AR Aging', 'Customer Name, Invoice Date, Total Due, Current, 30 Days, 60 Days, 90+ Days', 'READY')
ON CONFLICT (department, name) DO UPDATE
SET key_fields = EXCLUDED.key_fields,
    status = 'READY',
    updated_at = now();
