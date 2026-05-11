-- Performance Indexes for /dashboard/repairs/technicians
-- Created: 2026-05-10
-- Purpose: Optimize technician stats queries

-- Composite index for technician + status (used by technicians-stats endpoint)
CREATE INDEX IF NOT EXISTS idx_repairs_technician_status 
ON repairs(technician_id, status);

-- Composite index for technician + completion date (monthly stats)
CREATE INDEX IF NOT EXISTS idx_repairs_technician_completed 
ON repairs(technician_id, completed_at DESC)
WHERE completed_at IS NOT NULL;

-- Index on profiles role for filtering technicians quickly
CREATE INDEX IF NOT EXISTS idx_profiles_role 
ON profiles(role);
