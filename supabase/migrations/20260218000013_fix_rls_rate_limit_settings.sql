-- Restrict access to rate_limit_settings
-- Only allow authenticated users to view their own rate limits
-- Only allow the system (via service role) to manage rate limits

-- Drop existing permissive policy
DROP POLICY IF EXISTS "Sistema puede gestionar rate limits" ON rate_limit_settings;

-- Create restrictive policies
-- Allow service role full access (implicitly handled by RLS being enabled, but explicit policy for service_role is better practice if not using bypass RLS)
-- However, since we want to restrict "Sistema puede gestionar rate limits" which was FOR ALL USING (true) WITH CHECK (true),
-- we should replace it with a policy that only allows the postgres role or service_role if possible, or rely on security definer functions.
-- Given the context, it seems this table is managed by security definer functions (check_rate_limit, cleanup_old_rate_limits).
-- Therefore, we might not need a broad write policy for authenticated users at all.

-- Let's create a policy that allows everything for service_role only.
CREATE POLICY "Service role can manage rate limits"
    ON rate_limit_settings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Ensure authenticated users can still VIEW their own limits (already exists as "Usuarios pueden ver su propio rate limit")
-- If the previous policy "Sistema puede gestionar rate limits" was intended to allow the `check_rate_limit` function to work,
-- and that function is SECURITY DEFINER, then the function runs with the privileges of the owner (usually postgres/admin), bypassing RLS.
-- So we don't need a permissive policy for authenticated users if all writes happen through SECURITY DEFINER functions.

-- Just in case there are other flows, we can restrict it to admin users if needed, but standard users shouldn't write directly.
-- The previous policy was definitely too broad.

-- We'll just leave the "Service role can manage rate limits" and the existing "Usuarios pueden ver su propio rate limit".
-- If "Sistema puede gestionar rate limits" was the only way for the system to write, replacing it with a service_role policy is the correct fix.
