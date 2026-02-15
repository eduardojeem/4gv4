-- Fix website_settings RLS to include user_roles check
-- This ensures that users with roles in user_roles table can also manage settings

DROP POLICY IF EXISTS "Admins can manage website settings" ON website_settings;

CREATE POLICY "Admins can manage website settings"
    ON website_settings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin')
        )
        OR
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role IN ('admin', 'super_admin')
        )
    );
