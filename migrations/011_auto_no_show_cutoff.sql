-- Auto-mark same-day confirmed reservations as no-show after 12:05 PM local time.
-- The function is idempotent and only logs rows that actually transitioned.

CREATE OR REPLACE FUNCTION public.auto_mark_reservation_no_shows(p_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows integer := 0;
BEGIN
  WITH updated AS (
    UPDATE public.reservations r
       SET status = 'NO_SHOW'
     WHERE r.status = 'CONFIRMED'
       AND p_now::time >= time '12:05'
       AND r.check_in = p_now::date
       AND (current_tenant_id() IS NULL OR r.tenant_id = current_tenant_id())
    RETURNING r.id, r.res_no, r.check_in, r.tenant_id
  ), logged AS (
    INSERT INTO public.audit_log (tenant_id, actor, action, entity, entity_id, details)
    SELECT
      u.tenant_id,
      'system',
      'AUTO_NO_SHOW',
      'reservation',
      COALESCE(u.res_no, u.id::text),
      jsonb_build_object(
        'source', 'AUTO_CUTOFF',
        'from_status', 'CONFIRMED',
        'to_status', 'NO_SHOW',
        'check_in', u.check_in,
        'cutoff_local', '12:05',
        'run_at', p_now
      )
    FROM updated u
  )
  SELECT count(*) INTO v_rows FROM updated;

  RETURN COALESCE(v_rows, 0);
END;
$$;

CREATE INDEX IF NOT EXISTS idx_reservations_confirmed_same_day
  ON public.reservations (tenant_id, check_in)
  WHERE status = 'CONFIRMED';

REVOKE EXECUTE ON FUNCTION public.auto_mark_reservation_no_shows(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auto_mark_reservation_no_shows(timestamptz) TO authenticated;
