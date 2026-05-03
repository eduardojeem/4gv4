# Auditoría — Sección `/mis-reparaciones`

**Fecha:** 3 de mayo de 2026  
**Archivos auditados:**
- `src/app/(public)/mis-reparaciones/page.tsx` (listado + búsqueda)
- `src/app/(public)/mis-reparaciones/layout.tsx` (metadata)
- `src/app/(public)/mis-reparaciones/components.tsx` (formulario de búsqueda)
- `src/app/(public)/mis-reparaciones/[ticketId]/page.tsx` (detalle de reparación)
- `src/app/api/public/repairs/auth/route.ts` (autenticación por ticket)
- `src/app/api/public/repairs/[ticketId]/route.ts` (detalle API)
- `src/lib/public-session.ts` (tokens JWT)
- `src/lib/rate-limiter.ts` (rate limiting)
- `src/lib/security-audit.ts` (auditoría de seguridad)
- `src/lib/repair-qr.ts` (verificación QR)
- `src/lib/cache.ts` (LRU cache)
- `src/schemas/public-auth.schema.ts` (validación de inputs)
- `src/lib/currency.ts` (formateo de moneda)
- `src/types/public.ts` (tipos)

---

## 1. Resumen general

La sección tiene dos flujos:

1. **Búsqueda pública** (`/mis-reparaciones`): Formulario donde cualquier persona ingresa ticket + contacto. La API valida el contacto contra el cliente registrado, genera un JWT temporal (30 min) en cookie httpOnly, y redirige al detalle.

2. **Detalle de reparación** (`/mis-reparaciones/[ticketId]`): Muestra estado, timeline, datos del dispositivo, costos y acciones. Requiere token válido o hash QR de verificación. Incluye polling cada 2 minutos.

Si el usuario está logueado, la página principal también muestra un historial de reparaciones obtenido server-side.

**Estado de compilación:** ✅ Sin errores de TypeScript ni diagnósticos.

---

## 2. Hallazgos

### 🔴 Críticos

#### 2.1 Secret key hardcodeada como fallback en producción
En `src/lib/public-session.ts`:
```ts
const SECRET_KEY = new TextEncoder().encode(
  process.env.PUBLIC_SESSION_SECRET || 'your-secret-key-change-in-production'
)
```
Si la variable de entorno `PUBLIC_SESSION_SECRET` no está configurada, se usa un secret predecible. Cualquier atacante podría forjar tokens JWT válidos.

El mismo problema existe en `src/lib/repair-qr.ts`:
```ts
const secret = process.env.REPAIR_QR_SECRET || 'default-secret-change-in-production'
```

**Impacto:** Un atacante podría generar tokens para ver cualquier reparación sin autenticarse.

**Recomendación:** Lanzar un error en producción si los secrets no están configurados, en lugar de usar fallbacks.

#### 2.2 Comparación de teléfono demasiado permisiva
En `auth/route.ts`, la lógica de comparación de teléfono:
```ts
customerPhoneNormalized.endsWith(inputPhoneNormalized) ||
inputPhoneNormalized.endsWith(customerPhoneNormalized)
```
Esto permite que un número parcial coincida. Si el teléfono del cliente es `+595981234567`, un atacante podría ingresar solo `1234567` (los últimos 7 dígitos) y pasar la verificación. En muchos países, los últimos 7 dígitos no son únicos.

**Recomendación:** Requerir al menos los últimos 8-10 dígitos para la coincidencia parcial, o mejor aún, requerir coincidencia exacta después de normalizar el código de país.

#### 2.3 Página de detalle es 100% client-side sin metadata SEO
`[ticketId]/page.tsx` es un Client Component (`'use client'`). No tiene `generateMetadata`. Si bien el contenido es privado y no necesita indexación, la falta de SSR significa:
- El HTML inicial es un spinner vacío.
- No hay título de página dinámico (el tab del navegador no muestra el ticket).
- El LCP es alto porque todo se carga después del JS.

**Recomendación:** Convertir a Server Component con fetch server-side del ticket (si hay token en cookie), pasando datos al client component. Al menos agregar metadata dinámica.

---

### 🟡 Importantes

#### 2.4 `setInterval` para cleanup de cache en módulo de API
En `[ticketId]/route.ts`:
```ts
setInterval(() => repairCache.cleanup(), 10 * 60 * 1000)
```
Este `setInterval` se ejecuta a nivel de módulo en un entorno serverless. En plataformas como Vercel, los workers se reciclan frecuentemente, por lo que este interval puede no ejecutarse nunca o causar memory leaks si el módulo se reimporta.

**Recomendación:** Hacer cleanup lazy (al acceder al cache) en lugar de con un timer.

#### 2.5 Inconsistencia de moneda entre listado y detalle
- La página principal (`page.tsx`) usa `formatCurrency()` de `@/lib/currency` que lee `NEXT_PUBLIC_CURRENCY` (default: PYG).
- La página de detalle (`[ticketId]/page.tsx`) usa `Intl.NumberFormat('es-PY', { currency: 'PYG' })` hardcodeado.

Si se cambia la moneda en las variables de entorno, el detalle seguirá mostrando PYG.

