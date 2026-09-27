-- ============================================================================
-- Fix: RLS policies for products and update has_permission to include all CRUD for admin
-- ============================================================================

BEGIN;

-- 1. Actualizar la función has_permission para que "admin" y "manager" tengan products.create explícito
-- Primero eliminamos la funcion conflictiva si se creo con 1 solo parametro
DROP FUNCTION IF EXISTS public.has_permission(TEXT);

-- Reemplazamos la funcion con la firma original exacta (2 parametros, 1 con default)
CREATE OR REPLACE FUNCTION public.has_permission(permission_name TEXT, user_uuid UUID DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_permissions TEXT[];
BEGIN
    -- Obtener el rol actual
    v_role := public.get_user_role(user_uuid);
    
    -- Super admin tiene todo
    IF v_role = 'super_admin' THEN
        RETURN true;
    END IF;

    -- Admin tiene todo
    IF v_role = 'admin' THEN
        RETURN true;
    END IF;

    -- Manager
    IF v_role = 'manager' THEN
        v_permissions := ARRAY[
            'inventory.products.read', 'inventory.products.create', 'inventory.products.update',
            'products.read', 'products.create', 'products.update', 'products.manage',
            'pos.read', 'customers.read'
        ];
        RETURN permission_name = ANY(v_permissions);
    END IF;

    -- Vendedor
    IF v_role = 'vendedor' THEN
        v_permissions := ARRAY[
            'products.create', 'products.read', 'products.update',
            'inventory.products.read', 'inventory.products.create', 'inventory.products.update',
            'pos.read', 'customers.read', 'orders.read', 'promotions.read'
        ];
        RETURN permission_name = ANY(v_permissions);
    END IF;

    -- Técnico
    IF v_role = 'tecnico' THEN
        v_permissions := ARRAY[
            'products.read', 'products.update',
            'inventory.products.read', 'inventory.products.update',
            'repairs.read'
        ];
        RETURN permission_name = ANY(v_permissions);
    END IF;
    
    -- Cliente
    IF v_role = 'cliente' THEN
        v_permissions := ARRAY['products.read', 'inventory.products.read'];
        RETURN permission_name = ANY(v_permissions);
    END IF;

    RETURN false;
END;
$$;


-- 2. Actualizar las políticas de la tabla products para que soporten isolation por organización y user_roles
DROP POLICY IF EXISTS "products_insert_admin_manager" ON public.products;
DROP POLICY IF EXISTS "products_update_admin_manager" ON public.products;
DROP POLICY IF EXISTS "products_delete_admin" ON public.products;

-- Insertar producto: Permitido si el usuario tiene permiso products.create o inventory.products.create O es admin/manager de la organización
CREATE POLICY "products_insert_policy"
ON public.products FOR INSERT TO authenticated
WITH CHECK (
    -- Permiso explícito de la función
    public.has_permission('products.create') OR public.has_permission('inventory.products.create')
    -- O ser owner/admin/manager en la organización de destino
    OR EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid() 
          AND om.organization_id = products.organization_id
          AND om.role IN ('owner', 'admin', 'manager')
          AND om.status = 'active'
    )
);

-- Actualizar producto: Permitido si tiene permisos
CREATE POLICY "products_update_policy"
ON public.products FOR UPDATE TO authenticated
USING (
    public.has_permission('products.update') OR public.has_permission('inventory.products.update')
    OR EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid() 
          AND om.organization_id = products.organization_id
          AND om.role IN ('owner', 'admin', 'manager')
          AND om.status = 'active'
    )
)
WITH CHECK (
    public.has_permission('products.update') OR public.has_permission('inventory.products.update')
    OR EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid() 
          AND om.organization_id = products.organization_id
          AND om.role IN ('owner', 'admin', 'manager')
          AND om.status = 'active'
    )
);

-- Eliminar producto: Solo admin o dueño de la org
CREATE POLICY "products_delete_policy"
ON public.products FOR DELETE TO authenticated
USING (
    public.has_permission('products.delete') OR public.has_permission('inventory.products.delete')
    OR EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid() 
          AND om.organization_id = products.organization_id
          AND om.role IN ('owner', 'admin')
          AND om.status = 'active'
    )
);

COMMIT;
