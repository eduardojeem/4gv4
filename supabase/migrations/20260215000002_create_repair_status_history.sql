-- Create repair status history table
CREATE TABLE IF NOT EXISTS repair_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repair_id UUID NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_repair_status_history_repair ON repair_status_history(repair_id);
CREATE INDEX idx_repair_status_history_created ON repair_status_history(created_at DESC);

-- Add RLS policies
ALTER TABLE repair_status_history ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all status history
CREATE POLICY "Authenticated users can read status history" ON repair_status_history
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only authenticated users can insert status history
CREATE POLICY "Authenticated users can insert status history" ON repair_status_history
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Create function to automatically log status changes
CREATE OR REPLACE FUNCTION log_repair_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR TG_OP = 'INSERT' THEN
    INSERT INTO repair_status_history (repair_id, status, changed_by, note)
    VALUES (
      NEW.id,
      NEW.status,
      auth.uid(),
      CASE 
        WHEN TG_OP = 'INSERT' THEN 'Reparación creada'
        ELSE 'Estado actualizado'
      END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically log status changes
DROP TRIGGER IF EXISTS trigger_log_repair_status_change ON repairs;
CREATE TRIGGER trigger_log_repair_status_change
  AFTER INSERT OR UPDATE OF status ON repairs
  FOR EACH ROW
  EXECUTE FUNCTION log_repair_status_change();

-- Add comment
COMMENT ON TABLE repair_status_history IS 'Tracks all status changes for repairs';
