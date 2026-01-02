# =====================================================
# Script de Corrección: Esquema de Clientes
# Descripción: Agrega columnas faltantes a la tabla customers
# =====================================================

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "CORRECCIÓN DE ESQUEMA DE CLIENTES" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que Supabase CLI está instalado
$supabaseCmd = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseCmd) {
    Write-Host "❌ Error: Supabase CLI no está instalado" -ForegroundColor Red
    Write-Host "Por favor, ejecuta el contenido de scripts/fix-customers-schema.sql en el Editor SQL de Supabase." -ForegroundColor Yellow
    exit 1
}

# Leer el contenido del archivo SQL
$fixSql = Get-Content "scripts/fix-customers-schema.sql" -Raw

$response = Read-Host "¿Deseas ejecutar la corrección en tu proyecto remoto? (s/n)"

if ($response -match '^[Ss]$') {
    $fixSql | supabase db execute
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Esquema corregido exitosamente" -ForegroundColor Green
    } else {
        Write-Host "❌ Error al corregir esquema" -ForegroundColor Red
    }
} else {
    Write-Host "Operación cancelada." -ForegroundColor Yellow
}
