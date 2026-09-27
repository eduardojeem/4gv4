-- Create public access audit table for security logging
CREATE TABLE IF NOT EXISTS public_access_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'auth_attempt',
    'auth_success', 
    'auth_failure',
    'token_expired',
    'unauthorized_access',
    'rate_limit_exceeded',
    'invalid_token'
  )),
  ticket_number TEXT NOT NULL,
  contact_hash TEXT, -- SHA256 hash of contact (email/phone)
  client_ip INET,
  user_agent TEXT,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_public_access_audit_ticket ON public_access_audit(ticket_number);
CREATE INDEX idx_public_access_audit_ip ON public_access_audit(client_ip);
CREATE INDEX idx_public_access_audit_created ON public_access_audit(created_at DESC);
CREATE INDEX idx_public_access_audit_event_type ON public_access_audit(event_type);

-- Create composite index for failed attempts queries
CREATE INDEX idx_public_access_audit_failures ON public_access_audit(
  ticket_number, 
  event_type, 
  created_at DESC
) WHERE event_type IN ('auth_failure', 'rate_limit_exceeded');

-- Add RLS policies (only accessible by service role)
ALTER TABLE public_access_audit ENABLE ROW LEVEL SECURITY;

-- No public access - only service role can read/write
CREATE POLICY "Service role only" ON public_access_audit
  FOR ALL
  USING (auth.role() = 'service_role');

-- Add comment
COMMENT ON TABLE public_access_audit IS 'Security audit log for public portal access attempts';
