-- ============================================================================
-- WhatsApp Dashboard backend storage (messages + per-user settings)
-- Fecha: 2026-03-08
-- ============================================================================

-- Messages sent from /dashboard/whatsapp
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL DEFAULT auth.uid(),
  customer_id UUID NULL REFERENCES public.customers(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  recipient_name TEXT,
  message TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'bulk', 'auto')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  provider TEXT,
  provider_message_id TEXT,
  provider_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_by_sent_at
  ON public.whatsapp_messages(created_by, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status
  ON public.whatsapp_messages(status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_source
  ON public.whatsapp_messages(source);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone
  ON public.whatsapp_messages(phone);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Users can read own whatsapp messages"
ON public.whatsapp_messages
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can insert own whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Users can insert own whatsapp messages"
ON public.whatsapp_messages
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update own whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Users can update own whatsapp messages"
ON public.whatsapp_messages
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete own whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Users can delete own whatsapp messages"
ON public.whatsapp_messages
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- Per-user dashboard settings
CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
  user_id UUID PRIMARY KEY DEFAULT auth.uid(),
  business_phone TEXT,
  auto_notify_repair_ready BOOLEAN NOT NULL DEFAULT true,
  auto_notify_status_change BOOLEAN NOT NULL DEFAULT false,
  auto_payment_reminders BOOLEAN NOT NULL DEFAULT false,
  reminder_days INTEGER NOT NULL DEFAULT 3 CHECK (reminder_days BETWEEN 1 AND 30),
  business_hours_start TIME NOT NULL DEFAULT '09:00',
  business_hours_end TIME NOT NULL DEFAULT '18:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_settings_updated_at
  ON public.whatsapp_settings(updated_at DESC);

ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own whatsapp settings" ON public.whatsapp_settings;
CREATE POLICY "Users can read own whatsapp settings"
ON public.whatsapp_settings
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own whatsapp settings" ON public.whatsapp_settings;
CREATE POLICY "Users can insert own whatsapp settings"
ON public.whatsapp_settings
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own whatsapp settings" ON public.whatsapp_settings;
CREATE POLICY "Users can update own whatsapp settings"
ON public.whatsapp_settings
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

