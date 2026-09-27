-- Enable pg_cron extension if not already enabled
-- Note: pg_cron is available on Supabase Platform.
-- If running locally, you might need to configure it in postgresql.conf
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Function to rotate audit logs
-- Deletes logs older than the specified number of days (default 90)
CREATE OR REPLACE FUNCTION rotate_audit_logs(days_to_keep INT DEFAULT 90)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    deleted_count INT;
BEGIN
    -- Delete old logs in batches to avoid locking the table for too long
    -- This is a simple implementation. For massive tables, pg_partman is recommended.
    WITH deleted AS (
        DELETE FROM public.audit_log
        WHERE created_at < NOW() - (days_to_keep || ' days')::interval
        RETURNING 1
    )
    SELECT count(*) INTO deleted_count FROM deleted;

    -- Optional: Log the cleanup action itself (to the same log, recursively? Maybe just raise notice)
    RAISE NOTICE 'Rotated audit logs. Deleted % rows older than % days.', deleted_count, days_to_keep;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION rotate_audit_logs(INT) TO postgres;
GRANT EXECUTE ON FUNCTION rotate_audit_logs(INT) TO service_role;

-- Schedule the cron job (runs daily at 3:00 AM UTC)
-- Checks if job exists to avoid duplicates on re-runs
DO $$
BEGIN
    -- Only schedule if pg_cron is actually available and we are in a context where we can schedule
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'cron' AND table_name = 'job') THEN
        
        -- Unschedule if exists to update definition
        PERFORM cron.unschedule('daily_audit_log_rotation');

        -- Schedule new job
        PERFORM cron.schedule(
            'daily_audit_log_rotation',
            '0 3 * * *', -- At 03:00 AM
            'SELECT rotate_audit_logs(90)'
        );
        
        RAISE NOTICE 'Cron job daily_audit_log_rotation scheduled.';
    ELSE
        RAISE NOTICE 'pg_cron extension not fully loaded or permissions missing. Run manually or check extension settings.';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error scheduling cron job: %. Please ensure pg_cron is enabled in your project settings.', SQLERRM;
END;
$$;
