# =====================================================
# Script de Instalación: Tabla de Clientes
# Descripción: Ejecuta las migraciones de Supabase para clientes
# =====================================================

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "INSTALACIÓN DE TABLA DE CLIENTES" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que Supabase CLI está instalado
$supabaseCmd = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseCmd) {
    Write-Host "❌ Error: Supabase CLI no está instalado" -ForegroundColor Red
    Write-Host "Instala Supabase CLI: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
    Write-Host "O ejecuta el contenido de scripts/create-customers-table.sql en el Editor SQL de Supabase Dashboard." -ForegroundColor Yellow
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

# Paso 1: Crear tabla de clientes
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "PASO 1: Creando tabla de clientes" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Leer el contenido del archivo SQL
$setupSql = Get-Content "scripts/create-customers-table.sql" -Raw

# Ejecutar usando supabase db execute
# Nota: Esto asume que estás conectado a tu proyecto remoto o local
$response = Read-Host "¿Deseas ejecutar esto en tu proyecto remoto (linked)? (s/n)"

if ($response -match '^[Ss]$') {
    $setupSql | supabase db execute
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Tabla customers creada exitosamente" -ForegroundColor Green
    } else {
        Write-Host "❌ Error al crear tabla customers" -ForegroundColor Red
        Write-Host "Revisa los logs arriba para más detalles" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "Copia el contenido de scripts/create-customers-table.sql y ejecútalo en Supabase SQL Editor." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "FINALIZADO" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
