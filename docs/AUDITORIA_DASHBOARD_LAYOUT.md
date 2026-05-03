# Auditoría — Dashboard Layout + Página Principal

**Fecha:** 3 de mayo de 2026  
**Archivos auditados:**
- `src/app/dashboard/layout.tsx`
- `src/app/dashboard/page.tsx`
- `src/components/dashboard/DashboardGuard.tsx`
- `src/components/dashboard/sidebar.tsx`
- `src/components/dashboard/header.tsx`
- `src/components/dashboard/mobile-nav.tsx`
- `src/components/dashboard/scroll-to-top.tsx`
- `src/components/dashboard/scroll-restoration.tsx`
- `src/components/dashboard/stats-overview.tsx` (RecentActivity)
- `src/contexts/DashboardLayoutContext.tsx`
- `src/components/providers/session-tracking-provider.tsx`
- `src/components/demo-banner.tsx`

---

## 1. Resumen general

El dashboard tiene una arquitectura de layout con:
- **DashboardGuard**: Protección client-side por rol (solo admin/vendedor/tecnico)
- **Sidebar**: Navegación colapsable con filtrado por rol, badges dinámicos, logout
- **Header**: Breadcrumb, búsqueda global (Ctrl+K), notificaciones, tema, menú de usuario
- **MobileNav**: Barra inferior fija con 5 items + menú
- **Página principal**: KPIs en tiempo real (ventas, órdenes, clientes, productos, stock, reparaciones), acciones rápidas, actividad reciente con realtime via Supabase channels

**Estado de compilación:** ✅ Sin errores de TypeScript ni diagnósticos.

---

## 2. Hallazgos

### 🔴 Críticos

#### 2.1 Sidebar obtiene rol de `profiles.role` y `user_metadata` en lugar de `user_roles`
En `sidebar.tsx`:
```ts
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .maybeSingle()
role = (profile?.role as any) || role
```
Y antes:
```ts
let role = (user?.user_metadata?.role as any) as typeof userRole
```
El middleware usa `user_roles` como fuente de verdad, pero el sidebar usa `profiles.role` con fallback a `user_metadata.role`. Esto puede causar inconsistencias: un usuario podría ver items de navegación que no debería, o no ver items que sí debería.

**Impacto:** Un usuario con `user_roles.role = 'cliente'` pero `profiles.role = 'admin'` vería el sidebar de admin aunque el middleware lo bloquee en `/admin`.

**Recomendación:** Usar `user.role` del `AuthContext` (que ya consulta `user_roles`) en lugar de hacer una query separada.

#### 2.2 DashboardGuard es solo client-side
`DashboardGuard` verifica el rol en el cliente después de que el componente se monta. Esto significa:
- El HTML del dashboard se envía al navegador antes de verificar permisos.
- Un usuario con rol `cliente` ve un flash del dashboard antes de ser redirigido.
- Si JavaScript está deshabilitado, el dashboard es visible.

El middleware protege `/admin/*` pero **no protege `/dashboard/*`**. Cualquier usuario autenticado puede acceder al dashboard.

**Recomendación:** Agregar `/dashboard` al matcher del middleware para protección server-side.

#### 2.3 Página principal es 100% client-side sin metadata
`page.tsx` es un Client Component (`"use client"`) que hace 7 queries a Supabase en cada visita. No tiene `<title>` ni metadata. El HTML inicial es vacío.

---

### 🟡 Importantes

#### 2.4 7 queries paralelas sin cache en la página principal
```ts
const [salesToday, activeOrdersCount, newCustomersCount, totalProductsCount, 
       productsStock, repairsActiveCount, salesWeek] = await Promise.all([...])
```
Cada visita al dashboard ejecuta 7 queries a Supabase. No hay cache, SWR, ni revalidación. El botón "Actualizar" tiene un cooldown de 30s, pero la carga inicial siempre ejecuta las 7 queries.

**Recomendación:** Usar SWR o crear un endpoint API `/api/dashboard/stats` con cache server-side.

