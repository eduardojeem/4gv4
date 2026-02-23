# Auditoría: Sección de Configuración (/dashboard/settings)

**Fecha**: 22 de febrero de 2026  
**Ruta**: `/dashboard/settings`  
**Estado**: ⚠️ Funcional con problemas menores

---

## 📋 Resumen Ejecutivo

La sección de configuración permite a los usuarios administrar las configuraciones globales del sistema. Tiene una interfaz moderna con tabs organizados, pero presenta algunos problemas de sincronización con la base de datos y tipos TypeScript.

---

## 🎯 Funcionalidades Actuales

### 1. **Tabs de Configuración**
- ✅ **General**: Información de empresa, apariencia
- ✅ **Inventario**: Gestión de stock, proveedores, SKU
- ✅ **Notificaciones**: Email, SMS, alertas
- ✅ **Seguridad**: Contraseñas, 2FA, sesiones

### 2. **Características de UI**
- ✅ Diseño moderno con gradientes y sombras
- ✅ Tabs con iconos y colores diferenciados
- ✅ Barra flotante de cambios sin guardar
- ✅ Botones de guardar/descartar
- ✅ Tooltips informativos
- ✅ Responsive (móvil y desktop)
- ✅ Contador de cambios pendientes

### 3. **Gestión de Estado**
- ✅ Hook personalizado `useSharedSettings`
- ✅ Detección automática de cambios
- ✅ Persistencia en localStorage como backup
- ✅ Sincronización con Supabase
- ✅ Eventos personalizados para notificar cambios

---

## ⚠️ Problemas Identificados

### 1. **Errores de TypeScript** (Crítico)
**Ubicación**: `src/hooks/use-shared-settings.ts`

```typescript
// Error: Tipos incompatibles entre SharedSettings y el schema de DB
const mappedSettings = mapDBToSettings(settingsData)
setSettings(mappedSettings) // ❌ Error de tipos
```

**Causa**: Desajuste entre la interfaz `SharedSettings` y el schema de validación Zod.

**Campos faltantes en el mapeo**:
- `companyRuc`
- `colorScheme`
- `requireSupplier`
- `autoGenerateSKU`
- `requireSpecialChars`
- `twoFactorAuth`

### 2. **Falta de API Route** (Alto)
**Problema**: No existe un endpoint `/api/settings` dedicado.

**Impacto**:
- El hook accede directamente a Supabase desde el cliente
- No hay validación del lado del servidor
- No hay control de permisos centralizado
- Posibles problemas de seguridad

### 3. **Validaciones Incompletas** (Medio)
**Ubicación**: `src/hooks/use-shared-settings.ts` líneas 186-191

```typescript
// Solo valida 2 campos
if (!settings.companyName.trim()) {
  return { success: false, error: 'El nombre de la empresa es requerido' }
}

if (settings.taxRate < 0 || settings.taxRate > 100) {
  return { success: false, error: 'La tasa de impuesto debe estar entre 0 y 100' }
}
```

**Faltantes**:
- Validación de formato de email
- Validación de formato de teléfono
- Validación de RUC
- Validación de rangos numéricos (sessionTimeout, lowStockThreshold, etc.)

### 4. **Migración de Datos** (Bajo)
**Problema**: El código intenta migrar desde `app-settings-v2` pero no hay documentación.

```typescript
const oldSettings = localStorage.getItem('app-settings-v2')
if (oldSettings) {
  const parsed = JSON.parse(oldSettings)
  const migrated = { ...defaultSettings, ...parsed }
  // ...
}
```

### 5. **Manejo de Errores** (Medio)
**Problema**: Los errores de Supabase se logean pero no se muestran al usuario.

```typescript
if (supabaseError) {
  console.error('Error saving to Supabase:', supabaseError)
  // Continuar con localStorage como fallback
}
```

**Impacto**: El usuario no sabe si hubo un problema al guardar en la base de datos.

---

## 🗄️ Estructura de Base de Datos

### Tabla: `system_settings`

**Columnas principales**:
- `id` (TEXT, PK): Siempre 'system'
- `company_name` (TEXT)
- `company_email` (TEXT)
- `company_phone` (TEXT)
- `company_address` (TEXT)
- `company_ruc` (TEXT)
- `city` (TEXT)
- `currency` (TEXT)
- `tax_rate` (NUMERIC)
- `theme` (TEXT)
- `primary_color` (TEXT)
- `low_stock_threshold` (INTEGER)
- `session_timeout` (INTEGER)
- `password_min_length` (INTEGER)
- `require_special_chars` (BOOLEAN)
- `require_two_factor` (BOOLEAN)
- `email_notifications` (BOOLEAN)
- `sms_notifications` (BOOLEAN)
- `features` (JSONB)
- `social_links` (JSONB)

