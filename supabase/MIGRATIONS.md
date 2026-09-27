# Migraciones

## Estructura

- `supabase/migrations/`: migraciones que ejecuta la CLI de Supabase y las
  ramas de prueba (Supabase Preview). Empieza con una **migración base**
  (`20260927000000_baseline_schema.sql`) que contiene el esquema completo de
  producción; todo cambio posterior va en un archivo nuevo.
- `supabase/migrations_legacy/`: los scripts anteriores, conservados como
  historial. **No se ejecutan.** Muchos se aplicaron a mano desde el SQL
  Editor, fuera de orden o con otra fecha, y juntos no reconstruyen el
  esquema real. Varios tests los leen para verificar su contenido.

## Por qué

Supabase Preview recrea la base desde cero ejecutando `supabase/migrations/`.
Con los scripts anteriores se detenía en el primero (`00_check_simple.sql`,
un diagnóstico que consulta `categories` antes de que exista), así que
fallaba en cualquier PR.

## Generar la migración base

Desde la raíz del repo, con Node.js y Docker Desktop:

```bash
# macOS / Linux / Git Bash
bash scripts/db/dump-baseline-schema.sh
```

```powershell
# Windows (PowerShell)
powershell -ExecutionPolicy Bypass -File scripts/db/dump-baseline-schema.ps1
```

Después:

1. Revisar que el archivo tenga contenido (varios cientos de KB) y subirlo.
2. Ejecutar una vez `supabase/scripts/register_baseline_in_production.sql`
   en el SQL Editor de producción, para registrar la base como aplicada.

## Nuevas migraciones

- Nombre: `AAAAMMDDHHMMSS_descripcion.sql` (14 dígitos), con fecha posterior
  a la última existente.
- Deben poder ejecutarse sobre una base vacía que ya tenga la migración base:
  nada de diagnósticos (`select ... from tabla`) ni datos de prueba.
- Preferir SQL idempotente (`create or replace`, `if not exists`).
- Si se aplica a mano en producción, registrarla en
  `supabase_migrations.schema_migrations` con la misma versión.
