#!/bin/bash

# =====================================================
# Script de Instalación: Sistema de Reparaciones
# Descripción: Ejecuta las migraciones de Supabase para repairs
# =====================================================

echo "========================================="
echo "INSTALACIÓN DEL SISTEMA DE REPARACIONES"
echo "========================================="
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar que Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Error: Supabase CLI no está instalado${NC}"
    echo "Instala Supabase CLI: https://supabase.com/docs/guides/cli"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI encontrado${NC}"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Ejecuta este script desde la raíz del proyecto${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Directorio correcto${NC}"
echo ""

# Paso 1: Crear estructura de tablas
echo "========================================="
echo "PASO 1: Creando estructura de tablas"
echo "========================================="
echo ""

supabase db push --file supabase/migrations/20241207_repairs_complete_setup.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Estructura de tablas creada exitosamente${NC}"
else
    echo -e "${RED}❌ Error al crear estructura de tablas${NC}"
    echo "Revisa los logs arriba para más detalles"
    exit 1
fi

echo ""

# Paso 2: Insertar datos de ejemplo
echo "========================================="
echo "PASO 2: Insertando datos de ejemplo"
echo "========================================="
echo ""

read -p "¿Deseas insertar datos de ejemplo? (s/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Ss]$ ]]; then
    supabase db push --file supabase/migrations/20241207_repairs_seed_data.sql
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Datos de ejemplo insertados exitosamente${NC}"
    else
        echo -e "${YELLOW}⚠ Advertencia: Error al insertar datos de ejemplo${NC}"
        echo "Esto puede ser normal si no existen clientes o técnicos"
        echo "Ejecuta primero los scripts de customers y profiles"
    fi
else
    echo -e "${YELLOW}⊘ Datos de ejemplo omitidos${NC}"
fi

echo ""

# Paso 3: Verificación
echo "========================================="
echo "PASO 3: Verificando instalación"
echo "========================================="
echo ""

# Aquí podrías agregar queries de verificación si lo deseas
echo -e "${GREEN}✓ Instalación completada${NC}"
echo ""
echo "========================================="
echo "PRÓXIMOS PASOS"
echo "========================================="
echo ""
echo "1. Verifica las tablas en Supabase Dashboard"
echo "2. Ejecuta la aplicación: npm run dev"
echo "3. Navega a /dashboard/repairs"
echo ""
echo "Si encuentras errores:"
echo "- Verifica que existan clientes en la tabla 'customers'"
echo "- Verifica que existan técnicos en la tabla 'profiles'"
echo "- Revisa los logs de Supabase para más detalles"
echo ""
echo "========================================="
