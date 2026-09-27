-- Agregar soporte de permisos para clientes en has_permission (idempotente)
-- Incluye asignaciones para roles existentes y roles extendidos (vendedor, tecnico, cliente)

CREATE OR REPLACE FUNCTION public.has_permission(
  permission_name TEXT,
  user_uuid UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN 
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  role_permissions TEXT[];
BEGIN
  user_role := public.get_user_role(user_uuid);

  CASE user_role
    WHEN 'super_admin' THEN
      RETURN TRUE;

    WHEN 'admin' THEN
      role_permissions := ARRAY[
        'products.manage', 'inventory.manage', 'reports.manage',
        'users.read', 'users.create', 'users.update', 'users.manage',
        'settings.read', 'settings.update', 'settings.manage',
        'promotions.manage',
        -- Clientes
        'customers.create', 'customers.read', 'customers.update', 'customers.delete', 'customers.manage'
      ];

    -- Conjunto de roles "clásicos"
    WHEN 'manager' THEN
      role_permissions := ARRAY[
        'products.create', 'products.read', 'products.update',
        'inventory.read', 'inventory.update',
        'reports.read', 'reports.create',
        'users.read', 'settings.read',
        -- Clientes
        'customers.read', 'customers.update'
      ];
    WHEN 'employee' THEN
      role_permissions := ARRAY[
        'products.read', 'products.update',
        'inventory.read', 'inventory.update',
        'reports.read',
        -- Clientes
        'customers.read'
      ];
    WHEN 'viewer' THEN
      role_permissions := ARRAY[
        'products.read', 'inventory.read', 'reports.read'
      ];

    -- Conjunto de roles alineados con la app
    WHEN 'vendedor' THEN
      role_permissions := ARRAY[
        'products.create', 'products.read', 'products.update',
        'inventory.read', 'inventory.update',
        'reports.read', 'reports.create',
        'promotions.read', 'promotions.create', 'promotions.update',
        -- Clientes
        'customers.create', 'customers.read', 'customers.update'
      ];
    WHEN 'tecnico' THEN
      role_permissions := ARRAY[
        'products.read', 'products.update',
        'inventory.read', 'inventory.update',
        'reports.read',
        -- Clientes
        'customers.read'
      ];
    WHEN 'cliente' THEN
      role_permissions := ARRAY[
        'products.read', 'inventory.read', 'reports.read'
      ];
    WHEN 'client_normal' THEN
      role_permissions := ARRAY[
        'products.read', 'inventory.read', 'reports.read'
      ];
    WHEN 'client_mayorista' THEN
      role_permissions := ARRAY[
        'products.read', 'inventory.read', 'reports.read'
      ];
    WHEN 'technician' THEN
      role_permissions := ARRAY[
        'products.read', 'products.update',
        'inventory.read', 'inventory.update',
        'reports.read',
        -- Clientes
        'customers.read'
      ];
    ELSE
      RETURN FALSE;
  END CASE;

  RETURN permission_name = ANY(role_permissions);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