#### 2.5 Sidebar hace queries propias para badges cada 5 minutos
```ts
const interval = setInterval(fetchBadges, 5 * 60 * 1000)
```
El sidebar hace 2 queries adicionales (reparaciones activas + productos con stock bajo) cada 5 minutos. Estas mismas queries ya se hacen en la página principal. Duplicación de datos y queries.

#### 2.6 Header carga TODOS los productos para generar notificaciones de stock
```ts
loadProducts({ is_active: true })
// Check every 10 minutes
const interval = setInterval(() => {
  loadProducts({ is_active: true })
}, 10 * 60 * 1000)
```
El header carga **todos** los productos activos cada 10 minutos solo para verificar stock bajo. Con miles de productos, esto es muy ineficiente.

**Recomendación:** Crear un endpoint `/api/inventory/low-stock-count` que devuelva solo el conteo, o usar la misma query del sidebar.

#### 2.7 `DemoBanner` muestra credenciales de demo
```ts
<span>Credenciales demo: admin@demo.com / demo123</span>
```
Aunque `isDemoMode()` siempre retorna `false`, si alguien lo activa, las credenciales se muestran en pantalla. Además, el componente se importa y renderiza en cada página del dashboard.

**Recomendación:** Eliminar las credenciales del banner o eliminar el componente si el modo demo no se usa.

#### 2.8 Nombre de empresa hardcodeado en sidebar
```ts
<h1 className="text-lg font-bold text-foreground">4G celulares</h1>
<p className="text-xs text-muted-foreground">Sistema POS</p>
```
No usa `company_info.name` de settings ni `config.company.name`.

#### 2.9 `RecentActivity` duplica lógica de formateo de tiempo
La función `toTime()` está definida 2 veces dentro del mismo componente (una en `load()` y otra en `subscribe()`).

#### 2.10 Realtime subscriptions sin cleanup robusto
En `RecentActivity`, el cleanup de la suscripción realtime usa un patrón con Promise que puede fallar silenciosamente:
```ts
const cleanupPromise = subscribe()
return () => {
  void cleanupPromise.then(cleanup => {
    if (typeof cleanup === 'function') cleanup()
  })
}
```

#### 2.11 Filtrado de navegación bypaseable en desarrollo
```ts
const isDev = process.env.NODE_ENV === 'development'
const filterFn = (item: NavItem) => (isDev ? true : item.roles.includes(userRole))
```
En desarrollo, todos los items de navegación son visibles independientemente del rol. Esto puede ocultar bugs de permisos que solo aparecen en producción.

---

### 🟢 Menores / Mejoras

#### 2.12 `colorMap` duplicado entre `page.tsx` y `brand-theme.ts`
La página del dashboard define su propio `colorMap` para KPIs que es diferente al de `brand-theme.ts`.

#### 2.13 Sin `aria-label` en la navegación del sidebar
El `<nav>` del sidebar no tiene `aria-label="Navegación del dashboard"`.

#### 2.14 Mobile overlay usa `role="button"` en un `<div>`
```ts
<div role="button" tabIndex={0} aria-label="Cerrar menú" onClick={toggleSidebar}>
```
Debería ser un `<button>` semántico.

#### 2.15 `ScrollRestoration` usa `sessionStorage` sin try/catch
```ts
sessionStorage.setItem(`scroll-${pathname}`, container.scrollTop.toString())
```
En modo privado de algunos navegadores, `sessionStorage` puede lanzar excepciones.

#### 2.16 Sin metadata en el layout del dashboard
No hay `<title>` ni `<meta>` para las páginas del dashboard. El tab del navegador no muestra información útil.

---

## 3. Seguridad

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Protección de rutas | ⚠️ | `/dashboard` no está en el middleware matcher — solo protección client-side |
| Filtrado por rol | ⚠️ | Sidebar usa `profiles.role` en vez de `user_roles` |
| DashboardGuard | ⚠️ | Solo client-side, flash de contenido antes de redirect |
| Queries a Supabase | ✅ | Usan RLS, datos filtrados por permisos del usuario |
| Logout | ✅ | Confirmación con dialog, limpieza de sesión |
| Búsqueda global | ✅ | Ctrl+K con modal, no expone datos sensibles |
| Realtime | ✅ | Suscripciones a tablas con RLS |

