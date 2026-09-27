#!/usr/bin/env bash
# Genera la migración base con el esquema actual de producción.
#
# Uso (desde la raíz del repo, con Docker Desktop abierto):
#   bash scripts/db/dump-baseline-schema.sh
#
# Requiere Node.js (usa `npx supabase`) y Docker, que la CLI usa para
# ejecutar pg_dump. Solo vuelca estructura: no incluye datos.
set -euo pipefail

PROJECT_REF="cswtugmwazxdktntndpy"
VERSION="20260927000000"
OUT="supabase/migrations/${VERSION}_baseline_schema.sql"

if [ ! -d supabase/migrations_legacy ]; then
  echo "Ejecutalo desde la raíz del repositorio." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker no está corriendo. Abrí Docker Desktop y volvé a intentar." >&2
  exit 1
fi

# Inicia sesión en Supabase si hace falta (abre el navegador).
npx --yes supabase@latest projects list >/dev/null 2>&1 || npx --yes supabase@latest login

# Vincula el proyecto. Si pide la contraseña de la base, podés escribirla o
# dejarla vacía y presionar Enter: la CLI usa un rol temporal.
npx --yes supabase@latest link --project-ref "$PROJECT_REF"

npx --yes supabase@latest db dump --linked -f "$OUT"

echo
echo "Listo: $OUT"
echo "Tamaño: $(wc -c < "$OUT") bytes"
echo "Siguiente paso: git add \"$OUT\" && git commit -m 'chore(db): migración base desde producción' && git push"
