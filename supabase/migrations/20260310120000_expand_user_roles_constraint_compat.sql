-- ============================================================================
-- Compat: expand user_roles role check constraint to support canonical + legacy
-- Fecha: 2026-03-10
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'user_roles'
  ) THEN
    RAISE NOTICE 'Skipping user_roles constraint update: public.user_roles does not exist';
    RETURN;
  END IF;

  ALTER TABLE public.user_roles
    DROP CONSTRAINT IF EXISTS user_roles_role_check;

  ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_role_check
    CHECK (
      role IN (
        -- Canonical roles (current app)
        'super_admin',
        'admin',
        'vendedor',
        'tecnico',
        'cliente',

        -- Legacy / compatibility roles
        'manager',
        'employee',
        'viewer',
        'technician',
        'supervisor',
        'client_normal',
        'client_mayorista',
        'mayorista',
        'cashier',
        'sales',
        'support',
        'developer'
      )
    );

  RAISE NOTICE 'user_roles_role_check updated with canonical + legacy roles';
END $$;

