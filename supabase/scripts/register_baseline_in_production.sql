-- Registra la migración base como ya aplicada en producción.
--
-- Producción ya tiene este esquema (la migración base se generó a partir de
-- él). Sin este registro, una futura sincronización de migraciones intentaría
-- volver a crear todas las tablas y fallaría.
--
-- Ejecutar UNA vez en Supabase > SQL Editor, después de fusionar la migración
-- base. Solo agrega una fila al historial; no cambia tablas ni datos.

insert into supabase_migrations.schema_migrations (version, name)
values ('20260927000000', 'baseline_schema')
on conflict (version) do nothing;

-- Comprobación: debe devolver una fila.
select version, name
from supabase_migrations.schema_migrations
where version = '20260927000000';
