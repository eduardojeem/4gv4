-- Update RLS policies for promotions table
-- Make sure authenticated users can access promotions

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can view promotions" ON promotions;
DROP POLICY IF EXISTS "Admins can manage promotions" ON promotions;
DROP POLICY IF EXISTS "Users can view active promotions" ON promotions;
DROP POLICY IF EXISTS "Admins can view all promotions" ON promotions;

-- Enable RLS if not already enabled
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view promotions (for now, to test)
CREATE POLICY "Authenticated users can view promotions" ON promotions
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to manage promotions (for testing)
-- In production, you might want to restrict this to admins only
CREATE POLICY "Authenticated users can manage promotions" ON promotions
    FOR ALL USING (auth.role() = 'authenticated');

-- Alternative: Restrict management to admins only (uncomment if needed)
/*
CREATE POLICY "Admins can manage promotions" ON promotions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'super_admin')
        )
    );
*/