-- Script SQL para configurar buckets de Supabase Storage manualmente
-- Ejecutar en el SQL Editor de Supabase Dashboard

-- Crear bucket para avatares de usuario
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars', 
  true,
  5242880, -- 5MB en bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Crear bucket para imágenes de reparaciones
INSERT INTO storage.buckets (id, name, public)
VALUES ('repair-images', 'repair-images', true)
ON CONFLICT (id) DO NOTHING;

-- Crear bucket para imágenes de productos
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de seguridad para avatares

-- Permitir lectura pública de avatares
CREATE POLICY "Public read access for avatars" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- Permitir que usuarios autenticados suban avatares a su propia carpeta
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir que usuarios actualicen sus propios avatares
CREATE POLICY "Users can update own avatars" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir que usuarios eliminen sus propios avatares
CREATE POLICY "Users can delete own avatars" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatares' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Políticas para imágenes de reparaciones (solo lectura pública, subida por autenticados)
CREATE POLICY "Public read access for repair images" ON storage.objects
FOR SELECT USING (bucket_id = 'repair-images');

CREATE POLICY "Authenticated users can upload repair images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'repair-images' 
  AND auth.role() = 'authenticated'
);

-- Políticas para imágenes de productos
CREATE POLICY "Public read access for product images" ON storage.objects
FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'product-images' 
  AND auth.role() = 'authenticated'
);

-- Verificar que los buckets se crearon correctamente
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets 
WHERE id IN ('avatars', 'repair-images', 'product-images');