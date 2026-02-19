-- Configuración del bucket product-images para imágenes de productos
-- Fecha: 2026-02-18

-- 1. Crear el bucket si no existe (será público)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;

-- 3. Crear política de lectura pública
CREATE POLICY "Public read access for product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- 4. Crear política de subida para usuarios autenticados
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND auth.role() = 'authenticated'
);

-- 5. Crear política de actualización para usuarios autenticados
CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images' 
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'product-images' 
  AND auth.role() = 'authenticated'
);

-- 6. Crear política de eliminación para usuarios autenticados
CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images' 
  AND auth.role() = 'authenticated'
);

-- Verificación
DO $$
BEGIN
  RAISE NOTICE 'Bucket product-images configurado correctamente';
  RAISE NOTICE 'Políticas RLS aplicadas:';
  RAISE NOTICE '  ✓ Lectura pública habilitada';
  RAISE NOTICE '  ✓ Subida para usuarios autenticados';
  RAISE NOTICE '  ✓ Actualización para usuarios autenticados';
  RAISE NOTICE '  ✓ Eliminación para usuarios autenticados';
END $$;
