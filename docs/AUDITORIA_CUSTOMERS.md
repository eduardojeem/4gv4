# Auditoría: /dashboard/customers

**Fecha:** 5 de mayo de 2026  
**Alcance:** Página principal, componentes, hooks, contexto, servicio y API routes del módulo de clientes.

---

## 1. Resumen General

El módulo de clientes es una sección compleja y bien modularizada que incluye:
- Dashboard principal con métricas, filtros avanzados, búsqueda inteligente
- Vistas de tabla, grid y timeline
- CRUD completo con operaciones masivas
- Sistema de créditos integrado
- Analíticas, segmentación, comunicaciones y notificaciones
- Suscripción realtime via Supabase channels
- Atajos de teclado, prefetch predictivo, error boundary

**Arquitectura:** Context Provider (`CustomerProvider`) → hooks de estado (`useCustomerState`) + hooks de acciones (`useCustomerActions`) → servicio (`customer-service.ts`) → Supabase client.

---

## 2. Problemas Críticos 🔴

### 2.1 Carga de TODOS los clientes en memoria
**Archivo:** `src/hooks/use-customer-state.ts` (líneas ~110-130)

```typescript
while (currentPage <= totalPages) {
  const response = await customerService.getCustomers(currentPage, pageSize)
  allCustomers.push(...response.data)
  ...
}
```

Se cargan **todos** los clientes (paginando de 200 en 200) al montar el componente. Esto no escala: con 5000+ clientes habrá problemas de memoria y tiempo de carga inicial.

**Recomendación:** Implementar paginación server-side real. Solo cargar la página actual y delegar filtrado/búsqueda al backend con queries optimizadas.

---

### 2.2 Duplicación de lógica de mapeo de datos
**Archivos:** `use-customer-state.ts`, `use-customers.ts`, `customer-service.ts`

El mapeo de campos de Supabase a la interfaz `Customer` se repite en **3 lugares distintos**:
1. `mapSupabaseToCustomer` en el servicio
2. Mapeo en el handler de realtime (`use-customer-state.ts`)
3. `fetchCustomers` en `use-customers.ts`

**Recomendación:** Centralizar todo el mapeo en `customer-service.ts` y reutilizarlo.

---

### 2.3 Hook `useCustomers` duplicado y no utilizado por el dashboard
**Archivo:** `src/hooks/use-customers.ts`

Existe un hook `useCustomers` independiente que hace su propia conexión a Supabase directamente (sin pasar por el servicio), mientras que el dashboard usa `useCustomerState` + `useCustomerActions` via Context. Esto genera confusión y código muerto.

**Recomendación:** Eliminar `use-customers.ts` o consolidar con el patrón de Context actual.

---

### 2.4 Operaciones masivas sin confirmación de servidor
**Archivo:** `src/hooks/use-customer-actions.ts` → `bulkUpdate`, `bulkDelete`

Las operaciones masivas usan `createClient()` directamente (client-side Supabase) sin pasar por el servicio ni por una API route protegida. Esto depende enteramente de RLS para seguridad.

```typescript
const { error } = await supabase
  .from('customers')
  .delete()
  .in('id', customerIds)
```

**Recomendación:** Mover operaciones destructivas masivas a API routes con validación de permisos explícita (como ya se hace en `set-wholesale`).

---

### 2.5 Infinite re-render potencial en useEffect
**Archivo:** `src/hooks/use-customer-state.ts` (líneas ~290-305)

```typescript
useEffect(() => {
  setState(prev => ({
    ...prev,
    filteredCustomers,
    paginatedCustomers,
    ...
  }))
}, [filteredCustomers, paginatedCustomers, state.pagination.itemsPerPage])
```

`filteredCustomers` y `paginatedCustomers` son valores derivados de `useMemo`, pero se escriben de vuelta al estado con `setState`. Esto puede causar ciclos de re-render innecesarios ya que el `useEffect` depende de valores que él mismo actualiza indirectamente.

**Recomendación:** No almacenar valores derivados en el estado. Exponerlos directamente desde los `useMemo` sin duplicarlos en `setState`.

---

## 3. Problemas de Rendimiento 🟡

### 3.1 CustomerDashboard es un componente monolítico pesado
**Archivo:** `src/components/dashboard/customers/CustomerDashboard.tsx`

