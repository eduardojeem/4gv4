begin;

create or replace function public.get_system_health_migration_versions()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.version::text order by m.version), array[]::text[])
  from supabase_migrations.schema_migrations m;
$$;

comment on function public.get_system_health_migration_versions() is
  'Versiones del historial de Supabase para comparar el deploy con el repositorio. Solo service_role.';

revoke all on function public.get_system_health_migration_versions() from public, anon, authenticated;
grant execute on function public.get_system_health_migration_versions() to service_role;

commit;
