-- ============================================================================
-- Fix: Clean up orphan open sessions & backfill opened_by
-- 
-- Problem 1: Multiple sessions with status='open' (or date=NULL) exist
--            Only ONE session per register should be open at a time
-- Problem 2: opened_by is NULL on existing sessions because the column
--            was added after the sessions were created
-- ============================================================================

-- ============================================================================
-- STEP 1: Diagnose - See all open sessions
-- ============================================================================
SELECT 
  id, 
  register_id, 
  opening_balance, 
  status,
  created_at,
  opened_by
FROM cash_closures 
WHERE (date IS NULL OR status = 'open')
ORDER BY register_id, created_at DESC;

-- ============================================================================
-- STEP 2: Close ALL duplicate open sessions per register
-- Keep only the MOST RECENT open session per register_id
-- ============================================================================
WITH ranked_open AS (
  SELECT 
    id,
    register_id,
    ROW_NUMBER() OVER (PARTITION BY register_id ORDER BY created_at DESC) as rn
  FROM cash_closures
  WHERE date IS NULL OR status = 'open'
)
UPDATE cash_closures
SET 
  date = NOW(),
  status = 'closed',
  closing_balance = opening_balance,
  notes = COALESCE(notes, '') || ' [Auto-cerrada: sesión duplicada limpiada por admin]'
WHERE id IN (
  SELECT id FROM ranked_open WHERE rn > 1
);

-- ============================================================================
-- STEP 3: Backfill opened_by from the opening movement's created_by
-- This fixes "Sin asignar" for existing sessions
-- ============================================================================
UPDATE cash_closures c
SET opened_by = (
  SELECT m.created_by 
  FROM cash_movements m 
  WHERE m.session_id = c.id 
    AND m.type = 'opening' 
    AND m.created_by IS NOT NULL
  ORDER BY m.created_at ASC
  LIMIT 1
)
WHERE c.opened_by IS NULL;

-- ============================================================================
-- STEP 4: Backfill closed_by from the closing movement's created_by
-- ============================================================================
UPDATE cash_closures c
SET closed_by = (
  SELECT m.created_by 
  FROM cash_movements m 
  WHERE m.session_id = c.id 
    AND m.type = 'closing' 
    AND m.created_by IS NOT NULL
  ORDER BY m.created_at DESC
  LIMIT 1
)
WHERE c.closed_by IS NULL 
  AND c.date IS NOT NULL;

-- ============================================================================
-- STEP 5: Sync status column with date column for consistency
-- (sessions that have date set but status is still 'open')
-- ============================================================================
UPDATE cash_closures
SET status = 'closed'
WHERE date IS NOT NULL AND (status = 'open' OR status IS NULL);

UPDATE cash_closures
SET status = 'open'
WHERE date IS NULL AND (status IS NULL OR status = '');

-- ============================================================================
-- STEP 6: Verify results
-- ============================================================================

-- Should show at most 1 open session per register
SELECT 
  register_id,
  COUNT(*) FILTER (WHERE status = 'open') as open_count,
  COUNT(*) FILTER (WHERE status = 'closed') as closed_count,
  COUNT(*) as total
FROM cash_closures
GROUP BY register_id
ORDER BY register_id;

-- Show remaining open sessions (should be max 1 per register)
SELECT 
  id, 
  register_id, 
  opening_balance, 
  status,
  opened_by,
  created_at
FROM cash_closures 
WHERE status = 'open'
ORDER BY register_id;
