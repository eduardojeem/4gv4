-- ============================================================================
-- Fix: Close duplicate open sessions
-- Problem: Multiple sessions with date=NULL (open) exist simultaneously
-- Only the most recent one with register_id='principal' should remain open
-- ============================================================================

-- 1. See current open sessions
SELECT id, register_id, opening_balance, created_at 
FROM cash_closures 
WHERE date IS NULL 
ORDER BY created_at DESC;

-- 2. Close all open sessions EXCEPT the most recent one with register_id='principal'
-- This sets date = NOW() which marks them as closed
UPDATE cash_closures
SET date = NOW()::DATE,
    closing_balance = opening_balance
WHERE date IS NULL
  AND id != (
    SELECT id FROM cash_closures 
    WHERE date IS NULL 
      AND LOWER(register_id) = 'principal'
    ORDER BY created_at DESC 
    LIMIT 1
  );

-- 3. Verify: should show only 1 open session now
SELECT id, register_id, opening_balance, created_at 
FROM cash_closures 
WHERE date IS NULL;
