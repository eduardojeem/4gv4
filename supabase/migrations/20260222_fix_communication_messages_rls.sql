-- Tighten communication_messages RLS by inheriting access from repairs visibility.
-- This avoids exposing messages from repairs the user cannot access.

ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.communication_messages;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.communication_messages;

CREATE POLICY "Authenticated can read messages linked to visible repairs"
ON public.communication_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.repairs r
    WHERE r.id = communication_messages.repair_id
  )
);

CREATE POLICY "Authenticated can insert messages linked to visible repairs"
ON public.communication_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.repairs r
    WHERE r.id = communication_messages.repair_id
  )
);
