-- Script para verificar y corregir las políticas RLS de la tabla brands
-- Este script asegura que los usuarios con los permisos correctos puedan actualizar marcas

-- 1. Verificar políticas existentes
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'brands'
ORDER BY policyname;

-- 2. Eliminar políticas conflictivas si existen
DROP POLICY IF EXISTS "Allow all for authenticated users" ON brands;
DROP POLICY IF EXISTS "Read brands public" ON brands;
DROP POLICY IF EXISTS "Manage brands admin" ON brands;

-- 3. Crear políticas correctas
-- Permitir lectura pública de marcas activas
CREATE POLICY "brands_select_public" ON brands
  FOR SELECT
  USING (is_active = true);

-- Permitir lectura completa para usuarios autenticados
CREATE POLICY "brands_select_authenticated" ON brands
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Permitir INSERT para usuarios con permisos de inventario
CREATE POLICY "brands_insert_authorized" ON brands
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      has_permission('inventory.manage') OR 
      has_permission('products.manage') OR
      get_user_role() IN ('admin', 'super_admin', 'vendedor')
    )
  );

-- Permitir UPDATE para usuarios con permisos de inventario
CREATE POLICY "brands_update_authorized" ON brands
  FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND (
      has_permission('inventory.manage') OR 
      has_permission('products.manage') OR
      get_user_role() IN ('admin', 'super_admin', 'vendedor')
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      has_permission('inventory.manage') OR 
      has_permission('products.manage') OR
      get_user_role() IN ('admin', 'super_admin', 'vendedor')
    )
  );

-- Permitir DELETE solo para admins
CREATE POLICY "brands_delete_admin" ON brands
  FOR DELETE
  USING (
    auth.role() = 'authenticated' AND (
      has_permission('inventory.manage') OR
      get_user_role() IN ('admin', 'super_admin')
    )
  );

-- 4. Verificar que las políticas se crearon correctamente
SELECT 
  policyname,
  cmd,
  permissive
FROM pg_policies 
WHERE tablename = 'brands'
ORDER BY policyname;

-- 5. Verificar que RLS está habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'brands';