**Recomendación:** Usar `formatCurrency()` consistentemente en ambas páginas.

#### 2.6 Página de detalle: componente monolítico de ~400 líneas
`[ticketId]/page.tsx` contiene toda la lógica, configuración de estados, UI del stepper, sidebar, timeline, etc. en un solo componente. Dificulta mantenimiento y testing.

#### 2.7 Metadata hardcodeada con nombre de empresa
En `layout.tsx`:
```ts
title: 'Rastrear Reparación | 4G Celulares',
```
El nombre "4G Celulares" está hardcodeado en lugar de usar `company_info.name` de settings, como se hizo en `/inicio`.

#### 2.8 Redirección silenciosa en error de carga
En `[ticketId]/page.tsx`, el `onError` de SWR redirige al usuario a `/mis-reparaciones` sin explicar qué pasó:
```ts
onError: () => {
  if (!verifyHash) {
    toast.error('No se pudo cargar la reparacion')
    router.push('/mis-reparaciones')
  }
},
```
Si hay un error de red temporal, el usuario pierde su contexto y tiene que volver a autenticarse.

**Recomendación:** Mostrar un estado de error con botón de reintentar en lugar de redirigir.

#### 2.9 Token de autenticación no se renueva
El token JWT dura 30 minutos. Si el usuario está viendo el detalle y el token expira, el polling de SWR (cada 2 min) empezará a fallar silenciosamente. No hay mecanismo de renovación.

**Recomendación:** Detectar error 401 en el fetcher y mostrar un mensaje de "sesión expirada" con opción de re-autenticarse.

#### 2.10 Historial de reparaciones sin paginación
La página principal carga TODAS las reparaciones del cliente sin límite:
```ts
const { data: repairsData } = await supabase
  .from('repairs')
  .select(...)
  .eq('customer_id', customer.id)
  .order('created_at', { ascending: false })
```
Un cliente con muchas reparaciones podría tener una página muy pesada.

**Recomendación:** Agregar `.limit(20)` o implementar paginación.

---

### 🟢 Menores / Mejoras

#### 2.11 `require('crypto')` dinámico en `repair-qr.ts`
```ts
const { createHash } = require('crypto')
```
Usa `require` dinámico en lugar de `import`. Esto funciona pero no es idiomático en un proyecto ESM/TypeScript.

#### 2.12 Botón "Volver" usa `router.push` en lugar de `router.back()`
En `[ticketId]/page.tsx`, el botón "Volver" siempre navega a `/mis-reparaciones` en lugar de volver a la página anterior. Si el usuario llegó desde un QR externo, esto es correcto. Pero si navegó desde el historial, `router.back()` sería más natural.

#### 2.13 WhatsApp con número hardcodeado como fallback
```ts
const phone = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '595981234567'
```
El número de fallback es un placeholder que podría llegar a producción si la variable no está configurada.

#### 2.14 `StatusBadge` duplicado
El componente `StatusBadge` en `page.tsx` y la configuración `STATUS_CONFIG` en `[ticketId]/page.tsx` definen los mismos estados con estilos diferentes. Deberían compartir una fuente de verdad.

#### 2.15 Formulario de búsqueda sin `aria-describedby` en campos
Los campos del formulario tienen `FormLabel` y `FormMessage` pero no usan `aria-describedby` para conectar el mensaje de ayuda ("Si llegaste desde un QR...") con el formulario.

#### 2.16 Tabla de reparaciones sin `aria-label`
La tabla de historial no tiene `aria-label` ni `caption` para lectores de pantalla.

#### 2.17 Verificación QR siempre muestra "verificado" si hay datos
En `[ticketId]/page.tsx`:
```ts
useEffect(() => {
  if (!verifyHash || !repair || hasShownVerifiedToast.current) return
  setQrVerified(true) // Siempre true si hay repair
}, [verifyHash, repair])
```
Si el hash QR es inválido, la API devuelve 403 y `repair` es null, así que el badge no se muestra. Pero si la API devuelve datos (hash válido), `qrVerified` siempre es `true`. El estado `false` de `qrVerified` nunca se alcanza en la práctica, haciendo el código del badge de "Verificación Fallida" dead code.

---

## 3. Seguridad

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Autenticación por ticket + contacto | ✅ Bueno | Doble factor: ticket + email/teléfono |
| Rate limiting | ✅ Bueno | Doble capa: in-memory + DB-based, 10 intentos/15 min |
| Auditoría de accesos | ✅ Bueno | Todos los intentos se logean en `public_access_audit` |
| Tokens JWT | ⚠️ | Funcional pero con secret fallback inseguro |
| Cookie httpOnly + secure + sameSite | ✅ Bueno | Token en cookie segura |
| Validación de inputs | ✅ Bueno | Zod schema con regex para ticket y contacto |
| Sanitización de ticket | ✅ Bueno | `.trim().toUpperCase()` + regex validation |
| Hash de contacto en logs | ✅ Bueno | SHA-256 para privacidad |
| Datos sensibles filtrados | ✅ Bueno | `PublicRepair` excluye notas internas, costos de compra, etc. |
| Comparación de teléfono | 🔴 | Demasiado permisiva con `endsWith` |
| IP blocking | ✅ Bueno | Bloqueo persistente en DB tras 10 fallos |
| QR verification | ✅ Bueno | Hash SHA-256 con secret, verificación server-side |
| Secret keys fallback | 🔴 | Fallbacks predecibles en producción |

