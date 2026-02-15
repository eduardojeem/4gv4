-- Permitir que administradores vean "authorized_persons" de cualquier cliente
DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can view any authorized persons" ON public.authorized_persons;
END $$;

CREATE POLICY "Admins can view any authorized persons"
  ON public.authorized_persons
  FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('admin','super_admin')
  );

-- Nota: mantiene la política existente para que cada cliente vea solo los suyos
-- "Users can view their own authorized persons" permanece intacta.

