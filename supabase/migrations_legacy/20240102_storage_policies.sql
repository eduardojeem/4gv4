
-- Habilitar la extensión storage si no está habilitada (generalmente viene por defecto)
-- create extension if not exists "storage";

-- Configuración de políticas para el bucket 'repair-images'

-- 1. Permitir acceso público de lectura a todas las imágenes
create policy "Public Access Repair Images"
on storage.objects for select
using ( bucket_id = 'repair-images' );

-- 2. Permitir a usuarios autenticados subir imágenes
create policy "Authenticated Users Upload Repair Images"
on storage.objects for insert
with check ( bucket_id = 'repair-images' and auth.role() = 'authenticated' );

-- 3. Permitir a usuarios autenticados actualizar imágenes
create policy "Authenticated Users Update Repair Images"
on storage.objects for update
using ( bucket_id = 'repair-images' and auth.role() = 'authenticated' );

-- 4. Permitir a usuarios autenticados eliminar imágenes
create policy "Authenticated Users Delete Repair Images"
on storage.objects for delete
using ( bucket_id = 'repair-images' and auth.role() = 'authenticated' );


-- Configuración de políticas para el bucket 'product-images'

create policy "Public Access Product Images"
on storage.objects for select
using ( bucket_id = 'product-images' );

create policy "Authenticated Users Upload Product Images"
on storage.objects for insert
with check ( bucket_id = 'product-images' and auth.role() = 'authenticated' );

create policy "Authenticated Users Update Product Images"
on storage.objects for update
using ( bucket_id = 'product-images' and auth.role() = 'authenticated' );

create policy "Authenticated Users Delete Product Images"
on storage.objects for delete
using ( bucket_id = 'product-images' and auth.role() = 'authenticated' );


-- Configuración de políticas para el bucket 'avatars'

create policy "Public Access Avatars"
on storage.objects for select
using ( bucket_id = 'avatars' );

create policy "Authenticated Users Upload Avatars"
on storage.objects for insert
with check ( bucket_id = 'avatars' and auth.role() = 'authenticated' );

create policy "Authenticated Users Update Avatars"
on storage.objects for update
using ( bucket_id = 'avatars' and auth.role() = 'authenticated' );

create policy "Authenticated Users Delete Avatars"
on storage.objects for delete
using ( bucket_id = 'avatars' and auth.role() = 'authenticated' );
