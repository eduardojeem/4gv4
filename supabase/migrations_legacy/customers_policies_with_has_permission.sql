-- Políticas RLS para customers usando public.has_permission
-- Idempotente: elimina políticas previas y crea nuevas basadas en permisos

-- Asegurar RLS habilitado
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas previas relacionadas para evitar duplicados
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver clientes" ON public.customers;
DROP POLICY IF EXISTS "Administradores y vendedores pueden gestionar clientes" ON public.customers;
DROP POLICY IF EXISTS "Usuarios con permiso pueden insertar clientes" ON public.customers;
DROP POLICY IF EXISTS "Usuarios con permiso pueden actualizar clientes" ON public.customers;
DROP POLICY IF EXISTS "Usuarios con permiso pueden borrar clientes" ON public.customers;

-- Lectura: mantener compatibilidad (autenticados pueden leer) y permitir por permiso explícito
CREATE POLICY "Usuarios autenticados pueden ver clientes" ON public.customers
  FOR SELECT USING (
    auth.role() = 'authenticated' OR public.has_permission('customers.read')
  );

-- Inserción condicionada por permisos
CREATE POLICY "Usuarios con permiso pueden insertar clientes" ON public.customers
  FOR INSERT WITH CHECK (
    public.has_permission('customers.create') OR public.has_permission('customers.manage')
  );

-- Actualización condicionada por permisos
CREATE POLICY "Usuarios con permiso pueden actualizar clientes" ON public.customers
  FOR UPDATE USING (
    public.has_permission('customers.update') OR public.has_permission('customers.manage')
  ) WITH CHECK (
    public.has_permission('customers.update') OR public.has_permission('customers.manage')
  );

-- Borrado condicionado por permisos
CREATE POLICY "Usuarios con permiso pueden borrar clientes" ON public.customers
  FOR DELETE USING (
    public.has_permission('customers.delete') OR public.has_permission('customers.manage')
  );