Aunque usa `dynamic()` y `lazy()` para sub-componentes, el componente principal tiene ~600 líneas con:
- 15+ hooks
- 20+ handlers
- Lógica de exportación CSV/Excel/PDF inline
- Múltiples `useMemo` pesados

**Recomendación:** Extraer la lógica de exportación a un servicio/utilidad. Mover los handlers de créditos a un hook dedicado.

### 3.2 Búsqueda fuzzy O(n²) en cliente
**Archivo:** `use-customer-state.ts` → `performIntelligentSearch`

La función de búsqueda inteligente itera sobre todos los clientes y para cada uno ejecuta múltiples operaciones de string matching. Con datasets grandes esto será lento.

**Recomendación:** Para datasets >1000, delegar la búsqueda al backend (full-text search de PostgreSQL o `ilike`).

### 3.3 Suscripción realtime sin filtros
**Archivo:** `use-customer-state.ts`

La suscripción escucha TODOS los cambios en la tabla `customers` sin filtrar por tenant/organización. En un sistema multi-tenant esto generaría tráfico innecesario.

---

## 4. Problemas de Calidad de Código 🟡

### 4.1 Uso excesivo de `any`
**Archivos:** `use-customer-actions.ts`, `customer-service.ts`

```typescript
const result: any = await (supabase as any).from('customers')...
```

Se usa `any` para evitar errores de tipos profundos de Supabase. Esto elimina la seguridad de tipos.

**Recomendación:** Generar tipos de Supabase con `supabase gen types` y usarlos correctamente.

### 4.2 Métricas hardcodeadas
**Archivo:** `CustomerDashboard.tsx`

```typescript
change: "+12%",
change: "+18%",
change: "+15%",
```

Los porcentajes de cambio en las tarjetas de métricas están hardcodeados, no reflejan datos reales.

**Recomendación:** Calcular los cambios comparando con el período anterior o eliminar si no hay datos históricos.

### 4.3 Funciones simuladas (stubs)
**Archivo:** `use-customer-actions.ts`

```typescript
const importCustomers = useCallback(async (file: File) => {
  await new Promise(resolve => setTimeout(resolve, 3000))
  toast.success("Clientes importados exitosamente")
  return { success: true, imported: 0 }
}, [])
```

`importCustomers`, `sendMessage`, y `generateReport` son stubs que simulan operaciones con `setTimeout`. El usuario ve "éxito" sin que nada ocurra realmente.

**Recomendación:** Implementar o deshabilitar estas funciones en la UI hasta que estén listas.

### 4.4 Inconsistencia en tipos Customer
**Archivos:** `src/types/customer-types.ts` vs `src/hooks/use-customer-state.ts`

Existen **dos definiciones** completamente diferentes de `Customer`:
- `types/customer-types.ts`: Interfaz rica con `firstName`, `lastName`, `contactInfo`, `addresses[]`, etc.
- `hooks/use-customer-state.ts`: Interfaz plana con `name`, `email`, `phone`, etc.

Solo la segunda se usa en la práctica. La primera parece ser un diseño aspiracional no implementado.

**Recomendación:** Eliminar `types/customer-types.ts` o alinearla con la implementación real.

---

## 5. Seguridad 🟡

### 5.1 Eliminación masiva sin rate limiting
Las operaciones `bulkDelete` y `bulkUpdate` no tienen límite de registros. Un usuario podría eliminar todos los clientes en una sola operación.

**Recomendación:** Agregar un límite máximo (ej: 50 registros por operación) y rate limiting.

### 5.2 Exportación PDF via window.open
**Archivo:** `CustomerDashboard.tsx` → `exportSelectedHistoryPDF`

```typescript
const w = window.open("", "_blank")
w.document.write(html)
```

Se genera HTML dinámico y se inyecta en una ventana nueva. Si algún dato del cliente contiene HTML malicioso, podría ejecutarse (XSS).

**Recomendación:** Sanitizar los datos antes de inyectarlos en el HTML o usar una librería de generación de PDF (jsPDF, react-pdf).

### 5.3 Validación de permisos solo en cliente
La verificación `canDelete = isAdmin || isManager` se hace solo en el frontend. Si RLS no está correctamente configurado, un usuario regular podría hacer DELETE directamente.

