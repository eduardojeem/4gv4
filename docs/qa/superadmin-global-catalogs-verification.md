# Verificación de catálogos globales de SuperAdmin

Fecha: 2026-10-04

## Alcance

- `/superadmin/catalogs`
- `/superadmin/categories`
- `/superadmin/brands`
- `/superadmin/global-products`
- `/superadmin/device-models`
- RPC y migraciones que sostienen jerarquía, vínculos, importaciones, consultas administrativas y publicación editorial.

## Evidencia ejecutada

- TypeScript: `npx tsc --noEmit` — correcto.
- Pruebas focalizadas de catálogos: 72 casos ejecutados (71 correctos y un fallo de contrato textual); después de corregirlo, la repetición dirigida terminó con 15/15 casos correctos.
- SQL real en PostgreSQL local: migraciones desde `20261004142816` evaluadas con `ON_ERROR_STOP=1`; el tramo `20261004143347` en adelante completó y terminó en `ROLLBACK`.
- Formato: `git diff --check` — correcto en las verificaciones previas.
- Build: compilación y TypeScript correctos; el prerender se detuvo porque este worktree aislado no contiene `.env.local` y faltan `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Defectos encontrados durante la validación SQL

1. Las funciones usaban `extensions.unaccent` sin garantizar la extensión. Se agregó instalación explícita en `20261004142816_atomic_catalog_links.sql`.
2. PostgreSQL no ofrece `min(uuid)` en este entorno. El backfill de modelos ahora elige la única coincidencia mediante `array_agg(... order by ...)[1]`.

## Estado local y remoto

- No se aplicó ninguna migración al proyecto remoto.
- La CLI local no pudo conectarse por el puerto publicado aunque el contenedor PostgreSQL estaba saludable.
- La primera prueba transaccional encontró migraciones históricas con `COMMIT`; por ello parte de las migraciones pendientes quedó aplicada en la base local sin actualizar `supabase_migrations.schema_migrations`.
- No se ejecutó `db reset` para evitar borrar datos locales. Antes de usar esa base como referencia de historial conviene regenerarla de forma controlada o reparar únicamente el entorno local.

## Validación manual recomendada

1. Abrir Catálogos globales y confirmar que `Sin verificar` nunca aparece como `Al día`.
2. Importar un candidato de producto y de modelo; ambos deben quedar en `Candidato` y no aparecer en consumidores de tienda.
3. Pasar candidato a `En revisión` y luego a `Publicado`; recién entonces debe aparecer en escaneo u opciones de equipos.
4. Dar de baja un publicado y confirmar que deja de consumirse sin borrar referencias históricas.
5. Mover una rama de categorías y verificar que descendientes y vínculos permanecen intactos.

