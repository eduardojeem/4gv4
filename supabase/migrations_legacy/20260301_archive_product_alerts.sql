-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Create archive table for product_alerts if it doesn't exist
-- We remove the foreign key constraint to keep history even if product is deleted
CREATE TABLE IF NOT EXISTS product_alerts_archive (
    id UUID PRIMARY KEY,
    product_id UUID, -- No FK constraint to allow product deletion while keeping history
    type VARCHAR(50),
    message TEXT,
    details JSONB,
    read BOOLEAN,
    is_resolved BOOLEAN,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying archive
CREATE INDEX IF NOT EXISTS idx_product_alerts_archive_created_at ON product_alerts_archive(created_at);
CREATE INDEX IF NOT EXISTS idx_product_alerts_archive_product_id ON product_alerts_archive(product_id);

-- Function to archive old alerts
CREATE OR REPLACE FUNCTION archive_old_product_alerts(months_to_keep INT DEFAULT 6)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    moved_count INT;
BEGIN
    -- Move old alerts to archive
    WITH moved AS (
        DELETE FROM public.product_alerts
        WHERE created_at < NOW() - (months_to_keep || ' months')::interval
        RETURNING id, product_id, type, message, details, read, is_resolved, resolved_at, created_at
    )
    INSERT INTO public.product_alerts_archive (id, product_id, type, message, details, read, is_resolved, resolved_at, created_at)
    SELECT id, product_id, type, message, details, read, is_resolved, resolved_at, created_at FROM moved;

    GET DIAGNOSTICS moved_count = ROW_COUNT;

    RAISE NOTICE 'Archived % product alerts older than % months.', moved_count, months_to_keep;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION archive_old_product_alerts(INT) TO postgres;
GRANT EXECUTE ON FUNCTION archive_old_product_alerts(INT) TO service_role;

-- Schedule the cron job (runs weekly on Sunday at 4:00 AM UTC)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'cron' AND table_name = 'job') THEN
        
        PERFORM cron.unschedule('weekly_product_alerts_archive');

        PERFORM cron.schedule(
            'weekly_product_alerts_archive',
            '0 4 * * 0', -- At 04:00 AM on Sunday
            'SELECT archive_old_product_alerts(6)'
        );
        
        RAISE NOTICE 'Cron job weekly_product_alerts_archive scheduled.';
    ELSE
        RAISE NOTICE 'pg_cron extension not fully loaded or permissions missing.';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error scheduling cron job: %. Please ensure pg_cron is enabled.', SQLERRM;
END;
$$;