### Tabla: `system_settings_audit`

**Propósito**: Registro de auditoría de cambios en configuración.

**Columnas**:
- `id` (UUID, PK)
- `user_id` (UUID, FK)
- `action` (TEXT): 'update', 'create', etc.
- `field_name` (TEXT)
- `old_value` (TEXT)
- `new_value` (TEXT)
- `severity` (TEXT)
- `created_at` (TIMESTAMP)

---

## 🔒 Seguridad

### Políticas RLS Actuales

1. **Lectura pública** (⚠️ Potencial problema)
```sql
CREATE POLICY "Allow public read system settings" 
ON "public"."system_settings" 
FOR SELECT USING (true);
```

2. **Actualización autenticada**
```sql
CREATE POLICY "Allow authenticated update system settings" 
ON "public"."system_settings" 
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
```

**Problema**: Cualquier usuario autenticado puede modificar las configuraciones del sistema. Debería estar restringido solo a administradores.

---

## 📊 Análisis de Rendimiento

### Carga Inicial
- ✅ Carga desde Supabase con fallback a localStorage
- ✅ Cache en localStorage para acceso rápido
- ⚠️ No hay indicador de carga durante la carga inicial

### Guardado
- ✅ Validaciones básicas antes de guardar
- ✅ Guardado en Supabase y localStorage
- ✅ Eventos personalizados para sincronización
- ⚠️ No hay retry en caso de fallo

---

## 🎨 Experiencia de Usuario

### Puntos Fuertes
- ✅ Interfaz moderna y atractiva
- ✅ Organización clara por tabs
- ✅ Feedback visual de cambios pendientes
- ✅ Tooltips informativos
- ✅ Responsive design

### Áreas de Mejora
- ⚠️ No hay confirmación antes de descartar cambios
- ⚠️ No hay indicador de guardado exitoso persistente
- ⚠️ Falta breadcrumb de navegación
- ⚠️ No hay búsqueda de configuraciones

---

## 🔧 Recomendaciones

### Prioridad Alta

1. **Corregir tipos TypeScript**
   - Sincronizar `SharedSettings` con el schema de DB
   - Agregar campos faltantes al mapeo

2. **Crear API Route `/api/settings`**
   - Validación del lado del servidor
   - Control de permisos (solo admin)
   - Manejo centralizado de errores

3. **Mejorar RLS**
   - Restringir UPDATE solo a administradores
   - Considerar si la lectura pública es necesaria

### Prioridad Media

4. **Validaciones completas**
   - Usar Zod para todas las validaciones
   - Validar formatos (email, teléfono, RUC)
   - Validar rangos numéricos

5. **Mejor manejo de errores**
   - Mostrar errores específicos al usuario
   - Implementar retry automático
   - Logging estructurado

6. **Funcionalidades adicionales**
   - Exportar/importar configuraciones (ya existe en el hook)
   - Historial de cambios (usar audit table)
   - Resetear a valores por defecto

### Prioridad Baja

7. **UX Improvements**
   - Confirmación antes de descartar
   - Búsqueda de configuraciones
   - Breadcrumbs
   - Tour guiado para nuevos usuarios

8. **Testing**
   - Tests unitarios para el hook
   - Tests de integración para guardado
   - Tests E2E para flujo completo

---

## 📝 Archivos Relacionados

### Frontend
- `src/app/dashboard/settings/page.tsx` - Página principal
- `src/hooks/use-shared-settings.ts` - Hook de gestión de estado
- `src/lib/validations/system-settings.ts` - Validaciones Zod

### Backend
- `supabase/migrations/20260114_system_settings_complete.sql` - Tabla principal
- `supabase/migrations/20260119_add_extended_settings.sql` - Campos extendidos
- `supabase/migrations/20260219_add_company_ruc.sql` - Campo RUC
- `supabase/migrations/20260219_fix_system_settings_rls.sql` - Políticas RLS

---

## ✅ Checklist de Mejoras

- [ ] Corregir errores de TypeScript
- [ ] Crear API route `/api/settings`
- [ ] Mejorar políticas RLS (solo admin)
- [ ] Implementar validaciones completas con Zod
- [ ] Agregar manejo de errores robusto
- [ ] Agregar confirmación antes de descartar
- [ ] Implementar exportar/importar en UI
- [ ] Agregar historial de cambios
- [ ] Tests unitarios
- [ ] Tests E2E
- [ ] Documentación de usuario

---

## 🎯 Conclusión

La sección de configuración tiene una base sólida con una interfaz moderna y bien organizada. Sin embargo, necesita mejoras en:
- Corrección de tipos TypeScript
- Seguridad (RLS y API route)
- Validaciones completas
- Manejo de errores

**Prioridad de implementación**: Alta - Los problemas de tipos y seguridad deben resolverse pronto.
