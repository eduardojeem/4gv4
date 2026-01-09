# 🔧 Corrección de Permisos de Categorías

Este conjunto de scripts corrige los permisos RLS (Row Level Security) para la sección de categorías en Supabase.

## 📁 Archivos Incluidos

### Scripts SQL (Compatibles con Supabase SQL Editor)
- `supabase/migrations/20250107_fix_categories_permissions_simple.sql` - Script principal (USAR ESTE)
- `scripts/verify-categories-permissions-simple.sql` - Script de verificación (USAR ESTE)
- `scripts/reset-categories-permissions-simple.sql` - Script de emergencia (USAR ESTE)

### Scripts SQL (Versión Completa - Para uso con psql)
- `supabase/migrations/20250107_fix_categories_permissions.sql` - Script principal completo
- `scripts/verify-categories-permissions.sql` - Script de verificación completo
- `scripts/reset-categories-permissions.sql` - Script de emergencia completo

### Scripts Node.js
- `scripts/fix-categories-permissions.js` - Ejecutor automático

## 🚀 Uso Rápido

### Opción 1: Supabase SQL Editor (Recomendado para el error que tienes)

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Ve a **SQL Editor**
3. Copia y pega el contenido de: `supabase/migrations/20250107_fix_categories_permissions_simple.sql`
4. Haz clic en **Run**

### Opción 2: Ejecutar desde Node.js
```bash
# Corrección normal
node scripts/fix-categories-permissions.js

# Reset de emergencia
node scripts/fix-categories-permissions.js reset
```

### Opción 3: psql (Si tienes acceso directo)
```bash
psql -h db.xxx.supabase.co -p 5432 -d postgres -U postgres -f supabase/migrations/20250107_fix_categories_permissions.sql
```

## 📋 Qué Hace el Script

### 1. Verificaciones Iniciales
- ✅ Verifica que la tabla `categories` existe
- ✅ Habilita RLS en la tabla
- ✅ Elimina políticas conflictivas anteriores

### 2. Configuración de Permisos
- 📖 **LECTURA**: Todos los usuarios autenticados pueden ver categorías
- ✏️ **ESCRITURA**: Solo usuarios con roles específicos pueden modificar

### 3. Roles con Permisos de Escritura
- `admin` - Administrador completo
- `super_admin` - Super administrador
- `inventory_manager` - Gestor de inventario
- `manager` - Gerente
- `vendedor` - Vendedor

### 4. Funcionalidades Adicionales
- 🔧 Crea función helper para verificar permisos
- 📊 Inserta categorías por defecto
- ✅ Verifica la configuración final

## 🔍 Verificación

### Verificar Políticas Activas
```sql
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'categories';
```

### Verificar RLS Habilitado
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'categories';
```

### Probar Permisos
```sql
-- Debería funcionar para todos los usuarios autenticados
SELECT * FROM categories;

-- Debería funcionar solo para usuarios con permisos de escritura
INSERT INTO categories (name, description) 
VALUES ('Test', 'Prueba');
```

## 🚨 Solución de Problemas

### ❌ Error: "syntax error at or near '$'"
**Causa**: Los bloques `DO $` no son compatibles con el SQL Editor de Supabase
**Solución**: Usar las versiones "simple" de los scripts

1. **En lugar de**: `20250107_fix_categories_permissions.sql`
2. **Usar**: `20250107_fix_categories_permissions_simple.sql`

**Pasos para solucionarlo**:
1. Ve a Supabase Dashboard → SQL Editor
2. Copia el contenido de `supabase/migrations/20250107_fix_categories_permissions_simple.sql`
3. Pégalo en el editor
4. Haz clic en "Run"

### Problema: "No se puede acceder a categories"
**Solución**: Ejecutar reset de emergencia
```bash
node scripts/fix-categories-permissions.js reset
```

### Problema: "Usuario sin permisos para modificar"
**Solución**: Verificar rol del usuario
```sql
-- Verificar rol en profiles
SELECT id, email, role FROM profiles WHERE id = auth.uid();

-- Verificar rol en user_roles
SELECT user_id, role FROM user_roles WHERE user_id = auth.uid();
```

### Problema: "Políticas duplicadas"
**Solución**: El script elimina automáticamente políticas duplicadas

## 📊 Estados de Permisos

### ✅ Estado Correcto
- RLS habilitado
- 4 políticas activas (SELECT, INSERT, UPDATE, DELETE)
- Función helper existe
- Categorías por defecto insertadas

### ❌ Estado Problemático
- RLS deshabilitado
- Políticas faltantes o duplicadas
- Errores de acceso
- Función helper faltante

## 🔄 Flujo de Corrección

1. **Diagnóstico**: El script verifica el estado actual
2. **Limpieza**: Elimina políticas conflictivas
3. **Configuración**: Crea nuevas políticas optimizadas
4. **Verificación**: Confirma que todo funciona
5. **Reporte**: Muestra resumen de cambios

## 🛡️ Seguridad

### Principios Aplicados
- **Principio de menor privilegio**: Solo permisos necesarios
- **Separación de roles**: Lectura vs escritura
- **Fallback seguro**: Si no hay roles, denegar escritura
- **Auditoría**: Todas las operaciones son rastreables

### Roles y Permisos
```
┌─────────────────┬─────────┬─────────┬─────────┬─────────┐
│ Rol             │ SELECT  │ INSERT  │ UPDATE  │ DELETE  │
├─────────────────┼─────────┼─────────┼─────────┼─────────┤
│ Todos autent.   │   ✅    │   ❌    │   ❌    │   ❌    │
│ admin           │   ✅    │   ✅    │   ✅    │   ✅    │
│ super_admin     │   ✅    │   ✅    │   ✅    │   ✅    │
│ manager         │   ✅    │   ✅    │   ✅    │   ✅    │
│ inventory_mgr   │   ✅    │   ✅    │   ✅    │   ✅    │
│ vendedor        │   ✅    │   ✅    │   ✅    │   ✅    │
└─────────────────┴─────────┴─────────┴─────────┴─────────┘
```

## 📝 Variables de Entorno

```bash
# Requeridas para el script Node.js
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

## 🔗 Archivos Relacionados

- `src/app/dashboard/categories/page.tsx` - Página de categorías
- `src/hooks/use-categories.ts` - Hook de categorías
- `supabase/schema.sql` - Esquema principal
- `src/lib/supabase/client.ts` - Cliente Supabase

## 📞 Soporte

Si encuentras problemas:

1. **Verificar logs**: Revisar mensajes del script
2. **Ejecutar verificación**: Usar `verify-categories-permissions.sql`
3. **Reset de emergencia**: Usar modo `reset` si es necesario
4. **Revisar roles**: Confirmar que el usuario tiene el rol correcto

---

**⚠️ Importante**: Siempre hacer backup antes de ejecutar scripts en producción.