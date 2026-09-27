# Genera la migración base con el esquema actual de producción.
#
# Uso (desde la raíz del repo, con Docker Desktop abierto):
#   powershell -ExecutionPolicy Bypass -File scripts/db/dump-baseline-schema.ps1
#
# Requiere Node.js (usa `npx supabase`) y Docker, que la CLI usa para
# ejecutar pg_dump. Solo vuelca estructura: no incluye datos.
$ErrorActionPreference = 'Stop'

$ProjectRef = 'cswtugmwazxdktntndpy'
$Version = '20260927000000'
$Out = "supabase/migrations/${Version}_baseline_schema.sql"

if (-not (Test-Path 'supabase/migrations_legacy')) {
  Write-Error 'Ejecutalo desde la raíz del repositorio.'
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Error 'Docker no está corriendo. Abrí Docker Desktop y volvé a intentar.'
}

# Inicia sesión en Supabase si hace falta (abre el navegador).
npx --yes supabase@latest projects list *> $null
if ($LASTEXITCODE -ne 0) {
  npx --yes supabase@latest login
  if ($LASTEXITCODE -ne 0) { Write-Error 'No se pudo iniciar sesión en Supabase.' }
}

# Vincula el proyecto. Si pide la contraseña de la base, podés escribirla o
# dejarla vacía y presionar Enter: la CLI usa un rol temporal.
npx --yes supabase@latest link --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { Write-Error 'No se pudo vincular el proyecto.' }

npx --yes supabase@latest db dump --linked -f $Out
if ($LASTEXITCODE -ne 0) { Write-Error 'Falló el volcado del esquema.' }

Write-Host ''
Write-Host "Listo: $Out"
Write-Host ("Tamaño: {0} bytes" -f (Get-Item $Out).Length)
Write-Host "Siguiente paso: git add `"$Out`"; git commit -m 'chore(db): migración base desde producción'; git push"
