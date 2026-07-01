-- Re-apply the permissions the frontend relies on for profile and staff management.
-- Existing environments that missed the original grant can apply this safely.

GRANT SELECT, UPDATE ON TABLE public.app_users TO authenticated;
