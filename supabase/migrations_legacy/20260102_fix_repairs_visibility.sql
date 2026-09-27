-- FIX DE VISIBILIDAD DE REPARACIONES (RLS)
-- Fecha: 2026-01-02
-- Descripción: Habilita la lectura de reparaciones, clientes y perfiles para todos los usuarios autenticados.

-- 1. Asegurar que RLS esté habilitado
ALTER TABLE public.repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_images ENABLE ROW LEVEL SECURITY;

-- 2. Políticas para REPAIRS (Reparaciones)
-- Eliminar políticas antiguas para evitar conflictos
DROP POLICY IF EXISTS "Authenticated users can view repairs" ON public.repairs;
DROP POLICY IF EXISTS "allow authenticated read repairs" ON public.repairs;

-- Crear política permisiva para usuarios autenticados (ver todas las reparaciones)
CREATE POLICY "Authenticated users can view repairs" ON public.repairs 
FOR SELECT TO authenticated 
USING (true);

-- Permitir insertar
DROP POLICY IF EXISTS "Authenticated users can insert repairs" ON public.repairs;
CREATE POLICY "Authenticated users can insert repairs" ON public.repairs 
FOR INSERT TO authenticated 
WITH CHECK (true);

-- Permitir actualizar
DROP POLICY IF EXISTS "Authenticated users can update repairs" ON public.repairs;
CREATE POLICY "Authenticated users can update repairs" ON public.repairs 
FOR UPDATE TO authenticated 
USING (true);

-- 3. Políticas para CUSTOMERS (Clientes)
-- Necesario para que el join (customer:customers(...)) funcione
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
DROP POLICY IF EXISTS "allow authenticated read customers" ON public.customers;

CREATE POLICY "Authenticated users can view customers" ON public.customers 
FOR SELECT TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
CREATE POLICY "Authenticated users can insert customers" ON public.customers 
FOR INSERT TO authenticated 
WITH CHECK (true);

-- 4. Políticas para PROFILES (Perfiles/Técnicos)
-- Necesario para ver el nombre del técnico asignado
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "allow authenticated read profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles" ON public.profiles 
FOR SELECT TO authenticated 
USING (true);

-- 5. Políticas para REPAIR_IMAGES (Imágenes)
DROP POLICY IF EXISTS "Authenticated users can view repair images" ON public.repair_images;

CREATE POLICY "Authenticated users can view repair images" ON public.repair_images 
FOR SELECT TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert repair images" ON public.repair_images;
CREATE POLICY "Authenticated users can insert repair images" ON public.repair_images 
FOR INSERT TO authenticated 
WITH CHECK (true);
