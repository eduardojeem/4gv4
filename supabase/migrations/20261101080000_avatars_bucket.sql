-- Bucket de fotos de perfil. La web y la app suben a `avatars/<user_id>/...`,
-- pero el bucket y sus políticas no estaban en ninguna migración: en una base
-- nueva (local, preview) la subida fallaba con «Bucket not found».
-- Idempotente: si producción ya los tiene, no cambia nada.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

do $$
begin
  -- El bucket es público: las fotos se ven por su URL sin política de lectura.
  -- Esta solo deja ver la carpeta propia (la subida con upsert la necesita),
  -- así nadie puede listar las fotos de todos.
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_owner_read') then
    create policy avatars_owner_read on storage.objects
      for select to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;

  -- Cada usuario escribe solo en su carpeta: avatars/<su id>/archivo.
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_owner_insert') then
    create policy avatars_owner_insert on storage.objects
      for insert to authenticated
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_owner_update') then
    create policy avatars_owner_update on storage.objects
      for update to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_owner_delete') then
    create policy avatars_owner_delete on storage.objects
      for delete to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end $$;