---

## 4. Rendimiento

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Página principal SSR | ✅ | Server Component async, fetch directo a Supabase |
| Página detalle SSR | 🔴 | 100% client-side, spinner en primer render |
| Cache API detalle | ✅ | LRU cache de 100 entries, 5 min TTL |
| Polling | ✅ | SWR con `refreshInterval: 120000` (2 min), `dedupingInterval: 60000` |
| Queries paralelas | ✅ | `Promise.all` para technician + customer + statusHistory |
| Paginación historial | 🔴 | Sin límite en query de reparaciones del usuario |
| `setInterval` en serverless | ⚠️ | Timer de cleanup puede no ejecutarse |

---

## 5. Accesibilidad

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Formulario con labels | ✅ | `FormLabel` en todos los campos |
| Validación con mensajes | ✅ | `FormMessage` muestra errores de Zod |
| Tabla responsive | ✅ | Columnas ocultas en mobile con `hidden md:table-cell` |
| Stepper visual | ⚠️ | Solo visual, sin `role="progressbar"` ni `aria-valuenow` |
| Botón volver | ✅ | Texto descriptivo con icono |
| Badge de estado | ✅ | Texto legible en el badge |
| Tabla sin `aria-label` | ⚠️ | Falta `aria-label` o `<caption>` |
| Loading states | ✅ | Spinner con texto descriptivo |
| Error states | ✅ | Mensajes claros con acciones |

---

## 6. Recomendaciones priorizadas

| # | Prioridad | Acción | Estado |
|---|-----------|--------|--------|
| 1 | 🔴 Alta | Eliminar fallbacks de secrets y lanzar error en producción si `PUBLIC_SESSION_SECRET` o `REPAIR_QR_SECRET` no están configurados | ✅ Implementado |
| 2 | 🔴 Alta | Endurecer comparación de teléfono: requerir mínimo 8 dígitos coincidentes | ✅ Implementado |
| 3 | 🔴 Alta | Agregar SSR al detalle de reparación con metadata dinámica del ticket | ✅ Implementado |
| 4 | 🟡 Media | Usar `formatCurrency()` consistentemente en la página de detalle | ✅ Implementado |
| 5 | 🟡 Media | Agregar `.limit(20)` al query de historial de reparaciones | ✅ Implementado |
| 6 | 🟡 Media | Detectar token expirado (401) en el fetcher de SWR y mostrar UI de re-autenticación | ✅ Implementado |
| 7 | 🟡 Media | Reemplazar `setInterval` de cleanup por cleanup lazy en el cache | ✅ Implementado |
| 8 | 🟡 Media | Hacer metadata dinámica en layout usando `company_info.name` | ✅ Implementado |
| 9 | 🟢 Baja | Extraer `StatusBadge` y `STATUS_CONFIG` a componentes/constantes compartidas | ✅ Implementado |
| 10 | 🟢 Baja | Eliminar dead code del badge "Verificación Fallida" | ✅ Implementado |
| 11 | 🟢 Baja | Agregar `aria-label` a la tabla de historial y `role="progressbar"` al stepper | ✅ Implementado |
| 12 | 🟢 Baja | Reemplazar `require('crypto')` por `import` estático en `repair-qr.ts` | ✅ Implementado |
| 13 | 🟢 Baja | Eliminar número de WhatsApp hardcodeado como fallback | ✅ Implementado |

---

## 7. Cambios implementados

### Archivos creados
- `src/lib/constants/repair-status.ts` — Constantes compartidas: `REPAIR_STATUS_CONFIG`, `REPAIR_TIMELINE_STEPS`, `getRepairStatusConfig()`
- `src/app/(public)/mis-reparaciones/[ticketId]/RepairDetailClient.tsx` — Client component con manejo de sesión expirada, `formatCurrency` consistente, botón reintentar, `role="progressbar"` en stepper

### Archivos modificados
- `src/app/(public)/mis-reparaciones/[ticketId]/page.tsx` — Convertido a Server Component async con `generateMetadata` dinámica y fetch server-side del ticket
- `src/app/(public)/mis-reparaciones/layout.tsx` — Metadata dinámica usando `company_info.name`
- `src/app/(public)/mis-reparaciones/page.tsx` — Agregado `.limit(20)` al query y `aria-label` a la tabla
- `src/lib/public-session.ts` — Secret lazy con error en producción si no está configurado
- `src/lib/repair-qr.ts` — Secret lazy con error en producción, `import` estático de crypto, eliminado `simpleHash` inseguro
- `src/app/api/public/repairs/auth/route.ts` — Comparación de teléfono endurecida (mínimo 8 dígitos)
- `src/app/api/public/repairs/[ticketId]/route.ts` — Eliminado `setInterval`, cleanup lazy en el cache
