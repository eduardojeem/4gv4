-- ============================================================================
-- Fix RLS policies for cash_closures and cash_movements
-- Problem: Frontend cannot read these tables due to missing/incorrect RLS policies
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Enable RLS (in case it's not enabled)
ALTER TABLE cash_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Authenticated can read cash_closures" ON cash_closures;
DROP POLICY IF EXISTS "Authenticated can read cash_movements" ON cash_movements;
DROP POLICY IF EXISTS "Authenticated can read cash_registers" ON cash_registers;
DROP POLICY IF EXISTS "Staff can manage cash_closures" ON cash_closures;
DROP POLICY IF EXISTS "Staff can manage cash_movements" ON cash_movements;
DROP POLICY IF EXISTS "Staff can manage cash_registers" ON cash_registers;
DROP POLICY IF EXISTS "Allow authenticated read cash_closures" ON cash_closures;
DROP POLICY IF EXISTS "Allow authenticated read cash_movements" ON cash_movements;
DROP POLICY IF EXISTS "Allow authenticated read cash_registers" ON cash_registers;
DROP POLICY IF EXISTS "Allow staff manage cash_closures" ON cash_closures;
DROP POLICY IF EXISTS "Allow staff manage cash_movements" ON cash_movements;
DROP POLICY IF EXISTS "Allow staff manage cash_registers" ON cash_registers;

-- 3. Create READ policies (all authenticated users can view)
CREATE POLICY "Authenticated can read cash_closures" ON cash_closures
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can read cash_movements" ON cash_movements
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can read cash_registers" ON cash_registers
  FOR SELECT USING (auth.role() = 'authenticated');

-- 4. Create WRITE policies (admin + vendedor can insert/update/delete)
CREATE POLICY "Staff can manage cash_closures" ON cash_closures
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin', 'vendedor')
    )
  );

CREATE POLICY "Staff can manage cash_movements" ON cash_movements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin', 'vendedor')
    )
  );

CREATE POLICY "Staff can manage cash_registers" ON cash_registers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin', 'vendedor')
    )
  );

-- 5. Verify: this should now return data
SELECT 'cash_closures' AS table_name, COUNT(*) AS total, 
  COUNT(*) FILTER (WHERE date IS NULL) AS open_sessions
FROM cash_closures;
