-- Enable RLS
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to ensure clean state
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'brands' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON brands', pol.policyname);
    END LOOP;
END $$;

-- Create permissive policies for authenticated users
-- 1. Everyone can read brands (needed for public catalog)
CREATE POLICY "brands_select_public" ON brands FOR SELECT USING (true);

-- 2. Authenticated users can create brands
CREATE POLICY "brands_insert_auth" ON brands FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 3. Authenticated users can update brands
CREATE POLICY "brands_update_auth" ON brands FOR UPDATE USING (auth.role() = 'authenticated');

-- 4. Authenticated users can delete brands
CREATE POLICY "brands_delete_auth" ON brands FOR DELETE USING (auth.role() = 'authenticated');
