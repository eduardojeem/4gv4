# 🔧 Guía de Diagnóstico: Productos no aparecen en POS

## 🚨 Problema
Los productos no se muestran en el sistema POS en producción, aunque funcionan en desarrollo.

## 🛠️ Herramientas de Diagnóstico Creadas

### 1. **Debug Panel en Tiempo Real** (Recomendado)
- **Ubicación**: Aparece automáticamente en el POS en modo desarrollo
- **Cómo usar**:
  1. Ve a `/dashboard/pos`
  2. Busca el botón "Debug POS" en la esquina inferior derecha
  3. Haz clic para abrir el panel
  4. Activa "Auto-refresh" para monitoreo en tiempo real

**Información que muestra**:
- ✅ Estado de conexión a Supabase
- 👤 Usuario autenticado y rol
- 📊 Conteo de productos en DB vs cargados
- ⏱️ Tiempo de consulta
- 🔍 Productos de ejemplo
- ⚠️ Errores y discrepancias

### 2. **Página de Diagnóstico Completa**
- **URL**: `/dashboard/pos/diagnostic`
- **Características**:
  - Diagnóstico completo del sistema
  - Botón para activar productos inactivos
  - Recomendaciones automáticas
  - Información detallada de configuración

### 3. **Migración de Corrección Automática**
- **Archivo**: `supabase/migrations/20250106_fix_pos_products_final.sql`
- **Qué hace**:
  - Activa todos los productos (`is_active = true`)
  - Limpia políticas RLS conflictivas
  - Crea políticas permisivas para lectura
  - Inserta productos de prueba si hay muy pocos
  - Ejecuta diagnóstico automático

### 4. **Scripts de Diagnóstico**

#### Script SQL (`scripts/fix-pos-products.sql`)
```sql
-- Ejecutar en Supabase SQL Editor
-- Diagnostica y corrige problemas de productos
```

#### Script JavaScript (`scripts/diagnose-pos-frontend.js`)
```javascript
// Ejecutar en consola del navegador
// Prueba conexión y estado desde el frontend
```

#### Script de Prueba (`scripts/test-pos-debug.js`)
```javascript
// Ejecutar en consola del navegador
// Verifica que el debug panel funcione correctamente
```

## 🔍 Pasos de Diagnóstico Recomendados

### Paso 1: Verificación Rápida con Debug Panel
1. Ve a `/dashboard/pos`
2. Abre el Debug Panel (botón inferior derecha)
3. Verifica:
   - ✅ Supabase: Conectado
   - ✅ Usuario: Autenticado
   - ✅ Total en DB: > 0
   - ✅ Cargados: > 0
   - ✅ Hook productos: > 0

### Paso 2: Si hay problemas, usar Diagnóstico Completo
1. Ve a `/dashboard/pos/diagnostic`
2. Ejecuta diagnóstico
3. Si hay productos inactivos, usa "Activar Todos los Productos"
4. Sigue las recomendaciones mostradas

### Paso 3: Si persisten problemas, ejecutar migración
```bash
# En tu proyecto
supabase db push
```

### Paso 4: Verificación manual en Supabase
```sql
-- Verificar productos
SELECT COUNT(*) as total, 
       COUNT(*) FILTER (WHERE is_active = true) as activos
FROM products;

-- Si hay productos inactivos, activarlos
UPDATE products SET is_active = true WHERE is_active = false;
```

## 🔧 Problemas Comunes y Soluciones

### ❌ "Total en DB: 0"
**Causa**: No hay productos en la base de datos
**Solución**: Ejecutar migraciones de seed o insertar productos manualmente

### ❌ "Cargados: 0" pero "Total en DB: > 0"
**Causa**: Políticas RLS muy restrictivas
**Solución**: Ejecutar migración `20250106_fix_pos_products_final.sql`

### ❌ "Hook productos: 0" pero "Cargados: > 0"
**Causa**: Error en el hook `usePOSProducts`
**Solución**: Revisar errores en consola del navegador

### ❌ "Usuario: No auth"
**Causa**: Usuario no autenticado
**Solución**: Iniciar sesión correctamente

### ❌ "Supabase: Desconectado"
**Causa**: Problemas de configuración o red
**Solución**: Verificar variables de entorno y conexión

## 🚀 Funciones de Corrección Rápida

### Desde Debug Panel
- **Botón "Activar Productos"**: Activa todos los productos inactivos
- **Auto-refresh**: Monitoreo continuo del estado

### Desde Consola del Navegador
```javascript
// Activar todos los productos
activarTodosLosProductos()

// Ejecutar diagnóstico completo
diagnosticarProductos()

// Probar debug panel
testDebugPanel()
```

## 📊 Interpretación de Resultados

### Estados Normales (✅)
- Supabase: Conectado
- Usuario: admin/inventory_manager/user
- Total en DB: ≥ 5
- Cargados: = Total en DB
- Hook productos: = Cargados
- Loading: No

### Estados de Alerta (⚠️)
- Total en DB: 1-4 (pocos productos)
- Cargados: < Total en DB (filtros RLS)
- Hook productos: ≠ Cargados (error en hook)

### Estados de Error (❌)
- Supabase: Desconectado
- Usuario: No auth
- Total en DB: 0
- Cargados: 0
- Hook productos: 0
- Loading: Sí (por mucho tiempo)

## 🔄 Flujo de Resolución Completo

1. **Abrir Debug Panel** → Identificar problema específico
2. **Aplicar solución rápida** → Botón "Activar Productos" si aplica
3. **Verificar resultado** → Auto-refresh para ver cambios
4. **Si persiste** → Ir a página de diagnóstico completa
5. **Si aún persiste** → Ejecutar migración SQL
6. **Verificación final** → Comprobar que productos aparezcan en POS

## 📝 Notas Importantes

- El Debug Panel solo aparece en modo desarrollo (`NODE_ENV=development`)
- Para producción, usar la página de diagnóstico (`/dashboard/pos/diagnostic`)
- Los scripts de consola funcionan en cualquier entorno
- La migración SQL es segura de ejecutar múltiples veces
- Siempre hacer backup antes de ejecutar correcciones en producción

## 🆘 Si Nada Funciona

1. Verificar logs de Supabase en el dashboard
2. Revisar políticas RLS manualmente en Supabase
3. Comprobar que las migraciones se hayan aplicado
4. Verificar variables de entorno en producción
5. Contactar soporte con los resultados del diagnóstico