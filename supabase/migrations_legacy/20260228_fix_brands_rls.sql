-- Enable RLS
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow all for authenticated users" ON brands;
DROP POLICY IF EXISTS "Allow read access for all users" ON brands;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON brands;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON brands;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON brands;

-- Create comprehensive policies

-- 1. Allow read access for everyone (public catalog needs to see brands)
CREATE POLICY "Allow read access for all users" ON brands
  FOR SELECT USING (true);

-- 2. Allow insert for authenticated users
CREATE POLICY "Allow insert for authenticated users" ON brands
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 3. Allow update for authenticated users
CREATE POLICY "Allow update for authenticated users" ON brands
  FOR UPDATE USING (auth.role() = 'authenticated');

-- 4. Allow delete for authenticated users
CREATE POLICY "Allow delete for authenticated users" ON brands
  FOR DELETE USING (auth.role() = 'authenticated');