**Recomendación:** Verificar que RLS en Supabase restrinja DELETE/UPDATE a roles autorizados.

---

## 6. Accesibilidad 🟡

### 6.1 Buenas prácticas implementadas ✅
- `aria-label` en botones de filtros rápidos
- `aria-pressed` en toggles de vista
- `aria-expanded` en panel de filtros avanzados
- `onKeyDown` handlers para navegación por teclado
- Atajos de teclado documentados con `KeyboardShortcutsIndicator`

### 6.2 Problemas detectados
- **Tabla sin `aria-sort`**: Las columnas ordenables no indican el estado de ordenamiento a lectores de pantalla.
- **Dropdown de acciones**: El botón trigger tiene `opacity-0` por defecto (`group-hover:opacity-100`), haciéndolo invisible para usuarios de teclado hasta que se hace hover.
- **Animaciones sin `prefers-reduced-motion`**: Se usa `framer-motion` extensivamente sin respetar la preferencia del usuario.
- **Contraste en modo oscuro**: Algunos textos `text-gray-400` sobre fondos `dark:bg-slate-900` pueden no cumplir ratio 4.5:1.

---

## 7. UX / Funcionalidad 🟡

### 7.1 Doble barra de búsqueda
`CustomerFilters` tiene su propia `ImprovedSearchBar` y `CustomerListView` tiene otro `Input` de búsqueda. El usuario ve dos campos de búsqueda que filtran de forma diferente (uno filtra globalmente, otro filtra la página actual).

**Recomendación:** Eliminar la búsqueda local de `CustomerListView` o hacerla claramente distinta (ej: "filtrar en esta página").

### 7.2 Ciudades hardcodeadas en filtros
**Archivo:** `CustomerFilters.tsx`

```typescript
<SelectItem value="Montevideo">Montevideo</SelectItem>
<SelectItem value="Canelones">Canelones</SelectItem>
<SelectItem value="Maldonado">Maldonado</SelectItem>
```

Solo 3 ciudades están disponibles. Si un cliente tiene otra ciudad, no se puede filtrar.

**Recomendación:** Generar la lista de ciudades dinámicamente desde los datos de clientes.

### 7.3 Vendedores hardcodeados
Similar al punto anterior, los vendedores asignados están hardcodeados ("Juan Pérez", "María López", "Pedro García").

---

## 8. Resumen de Acciones Prioritarias

| Prioridad | Acción | Impacto |
|-----------|--------|---------|
| 🔴 Alta | Implementar paginación server-side | Performance/Escalabilidad |
| 🔴 Alta | Eliminar valores derivados del estado | Estabilidad (re-renders) |
| 🔴 Alta | Mover operaciones masivas a API routes | Seguridad |
| 🟡 Media | Consolidar hooks duplicados | Mantenibilidad |
| 🟡 Media | Centralizar mapeo de datos | DRY/Bugs |
| 🟡 Media | Sanitizar exportación PDF | Seguridad (XSS) |
| 🟡 Media | Eliminar stubs o deshabilitar en UI | UX/Confianza |
| 🟡 Media | Generar filtros dinámicos | UX |
| 🟢 Baja | Eliminar tipos no usados | Limpieza |
| 🟢 Baja | Calcular métricas reales | UX |
| 🟢 Baja | Mejorar accesibilidad de tabla | A11y |

---

## 9. Aspectos Positivos ✅

- **Arquitectura modular**: Buena separación con Context, hooks de estado/acciones, y servicio.
- **Error Boundary robusto**: Categorización de errores, UI contextual, logging.
- **Realtime**: Suscripción a cambios en tiempo real bien implementada.
- **Validación con Zod**: El servicio valida datos antes de enviar a la DB.
- **Retry automático**: Operaciones críticas usan `withRetry` con backoff.
- **Prefetch predictivo**: Se pre-cargan datos relacionados al seleccionar un cliente.
- **Keyboard shortcuts**: Sistema completo de atajos documentados.
- **Modo compacto**: Toggle para adaptar la densidad de información.
- **Permisos en UI**: Botones destructivos solo visibles para admin/manager.
- **Dynamic imports**: Componentes pesados cargados bajo demanda.