---

## 4. Rendimiento

| Aspecto | Estado | Notas |
|---------|--------|-------|
| SSR | 🔴 | Página principal 100% client-side |
| Queries dashboard | 🔴 | 7 queries paralelas sin cache en cada visita |
| Queries sidebar | ⚠️ | 2 queries adicionales cada 5 min (duplicadas con page) |
| Queries header | 🔴 | Carga TODOS los productos cada 10 min para notificaciones |
| Dynamic imports | ✅ | `RecentActivity` cargado dinámicamente |
| Memoización | ✅ | `memo()` en Sidebar, Header, MobileNav |
| Scroll | ✅ | `will-change-scroll`, `passive: true` en listeners |
| Prefetch | ✅ | Rutas críticas prefetcheadas en header |

---

## 5. Accesibilidad

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Sidebar `aria-current` | ✅ | `aria-current="page"` en item activo |
| Sidebar collapse button | ✅ | `aria-label` descriptivo |
| Mobile overlay | ⚠️ | `<div role="button">` debería ser `<button>` |
| Sidebar nav | ⚠️ | Falta `aria-label` en `<nav>` |
| Header search | ✅ | Keyboard shortcut Ctrl+K |
| Scroll to top | ✅ | `aria-label="Volver arriba"` |
| KPI cards | ✅ | Links con texto descriptivo |
| Loading states | ✅ | Skeletons durante carga |

---

## 6. Recomendaciones priorizadas

| # | Prioridad | Acción | Estado |
|---|-----------|--------|--------|
| 1 | 🔴 Alta | Agregar `/dashboard` al matcher del middleware para protección server-side | ✅ Implementado |
| 2 | 🔴 Alta | Sidebar: usar `user.role` del AuthContext en vez de query separada a `profiles` | ✅ Implementado |
| 3 | 🔴 Alta | Agregar metadata al layout del dashboard (`<title>`, `robots: noindex`) | ✅ Implementado |
| 4 | 🟡 Media | Crear endpoint `/api/dashboard/stats` con cache para las 7 queries de KPIs | ⏳ Pendiente |
| 5 | 🟡 Media | Eliminar query de productos completa en header; usar conteo del sidebar o endpoint dedicado | ⏳ Pendiente |
| 6 | 🟡 Media | Usar `config.company.name` en sidebar en vez de "4G celulares" hardcodeado | ✅ Implementado |
| 7 | 🟡 Media | Eliminar credenciales de demo del `DemoBanner` | ✅ Implementado |
| 8 | 🟡 Media | Extraer `toTime()` duplicado a utilidad compartida | ⏳ Pendiente |
| 9 | 🟢 Baja | Agregar `aria-label` al `<nav>` del sidebar | ✅ Implementado |
| 10 | 🟢 Baja | Cambiar overlay `<div role="button">` a `<button>` | ✅ Implementado |
| 11 | 🟢 Baja | Agregar try/catch a `ScrollRestoration` sessionStorage | ✅ Implementado |
| 12 | 🟢 Baja | Eliminar bypass de filtrado de roles en desarrollo | ✅ Implementado |

---

## 7. Cambios implementados

### Archivos creados
- `middleware.ts` — Middleware con protección de `/dashboard` (requiere rol staff) además de `/admin`

### Archivos modificados
- `src/app/dashboard/layout.tsx` — Metadata con `robots: noindex` y title template
- `src/components/dashboard/sidebar.tsx` — Usa `user.role` del AuthContext, nombre de empresa dinámico, `aria-label` en nav, overlay semántico, sin bypass de roles en dev
- `src/components/dashboard/mobile-nav.tsx` — Sin bypass de roles en dev
- `src/components/dashboard/scroll-restoration.tsx` — try/catch en sessionStorage
- `src/components/demo-banner.tsx` — Eliminadas credenciales de demo
- `next.config.ts` — Eliminado `output: 'standalone'` (incompatible con Turbopack middleware)
- `package.json` — Build script limpio
