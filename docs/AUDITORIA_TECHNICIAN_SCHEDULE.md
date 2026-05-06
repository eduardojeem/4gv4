# Auditoría: /dashboard/technician/schedule

**Fecha:** 6 de mayo de 2026  
**Alcance:** Página de agenda del técnico, layout, componentes, hooks, contexto y API routes relacionados.

---

## 1. Resumen General

La sección `/dashboard/technician/schedule` es un **calendario semanal drag-and-drop** que permite a los técnicos:
- Ver reparaciones sin agendar (panel izquierdo)
- Arrastrar reparaciones a slots horarios en una grilla semanal de 7 días
- Navegar entre semanas
- Filtrar por urgencia/pendientes
- Configurar horario de inicio/fin del día

**Stack técnico:**
- `@dnd-kit/core` para drag & drop
- `RepairsContext` como fuente de datos (compartido con el panel principal)
- Supabase directo para persistir `estimated_completion`
- Layout propio con sidebar + header + route guard

---

## 2. Problemas Críticos 🔴

### 2.1 Persistencia directa a Supabase sin API route
**Archivo:** `src/app/dashboard/technician/schedule/page.tsx`

```typescript
const supabase = createSupabaseClient()
const { error } = await supabase
  .from('repairs')
  .update({ estimated_completion: iso })
  .eq('id', repairId)
```

Se actualiza la tabla `repairs` directamente desde el cliente sin pasar por una API route. Esto:
- Depende 100% de RLS para seguridad
- No valida que el técnico tenga permiso sobre esa reparación
- No registra auditoría del cambio
- No notifica al cliente del cambio de fecha

**Recomendación:** Usar la API route existente `/api/repairs/[id]/status` o crear una nueva `/api/repairs/[id]/schedule` con validación de permisos.

---

### 2.2 Error silenciado en persistencia
**Archivo:** `src/app/dashboard/technician/schedule/page.tsx`

```typescript
} catch {
  // silent — refreshRepairs will reconcile state
}
```

Si la actualización falla, el usuario no recibe feedback. El `refreshRepairs()` posterior puede revertir visualmente el cambio, pero sin explicación.

**Recomendación:** Mostrar un `toast.error()` con el mensaje de error y revertir el estado optimista explícitamente.

---

### 2.3 Matching de slots por ISO string exacto
**Archivo:** `src/app/dashboard/technician/schedule/page.tsx`

```typescript
const findRepairInSlot = (slot: Slot) => {
  const startIso = slot.start.toISOString()
  return scheduled.find(
    r => r.estimatedCompletion && new Date(r.estimatedCompletion).toISOString() === startIso
  )
}
```

Compara ISO strings exactos. Si `estimated_completion` se guardó con milisegundos diferentes o timezone offset, no matcheará. Además, una reparación de 2 horas solo aparece en el slot de inicio.

**Recomendación:** Comparar por rango horario (hora del día + fecha) en vez de ISO exacto. Considerar `estimatedDuration` para ocupar múltiples slots.

---

## 3. Problemas de Rendimiento 🟡

### 3.1 Re-render de toda la grilla en cada interacción
La grilla renderiza `7 días × N horas` = potencialmente 70+ `DroppableSlot` components. Cada cambio de `selectedRepairId` o `scheduled` causa re-render de todos.

**Recomendación:** Memoizar `DroppableSlot` con `React.memo` y pasar solo las props necesarias.

### 3.2 `refreshRepairs()` recarga TODAS las reparaciones
Después de cada drag & drop, se llama `refreshRepairs()` que hace un SELECT completo de todas las reparaciones del sistema. Para un solo cambio de `estimated_completion`, esto es excesivo.

**Recomendación:** Hacer update optimista local sin refresh completo, o usar el realtime subscription que ya existe en `RepairsContext`.

---

## 4. Problemas de UX 🟡

### 4.1 No hay indicación visual de duración
Las reparaciones tienen `estimatedDuration` (en minutos) pero el calendario solo ocupa 1 slot (1 hora) sin importar la duración real.

**Recomendación:** Mostrar la reparación ocupando múltiples slots según su duración estimada (ej: 2h = 2 slots).

### 4.2 No hay vista de "hoy"
No hay botón para volver rápidamente a la semana actual. El usuario debe navegar manualmente.

### 4.3 No hay confirmación al mover reparaciones
Al soltar una reparación en un slot, se guarda inmediatamente sin confirmación. Si el técnico suelta accidentalmente, no hay undo.

### 4.4 No se muestra conflicto de horarios
Si dos reparaciones se asignan al mismo slot, no hay indicación visual de conflicto ni prevención.

### 4.5 El panel de "sin agenda" no muestra prioridad visual
Las reparaciones sin agendar solo muestran urgencia como badge, pero no hay ordenamiento por prioridad ni indicación de antigüedad.

---

## 5. Funcionalidades Faltantes (Qué Agregar) 🟢

### 5.1 Vista diaria
Solo existe vista semanal. Una vista diaria con más detalle sería útil para días con muchas reparaciones.

### 5.2 Indicador de carga de trabajo
No hay visualización de cuántas horas están ocupadas vs disponibles en el día/semana.

### 5.3 Notificaciones al cliente
Cuando se agenda una reparación, el cliente no recibe notificación de la fecha estimada.

