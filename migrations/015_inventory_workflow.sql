-- ─────────────────────────────────────────────────────────────────────────────
-- 015 · Inventory Workflow Automation
-- • Purchase Orders: default status changed to 'PENDING_APPROVAL' so every new
--   PO starts in an awaiting-approval state before it becomes OPEN/actionable.
-- • Purchase Orders: record who approved the PO and when.
-- • Requisitions: record the auto-routing decision ('PO' | 'TRANSFER') that was
--   computed from on-hand stock at the time of approval.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Change PO default status so new rows start in PENDING_APPROVAL
ALTER TABLE public.purchase_orders
  ALTER COLUMN status SET DEFAULT 'PENDING_APPROVAL';

-- 2. Approval-tracking columns for purchase_orders
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS approved_by   text,
  ADD COLUMN IF NOT EXISTS approved_at   timestamptz;

-- 3. Route-decision column on requisitions (set during approval based on stock)
ALTER TABLE public.requisitions
  ADD COLUMN IF NOT EXISTS route_decision text; -- 'PO' | 'TRANSFER' | NULL
