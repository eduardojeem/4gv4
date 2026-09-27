-- Crear bucket de avatars si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Asegurar que RLS está habilitado (comentado porque requiere ser dueño de la tabla)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes para evitar duplicados (limpieza de versiones anteriores en inglés y español)
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

DROP POLICY IF EXISTS "Acceso público a avatares" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios pueden subir su propio avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios pueden eliminar su propio avatar" ON storage.objects;

-- Política 1: Acceso público de lectura
CREATE POLICY "Acceso público a avatares"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- Política 2: Usuarios autenticados pueden subir su propio avatar
CREATE POLICY "Usuarios pueden subir su propio avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

-- Política 3: Usuarios pueden actualizar sus propios avatares
CREATE POLICY "Usuarios pueden actualizar su propio avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.uid() = owner
)
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid() = owner
);

-- Política 4: Usuarios pueden eliminar sus propios avatares
CREATE POLICY "Usuarios pueden eliminar su propio avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.uid() = owner
);
