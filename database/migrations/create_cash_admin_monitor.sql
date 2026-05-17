-- ============================================================================
-- CASH ADMIN MONITOR - Database Schema Extension
-- Adds administrative control, audit trail, and alert system for cash registers
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. EXTEND cash_closures with admin control fields
-- ============================================================================

-- Add status field to support suspended/blocked states
ALTER TABLE cash_closures ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open' 
  CHECK (status IN ('open', 'closed', 'suspended', 'blocked'));

-- Add admin control fields
ALTER TABLE cash_closures ADD COLUMN IF NOT EXISTS opened_by UUID REFERENCES auth.users(id);
ALTER TABLE cash_closures ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES auth.users(id);
ALTER TABLE cash_closures ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES auth.users(id);
ALTER TABLE cash_closures ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE cash_closures ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES auth.users(id);
ALTER TABLE cash_closures ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;
ALTER TABLE cash_closures ADD COLUMN IF NOT EXISTS expected_balance BIGINT DEFAULT 0;
ALTER TABLE cash_closures ADD COLUMN IF NOT EXISTS discrepancy BIGINT DEFAULT 0;
ALTER TABLE cash_closures ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'principal';
ALTER TABLE cash_closures ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing open sessions to have correct status
UPDATE cash_closures SET status = 'open' WHERE date IS NULL AND status IS NULL;
UPDATE cash_closures SET status = 'closed' WHERE date IS NOT NULL AND status IS NULL;

-- ============================================================================
-- 2. CASH REGISTER ADMIN AUDIT LOG
-- Separate from cash_movements - tracks admin actions specifically
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cash_admin_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES cash_closures(id) ON DELETE SET NULL,
    register_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN (
        'remote_close', 'suspend', 'unsuspend', 'block', 'unblock',
        'reopen', 'force_count', 'approve_discrepancy', 'reject_discrepancy',
        'manual_adjustment', 'override_balance', 'config_change'
    )),
    performed_by UUID NOT NULL REFERENCES auth.users(id),
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    -- Snapshot of state before/after
    previous_state JSONB,
    new_state JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_cash_admin_audit_session ON cash_admin_audit(session_id);
CREATE INDEX IF NOT EXISTS idx_cash_admin_audit_register ON cash_admin_audit(register_id);
CREATE INDEX IF NOT EXISTS idx_cash_admin_audit_action ON cash_admin_audit(action);
CREATE INDEX IF NOT EXISTS idx_cash_admin_audit_performed_by ON cash_admin_audit(performed_by);
CREATE INDEX IF NOT EXISTS idx_cash_admin_audit_created_at ON cash_admin_audit(created_at DESC);

-- ============================================================================
-- 3. CASH ALERTS TABLE
-- Stores generated alerts for admin monitoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cash_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES cash_closures(id) ON DELETE CASCADE,
    register_id TEXT NOT NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'long_open', 'large_discrepancy', 'excessive_withdrawals',
        'excessive_voids', 'suspicious_movement', 'inactive_register',
        'high_balance', 'negative_balance', 'unauthorized_access'
    )),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    resolution_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cash_alerts_session ON cash_alerts(session_id);
CREATE INDEX IF NOT EXISTS idx_cash_alerts_register ON cash_alerts(register_id);
CREATE INDEX IF NOT EXISTS idx_cash_alerts_type ON cash_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_cash_alerts_severity ON cash_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_cash_alerts_unread ON cash_alerts(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_cash_alerts_unresolved ON cash_alerts(is_resolved) WHERE is_resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_cash_alerts_created_at ON cash_alerts(created_at DESC);

-- ============================================================================
-- 4. CASH REGISTER CONFIG TABLE
-- Per-register configuration for alert thresholds
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cash_register_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    register_id TEXT NOT NULL UNIQUE,
    -- Alert thresholds
    max_open_hours INTEGER DEFAULT 12,
    max_discrepancy_amount BIGINT DEFAULT 50000,
    max_withdrawals_per_session INTEGER DEFAULT 10,
    max_voids_per_session INTEGER DEFAULT 5,
    inactivity_threshold_minutes INTEGER DEFAULT 120,
    high_balance_threshold BIGINT DEFAULT 5000000,
    -- Permissions
    requires_approval_for_close BOOLEAN DEFAULT FALSE,
    requires_dual_control BOOLEAN DEFAULT FALSE,
    auto_suspend_on_discrepancy BOOLEAN DEFAULT FALSE,
    -- Metadata
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE cash_admin_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register_config ENABLE ROW LEVEL SECURITY;

-- Admin audit: only admin/super_admin can read and write
CREATE POLICY "Admin can read cash_admin_audit" ON cash_admin_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admin can manage cash_admin_audit" ON cash_admin_audit
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Alerts: admin can read/manage
CREATE POLICY "Admin can read cash_alerts" ON cash_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admin can manage cash_alerts" ON cash_alerts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Config: admin can read/manage
CREATE POLICY "Admin can read cash_register_config" ON cash_register_config
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admin can manage cash_register_config" ON cash_register_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 6. REALTIME PUBLICATION
-- Enable realtime for admin monitoring tables
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE cash_closures;
ALTER PUBLICATION supabase_realtime ADD TABLE cash_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE cash_alerts;

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Function to update last_activity_at on movement insert
CREATE OR REPLACE FUNCTION update_session_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cash_closures 
  SET last_activity_at = NOW()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS trg_update_session_activity ON cash_movements;
CREATE TRIGGER trg_update_session_activity
  AFTER INSERT ON cash_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_session_last_activity();

-- Function to generate alerts for long-open sessions
CREATE OR REPLACE FUNCTION check_long_open_sessions()
RETURNS void AS $$
DECLARE
  session_record RECORD;
  config_record RECORD;
BEGIN
  FOR session_record IN 
    SELECT c.id, c.register_id, c.created_at, c.last_activity_at
    FROM cash_closures c
    WHERE c.status = 'open'
    AND c.created_at < NOW() - INTERVAL '12 hours'
  LOOP
    -- Check if alert already exists
    IF NOT EXISTS (
      SELECT 1 FROM cash_alerts 
      WHERE session_id = session_record.id 
      AND alert_type = 'long_open'
      AND is_resolved = FALSE
    ) THEN
      INSERT INTO cash_alerts (session_id, register_id, alert_type, severity, title, description)
      VALUES (
        session_record.id,
        session_record.register_id,
        'long_open',
        'high',
        'Caja abierta por más de 12 horas',
        format('La caja %s lleva abierta desde %s', 
          session_record.register_id, 
          session_record.created_at::TEXT)
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. PERFORMANCE INDEXES
-- ============================================================================

-- Composite index for admin monitor queries
CREATE INDEX IF NOT EXISTS idx_cash_closures_status_register 
  ON cash_closures(status, register_id);

CREATE INDEX IF NOT EXISTS idx_cash_closures_open_sessions 
  ON cash_closures(register_id, created_at DESC) 
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_cash_movements_session_type 
  ON cash_movements(session_id, type, created_at DESC);

-- ============================================================================
-- 9. INSERT DEFAULT CONFIG FOR EXISTING REGISTERS
-- ============================================================================

INSERT INTO cash_register_config (register_id)
SELECT DISTINCT register_id FROM cash_closures
ON CONFLICT (register_id) DO NOTHING;

-- Insert default for 'principal' if not exists
INSERT INTO cash_register_config (register_id)
VALUES ('principal')
ON CONFLICT (register_id) DO NOTHING;
