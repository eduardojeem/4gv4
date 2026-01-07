# 🔧 Problema de Columnas de Stock - Diagnóstico y Solución

## 🚨 **PROBLEMA IDENTIFICADO**

**Error**: `ERROR: 42703: column "stock" does not exist`

**Causa**: Inconsistencia entre el schema de la base de datos y el código:
- **Schema original**: Define columna `stock`
- **Código y migraciones**: Usan columna `stock_quantity`
- **Resultado**: Consultas fallan porque buscan columnas que no existen

## 📋 **ANÁLISIS DEL PROBLEMA**

### **Archivos con Referencias Inconsistentes**

#### **Schema Principal** (`supabase/schema.sql`)
```sql
-- ANTES (PROBLEMÁTICO)
stock INTEGER DEFAULT 0,

-- DESPUÉS (CORREGIDO)
stock_quantity INTEGER DEFAULT 0,
```

#### **Hook usePOSProducts** (`src/hooks/usePOSProducts.ts`)
```typescript
// Usa correctamente stock_quantity
.select('id, name, sku, barcode, sale_price, stock_quantity, category_id, description, is_active')
```

#### **Componente POS** (`src/app/dashboard/pos/page.tsx`)
```typescript
// Usa correctamente stock_quantity
product.stock_quantity > 0
```

### **Inconsistencias Encontradas**

1. **Schema principal**: `stock` vs `stock_quantity`
2. **Índices duplicados**: Referencias a ambas columnas
3. **Columnas generadas**: Usan `stock` en lugar de `stock_quantity`
4. **Migraciones**: Algunas usan `stock`, otras `stock_quantity`

## ✅ **SOLUCIONES IMPLEMENTADAS**

### **1. Migración de Corrección** 
**Archivo**: `supabase/migrations/20250106_fix_stock_columns.sql`

**Funciones**:
- ✅ Detecta qué columnas existen (`stock` vs `stock_quantity`)
- ✅ Crea `stock_quantity` si no existe
- ✅ Migra datos entre columnas si ambas existen
- ✅ Sincroniza valores para evitar inconsistencias
- ✅ Crea trigger para mantener ambas columnas sincronizadas
- ✅ Corrige índices duplicados

### **2. Schema Corregido**
**Archivo**: `supabase/schema.sql`

**Cambios**:
- ✅ `stock` → `stock_quantity`
- ✅ Índices corregidos
- ✅ Columnas generadas corregidas
- ✅ Agregadas columnas faltantes (`is_active`, `barcode`, `unit_measure`)

### **3. Script de Diagnóstico**
**Archivo**: `scripts/diagnose-stock-columns.js`

**Funciones**:
- ✅ Verifica qué columnas existen
- ✅ Prueba consultas con ambas columnas
- ✅ Ejecuta la query exacta del hook usePOSProducts
- ✅ Proporciona análisis detallado de productos

## 🚀 **CÓMO APLICAR LA SOLUCIÓN**

### **Opción 1: Ejecutar Migración (Recomendado)**
```bash
# En tu proyecto Supabase
supabase db push
```

### **Opción 2: Ejecutar SQL Manualmente**
1. Ve al dashboard de Supabase
2. Abre el SQL Editor
3. Ejecuta el contenido de `supabase/migrations/20250106_fix_stock_columns.sql`

### **Opción 3: Diagnóstico desde Navegador**
1. Ve al POS (`/dashboard/pos`)
2. Abre consola del navegador (F12)
3. Copia y pega el contenido de `scripts/diagnose-stock-columns.js`
4. Presiona Enter

## 🔍 **VERIFICACIÓN POST-SOLUCIÓN**

### **Verificar en Supabase Dashboard**
```sql
-- 1. Verificar que existe stock_quantity
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' 
  AND column_name IN ('stock', 'stock_quantity');

-- 2. Verificar datos
SELECT id, name, stock_quantity, is_active 
FROM products 
LIMIT 5;
```

### **Verificar en POS**
1. ✅ Debug Panel muestra productos > 0
2. ✅ No hay errores en consola
3. ✅ Productos se cargan correctamente
4. ✅ Filtros de stock funcionan

## 📊 **IMPACTO ESPERADO**

### **Antes de la Corrección**
- ❌ Error: `column "stock" does not exist`
- ❌ Hook usePOSProducts falla
- ❌ No se cargan productos
- ❌ POS no funciona

### **Después de la Corrección**
- ✅ Consultas SQL exitosas
- ✅ Hook usePOSProducts funciona
- ✅ Productos se cargan correctamente
- ✅ POS funciona completamente

## 🎯 **PREVENCIÓN FUTURA**

### **Estándares Establecidos**
1. **Usar siempre `stock_quantity`** (no `stock`)
2. **Verificar schema antes de crear migraciones**
3. **Usar scripts de diagnóstico antes de desplegar**
4. **Mantener consistencia entre schema y código**

### **Herramientas de Verificación**
- ✅ Script de diagnóstico de columnas
- ✅ Migración con verificaciones automáticas
- ✅ Trigger de sincronización
- ✅ Debug panel para monitoreo

## 🔧 **COMANDOS ÚTILES**

### **Diagnóstico Rápido**
```javascript
// En consola del navegador
diagnosticarColumnasStock()
```

### **Verificación SQL**
```sql
-- Verificar estructura
\d products

-- Contar productos
SELECT COUNT(*) FROM products WHERE stock_quantity > 0;
```

### **Resetear si hay problemas**
```sql
-- Solo si es necesario (CUIDADO: elimina datos)
DROP TABLE IF EXISTS products CASCADE;
-- Luego ejecutar schema.sql completo
```

## 🎉 **RESULTADO FINAL**

Después de aplicar todas las correcciones:

1. ✅ **Columnas unificadas**: Solo `stock_quantity` en uso
2. ✅ **Schema consistente**: Todas las referencias corregidas
3. ✅ **Migraciones seguras**: Preservan datos existentes
4. ✅ **Código funcional**: Hook y componentes funcionan
5. ✅ **POS operativo**: Sistema completo funcionando

**El error `column "stock" does not exist` debería estar completamente resuelto.**