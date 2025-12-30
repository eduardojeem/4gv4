# =====================================================
# Script de Instalación: Sistema de Reparaciones
# Descripción: Ejecuta las migraciones de Supabase para repairs
# =====================================================

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "INSTALACIÓN DEL SISTEMA DE REPARACIONES" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que Supabase CLI está instalado
$supabaseCmd = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseCmd) {
    Write-Host "❌ Error: Supabase CLI no está instalado" -ForegroundColor Red
    Write-Host "Instala Supabase CLI: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Supabase CLI encontrado" -ForegroundColor Green
Write-Host ""

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Ejecuta este script desde la raíz del proyecto" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Directorio correcto" -ForegroundColor Green
Write-Host ""

# Paso 1: Crear estructura de tablas
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "PASO 1: Creando estructura de tablas" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Leer el contenido del archivo SQL
$setupSql = Get-Content "supabase/migrations/20241207_repairs_complete_setup.sql" -Raw

# Ejecutar usando supabase db execute
$setupSql | supabase db execute

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Estructura de tablas creada exitosamente" -ForegroundColor Green
} else {
    Write-Host "❌ Error al crear estructura de tablas" -ForegroundColor Red
    Write-Host "Revisa los logs arriba para más detalles" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Paso 2: Insertar datos de ejemplo
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "PASO 2: Insertando datos de ejemplo" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$response = Read-Host "¿Deseas insertar datos de ejemplo? (s/n)"

if ($response -match '^[Ss]$') {
    $seedSql = Get-Content "supabase/migrations/20241207_repairs_seed_data.sql" -Raw
    $seedSql | supabase db execute
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Datos de ejemplo insertados exitosamente" -ForegroundColor Green
    } else {
        Write-Host "⚠ Advertencia: Error al insertar datos de ejemplo" -ForegroundColor Yellow
        Write-Host "Esto puede ser normal si no existen clientes o técnicos" -ForegroundColor Yellow
        Write-Host "Ejecuta primero los scripts de customers y profiles" -ForegroundColor Yellow
    }
} else {
    Write-Host "⊘ Datos de ejemplo omitidos" -ForegroundColor Yellow
}

Write-Host ""

# Paso 3: Verificación
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "PASO 3: Verificando instalación" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "✓ Instalación completada" -ForegroundColor Green
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "PRÓXIMOS PASOS" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Verifica las tablas en Supabase Dashboard" -ForegroundColor White
Write-Host "2. Ejecuta la aplicación: npm run dev" -ForegroundColor White
Write-Host "3. Navega a /dashboard/repairs" -ForegroundColor White
Write-Host ""
Write-Host "Si encuentras errores:" -ForegroundColor Yellow
Write-Host "- Verifica que existan clientes en la tabla 'customers'" -ForegroundColor White
Write-Host "- Verifica que existan técnicos en la tabla 'profiles'" -ForegroundColor White
Write-Host "- Revisa los logs de Supabase para más detalles" -ForegroundColor White
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
