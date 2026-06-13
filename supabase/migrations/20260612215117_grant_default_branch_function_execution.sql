-- Inserts into audited tables can evaluate audit_log.branch_id's default.
-- The default calls get_default_branch_id(), whose EXECUTE privilege was
-- removed by the default-privilege hardening migration.
GRANT EXECUTE ON FUNCTION public.get_default_branch_id() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
