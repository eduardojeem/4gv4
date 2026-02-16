-- Performance Optimization Indexes for /mis-reparaciones
-- Created: 2026-02-15
-- Purpose: Improve query performance for public repair lookups and admin dashboard

-- ============================================
-- REPAIRS TABLE INDEXES
-- ============================================

-- Index for ticket number lookups (most common query in public portal)
CREATE INDEX IF NOT EXISTS idx_repairs_ticket_number 
ON repairs(ticket_number);

-- Index for status filtering (used in dashboard and filters)
CREATE INDEX IF NOT EXISTS idx_repairs_status 
ON repairs(status);

-- Index for customer lookups
CREATE INDEX IF NOT EXISTS idx_repairs_customer_id 
ON repairs(customer_id);

-- Index for technician assignments
CREATE INDEX IF NOT EXISTS idx_repairs_technician_id 
ON repairs(technician_id);

-- Composite index for status + created_at (common dashboard query)
CREATE INDEX IF NOT EXISTS idx_repairs_status_created 
ON repairs(status, created_at DESC);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_repairs_created_at 
ON repairs(created_at DESC);

-- ============================================
-- CUSTOMERS TABLE INDEXES
-- ============================================

-- Index for email lookups (authentication)
CREATE INDEX IF NOT EXISTS idx_customers_email 
ON customers(email);

-- Index for phone lookups (authentication)
CREATE INDEX IF NOT EXISTS idx_customers_phone 
ON customers(phone);

-- Index for customer code lookups
CREATE INDEX IF NOT EXISTS idx_customers_customer_code 
ON customers(customer_code);

-- ============================================
-- REPAIR STATUS HISTORY INDEXES
-- ============================================

-- Index for repair history lookups
CREATE INDEX IF NOT EXISTS idx_repair_status_history_repair_id 
ON repair_status_history(repair_id, created_at DESC);

-- ============================================
-- REPAIR IMAGES INDEXES (for future lazy loading)
-- ============================================

-- Index for image lookups by repair
CREATE INDEX IF NOT EXISTS idx_repair_images_repair_id 
ON repair_images(repair_id);

-- ============================================
-- REPAIR NOTES INDEXES (for future lazy loading)
-- ============================================

-- Index for notes lookups by repair
CREATE INDEX IF NOT EXISTS idx_repair_notes_repair_id 
ON repair_notes(repair_id, created_at DESC);

-- ============================================
-- REPAIR PARTS INDEXES (for future lazy loading)
-- ============================================

-- Index for parts lookups by repair
CREATE INDEX IF NOT EXISTS idx_repair_parts_repair_id 
ON repair_parts(repair_id);

-- ============================================
-- ANALYZE TABLES
-- ============================================
-- Update statistics for query planner

ANALYZE repairs;
ANALYZE customers;
ANALYZE repair_status_history;
ANALYZE repair_images;
ANALYZE repair_notes;
ANALYZE repair_parts;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify indexes were created

-- List all indexes on repairs table
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'repairs';

-- List all indexes on customers table
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'customers';

-- Check index usage (run after some time in production)
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;