### 5.4 Recurrencia / bloques de tiempo
No se pueden bloquear horarios (almuerzo, reuniones, capacitación).

### 5.5 Vista multi-técnico (para admin)
Un admin no puede ver la agenda de todos los técnicos lado a lado para balancear carga.

### 5.6 Arrastrar para redimensionar (cambiar duración)
No se puede ajustar la duración de una reparación arrastrando el borde inferior del slot.

### 5.7 Color coding por tipo de reparación
Todas las reparaciones se ven iguales en el calendario. Sería útil colorear por tipo de dispositivo o prioridad.

### 5.8 Integración con Google Calendar / iCal
Exportar la agenda del técnico a un calendario externo.

---

## 6. Qué Se Puede Sacar / Simplificar 🔵

### 6.1 Selector de hora inicio/fin
Los selectores de `hourStart` y `hourEnd` rara vez se cambian. Podrían ser configuración del perfil del técnico en vez de controles en la UI principal.

### 6.2 Auto-selección de primera reparación
```typescript
useEffect(() => {
  if (scopedRepairs.length && !selectedRepairId) {
    setSelectedRepairId(unscheduled[0]?.id || null)
  }
}, [scopedRepairs, selectedRepairId, unscheduled])
```
Esto auto-selecciona la primera reparación sin agendar, lo cual puede confundir si el usuario no lo espera. Mejor dejar sin selección hasta que el usuario haga click.

### 6.3 Click-to-assign (redundante con drag)
El `onClickAssign` en `DroppableSlot` permite asignar haciendo click además de drag. Esto puede causar asignaciones accidentales al hacer click en un slot vacío.

---

## 7. Seguridad 🟡

### 7.1 Validación de permisos insuficiente
```typescript
if (!canViewAllRepairs && !scopedRepairs.some(r => r.id === repairId)) {
  toast.error('No tienes permisos para reprogramar esta reparación')
  return
}
```
La validación es solo en frontend. Un técnico podría modificar el ID en DevTools y reprogramar reparaciones de otro técnico si RLS no está bien configurado.

### 7.2 No hay rate limiting en actualizaciones
Un usuario podría hacer drag & drop repetidamente causando muchas escrituras a la DB.

---

## 8. Accesibilidad 🟡

### 8.1 Problemas detectados
- **Drag & drop sin alternativa de teclado**: Los usuarios que no pueden usar mouse no pueden agendar reparaciones.
- **Slots sin `role` ni `aria-label`**: Los slots droppables no tienen semántica accesible.
- **Contraste del texto "Disponible"**: `text-[11px] text-muted-foreground` puede ser difícil de leer.
- **No hay anuncio de cambio**: Cuando se mueve una reparación, no hay `aria-live` que anuncie el cambio a lectores de pantalla.

### 8.2 Buenas prácticas existentes ✅
- Botones con iconos descriptivos
- Badges con texto legible
- Estructura semántica con Card/CardHeader/CardTitle

---

## 9. Calidad de Código 🟡

### 9.1 Componente monolítico
`TechnicianSchedulePage` tiene ~200 líneas con lógica de:
- Navegación de semanas
- Filtrado
- Persistencia
- Drag & drop handlers
- Rendering de grilla

**Recomendación:** Extraer en hooks (`useScheduleNavigation`, `useSchedulePersistence`) y componentes (`WeeklyGrid`, `UnscheduledPanel`).

### 9.2 `createSupabaseClient` importado directamente
Se usa `createSupabaseClient` (diferente nombre que en otros archivos que usan `createClient`). Inconsistencia de imports.

### 9.3 Tipos inline
`type Slot = { start: Date; end: Date }` está definido inline en el archivo. Debería estar en un archivo de tipos compartido.

---

## 10. Resumen de Acciones

### Prioridad Alta (Hacer)
| Acción | Tipo | Impacto |
|--------|------|---------|
| Mover persistencia a API route | Seguridad | Evita bypass de permisos |
| Mostrar error al usuario en catch | UX | Feedback de fallos |
| Agregar botón "Hoy" | UX | Navegación rápida |
| Memoizar DroppableSlot | Performance | Menos re-renders |
| Color coding por prioridad/urgencia | UX | Mejor lectura visual |

### Prioridad Media (Considerar)
| Acción | Tipo | Impacto |
|--------|------|---------|
| Vista diaria | Feature | Más detalle |
| Indicador de carga horaria | Feature | Planificación |
| Detección de conflictos | UX | Evita doble-booking |
| Duración multi-slot | UX | Representación real |
| Bloqueo de horarios | Feature | Flexibilidad |

### Prioridad Baja (Nice to have)
| Acción | Tipo | Impacto |
|--------|------|---------|
| Vista multi-técnico | Feature | Admin |
| Export iCal | Feature | Integración |
| Drag-to-resize | Feature | UX avanzada |
| Undo/redo | UX | Seguridad de uso |

---

## 11. Aspectos Positivos ✅

- **Drag & drop funcional** con `@dnd-kit` bien integrado
- **Filtros útiles** (urgentes, pendientes, todos)
- **Navegación semanal** clara con flechas
- **Horario configurable** (inicio/fin del día)
- **Integración con RepairsContext** — datos compartidos con el panel principal
- **Route Guard** — solo técnicos autorizados acceden
- **Layout dedicado** con sidebar y header propios
- **Realtime** — cambios de otros usuarios se reflejan automáticamente
