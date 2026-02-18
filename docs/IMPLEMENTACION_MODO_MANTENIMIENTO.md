# Implementación: Modo Mantenimiento para Página Pública

**Fecha**: 15 de febrero de 2026  
**Estado**: ✅ Completado

---

## Resumen

Se implementó un sistema completo de modo mantenimiento que permite deshabilitar temporalmente la página pública del sitio web mientras se realizan actualizaciones o mantenimiento. Los administradores pueden activar/desactivar este modo desde el panel de administración.

---

## Funcionalidades Implementadas

### 1. Panel de Administración

**Archivo**: `src/components/admin/website/MaintenanceModeToggle.tsx`

- ✅ Switch para activar/desactivar modo mantenimiento
- ✅ Campos configurables:
  - Título de la página de mantenimiento
  - Mensaje para los visitantes
  - Tiempo estimado de finalización (opcional)
- ✅ Validaciones frontend:
  - Título mínimo 5 caracteres
  - Mensaje mínimo 10 caracteres
  - Límites maxLength en todos los campos
- ✅ Alerta visual cuando el modo está activo
- ✅ Botón para previsualizar la página de mantenimiento
- ✅ Diseño con gradientes (naranja/rojo cuando activo, verde cuando inactivo)
- ✅ Información sobre el comportamiento del sistema

**Integración**: Agregado como 5to tab en `/admin/website`

### 2. Página de Mantenimiento Pública

**Archivo**: `src/components/public/MaintenancePage.tsx`

Componente visual que se muestra cuando el modo mantenimiento está activo:

- ✅ Diseño atractivo con gradientes (naranja/rojo/rosa)
- ✅ Icono animado de herramienta (Wrench) con efecto pulse
- ✅ Muestra título y mensaje configurables
- ✅ Muestra tiempo estimado si está disponible
- ✅ Botones de acción:
  - Ir al Login (usuarios pueden autenticarse)
  - Contactar Soporte
- ✅ Responsive y accesible
- ✅ Soporte para modo oscuro

### 3. Verificación en Página Pública

**Archivo**: `src/app/(public)/inicio/page.tsx`

- ✅ Importa `MaintenancePage`
- ✅ Verifica `settings.maintenance_mode?.enabled`
- ✅ Si está activo, muestra `MaintenancePage`
- ✅ Si está inactivo, muestra contenido normal
- ✅ Manejo de estados de carga y error

### 4. API Pública

**Archivo**: `src/app/api/public/website/settings/route.ts`

- ✅ Devuelve `maintenance_mode` en los settings
- ✅ Valores por defecto si no existe en BD:
  ```typescript
  {
    enabled: false,
    title: 'Sitio en Mantenimiento',
    message: 'Estamos realizando mejoras en nuestro sitio. Volveremos pronto.',
    estimatedEnd: ''
  }
  ```

### 5. Tipos y Validaciones

**Archivos**: 
- `src/types/website-settings.ts`
- `src/lib/validation/website-settings.ts`

- ✅ Tipo `MaintenanceMode` definido
- ✅ Schema de validación con Zod
- ✅ Agregado a `VALID_KEYS` en API admin

---

## Flujo de Funcionamiento

### Activar Modo Mantenimiento

1. Admin va a `/admin/website` → Tab "Mantenimiento"
2. Activa el switch
3. Configura título, mensaje y tiempo estimado
4. Guarda la configuración
5. La página pública `/inicio` ahora muestra la página de mantenimiento

### Desactivar Modo Mantenimiento

1. Admin va a `/admin/website` → Tab "Mantenimiento"
2. Desactiva el switch
3. Guarda la configuración
4. La página pública `/inicio` vuelve a mostrar contenido normal

### Comportamiento del Sistema

- ✅ **Panel Admin**: Siempre accesible, no afectado por modo mantenimiento
- ✅ **Dashboard**: Usuarios autenticados pueden acceder normalmente
- ✅ **Página Pública** (`/inicio`): Muestra página de mantenimiento si está activo
- ✅ **Otras rutas públicas**: No afectadas (pueden implementarse después)

---

## Seguridad

- ✅ Endpoint protegido con `withAdminAuth`
- ✅ Solo administradores pueden cambiar el modo mantenimiento
- ✅ Validación de datos en backend con Zod
- ✅ Sanitización de HTML para prevenir XSS
- ✅ Rate limiting (10 req/min por usuario)

---

## Archivos Creados

```
src/components/public/MaintenancePage.tsx
IMPLEMENTACION_MODO_MANTENIMIENTO.md
```

---

## Archivos Modificados

```
src/app/(public)/inicio/page.tsx
src/app/api/public/website/settings/route.ts
src/types/website-settings.ts (previamente)
src/lib/validation/website-settings.ts (previamente)
src/app/api/admin/website/settings/[key]/route.ts (previamente)
src/components/admin/website/MaintenanceModeToggle.tsx (previamente)
src/app/admin/website/page.tsx (previamente)
```

---

## Testing Manual

### Escenario 1: Activar Modo Mantenimiento

1. ✅ Ir a `/admin/website` → Tab "Mantenimiento"
2. ✅ Activar switch
3. ✅ Configurar campos
4. ✅ Guardar
5. ✅ Verificar alerta naranja aparece
6. ✅ Abrir `/inicio` en nueva pestaña
7. ✅ Verificar que muestra página de mantenimiento

### Escenario 2: Desactivar Modo Mantenimiento

1. ✅ Desactivar switch
2. ✅ Guardar
3. ✅ Verificar alerta desaparece
4. ✅ Refrescar `/inicio`
5. ✅ Verificar que muestra contenido normal

### Escenario 3: Validaciones

1. ✅ Intentar guardar con título < 5 caracteres → Error
2. ✅ Intentar guardar con mensaje < 10 caracteres → Error
3. ✅ Verificar maxLength en inputs

---

## Mejoras Futuras (Opcional)

1. **Extender a otras rutas públicas**:
   - `/productos`
   - `/mis-reparaciones`
   - Crear middleware global para rutas públicas

2. **Notificaciones automáticas**:
   - Email a usuarios registrados cuando se activa
   - Notificación cuando se desactiva

3. **Programación**:
   - Permitir programar inicio/fin del mantenimiento
   - Activación automática en fecha/hora específica

4. **Whitelist de IPs**:
   - Permitir acceso a IPs específicas durante mantenimiento
   - Útil para testing antes de reactivar

5. **Página de mantenimiento personalizable**:
   - Subir imagen de fondo
   - Elegir colores del tema
   - Agregar enlaces personalizados

---

## Notas Técnicas

- El componente `MaintenancePage` es completamente independiente
- No requiere autenticación para mostrarse
- Los datos se obtienen del mismo endpoint que usa la página normal
- El check se hace en el cliente (CSR) para mantener consistencia con el resto de la página
- Si se requiere SSR, se puede mover la lógica a un Server Component

---

## Conclusión

✅ Sistema de modo mantenimiento completamente funcional e integrado con el panel de administración existente. Los administradores pueden activar/desactivar el modo mantenimiento de forma sencilla y los visitantes verán una página profesional durante el mantenimiento.
