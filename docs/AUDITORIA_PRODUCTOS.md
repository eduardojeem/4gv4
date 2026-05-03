# Auditoría — Sección `/productos`

**Fecha:** 3 de mayo de 2026  
**Archivos auditados:**
- `src/app/(public)/productos/page.tsx` (catálogo)
- `src/app/(public)/productos/layout.tsx` (metadata)
- `src/app/(public)/productos/components.tsx` (search, sort, pagination, filtros móviles, badges)
- `src/app/(public)/productos/[id]/page.tsx` (detalle de producto)
- `src/app/(public)/productos/[id]/client-components.tsx` (galería, acciones de contacto)
- `src/app/api/public/products/route.ts` (API listado)
- `src/app/api/public/products/[id]/route.ts` (API detalle)
- `src/app/api/public/products/meta/route.ts` (API metadata de filtros)
- `src/components/public/ProductCard.tsx`
- `src/components/public/ProductFilters.tsx`
- `src/lib/api/products-server.ts`
- `src/types/public.ts`

---

## 1. Resumen general

La sección tiene dos páginas:

1. **Catálogo** (`/productos`): Server Component async con filtros (categoría, marca, precio, stock), búsqueda con debounce, ordenamiento y paginación. Los filtros se manejan via URL search params.

2. **Detalle** (`/productos/[id]`): Server Component con galería de imágenes, datos del producto, acciones de contacto (WhatsApp/email/teléfono), productos relacionados y JSON-LD para SEO.

Los datos se obtienen server-side via `getPublicProducts()` y `getPublicProduct()` en `products-server.ts`. Hay soporte para precios mayoristas condicionado a permisos del usuario.

**Estado de compilación:** ✅ Sin errores de TypeScript ni diagnósticos.

---

## 2. Hallazgos

### 🔴 Críticos

#### 2.1 Cache completamente deshabilitado
Ambas páginas tienen:
```ts
export const dynamic = 'force-dynamic'
export const revalidate = 0
```
Esto fuerza un fetch a Supabase en cada request, sin cache HTTP ni ISR. Para un catálogo público que cambia pocas veces al día, esto genera carga innecesaria en la base de datos y aumenta el TTFB.

**Impacto:** Cada visita al catálogo ejecuta 2+ queries a Supabase (productos + categorías). Cada visita al detalle ejecuta 2+ queries (producto + relacionados).

**Recomendación:** Usar `revalidate = 60` (1 minuto) para el catálogo y `revalidate = 120` para el detalle. Eliminar `dynamic = 'force-dynamic'`. Los datos de precios/stock se actualizarán con un delay máximo de 1-2 minutos, aceptable para un catálogo público.

#### 2.2 Metadata hardcodeada con nombre de empresa
En `layout.tsx` y `page.tsx`:
```ts
title: 'Catálogo de Productos | 4G Celulares',
```
Y en `[id]/page.tsx`:
```ts
title: `${product.name} | 4G Celulares`,
```
El nombre "4G Celulares" está hardcodeado en lugar de usar `company_info.name` de settings, como se hizo en `/inicio` y `/mis-reparaciones`.

#### 2.3 API meta calcula min/max precio en memoria
En `meta/route.ts`:
```ts
const { data: priceData } = await supabase
  .from('products')
  .select('sale_price')
  .eq('is_active', true)
// Luego: Math.min(...prices), Math.max(...prices)
```
Esto descarga TODOS los precios de productos activos al servidor y calcula min/max en JavaScript. Con miles de productos, esto es ineficiente.

**Recomendación:** Usar funciones de agregación de Supabase/PostgreSQL: `select('sale_price.min(), sale_price.max()')` o un RPC.

---

### 🟡 Importantes

#### 2.4 Constante `MAX_PRICE` duplicada en 4 archivos
`MAX_PRICE = 50_000_000` está definida en:
- `src/app/(public)/productos/page.tsx`
- `src/app/(public)/productos/components.tsx`
- `src/lib/api/products-server.ts`
- `src/components/public/ProductFilters.tsx` (hardcodeado como `50000000`)

**Recomendación:** Extraer a un archivo de constantes compartido.

#### 2.5 Lógica de limpieza de filtros duplicada en 3 lugares
La lógica para limpiar todos los filtros de URL se repite en:
- `FilterBadges.clearAll()`
- `ClearAllFiltersButton.onClear()`
- `ProductFilters.clearFilters()`

Cada una borra los mismos params manualmente. Si se agrega un nuevo filtro, hay que actualizar 3 lugares.

**Recomendación:** Extraer a una función utilitaria `clearAllProductFilters(searchParams)`.

#### 2.6 `components.tsx` contiene 6 componentes en un solo archivo
El archivo tiene ~350 líneas con `ProductSearch`, `ProductSort`, `ProductPagination`, `MobileFilters`, `FilterBadges` y `ClearAllFiltersButton`. Dificulta la navegación y el mantenimiento.

#### 2.7 Email de fallback hardcodeado
En `client-components.tsx`:
```ts
const envSupportEmail = (process.env.NEXT_PUBLIC_COMPANY_EMAIL || 'info@4gcelulares.com').toString()
```
El email de fallback es específico del negocio y podría llegar a producción si la variable no está configurada.

#### 2.8 Fallback por SKU en API de detalle sin logging
En `[id]/route.ts`, si el lookup por UUID falla, se intenta por SKU. Esto podría permitir enumeración de productos por SKU. No hay logging específico para este fallback (solo en caso de error).

**Recomendación:** Agregar logging informativo cuando se usa el fallback por SKU.

---

### 🟢 Menores / Mejoras

#### 2.9 `ProductFilters.tsx` es un componente de 400+ líneas
Maneja categorías con expansión, slider de precio, filtro de marca, filtro de stock, y lógica de colapso del sidebar. Debería descomponerse.

#### 2.10 Hook `usePublicProducts` no se usa
Existe `src/hooks/usePublicProducts.ts` pero la página usa `getPublicProducts()` server-side. El hook es dead code.

#### 2.11 Paginación sin `rel="next"` / `rel="prev"`
La paginación usa query params (`?page=2`) pero no agrega links `rel="next"` y `rel="prev"` en el `<head>` para SEO.

#### 2.12 Campo `barcode` expuesto públicamente
La API pública expone el campo `barcode` del producto. Dependiendo del negocio, esto podría ser información interna.

#### 2.13 Imágenes con `unoptimized` para data URIs
La galería usa `unoptimized={img.startsWith('data:')}` para evitar errores con data URIs. Esto bypasea la optimización de Next.js. Idealmente, las imágenes deberían estar en un CDN.

---

## 3. Seguridad

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Sanitización de búsqueda | ✅ Bueno | `sanitizeSearch()` elimina caracteres especiales de PostgREST |
| Filtrado de visibilidad | ✅ Bueno | Retail ve solo `public`, wholesale ve `public` + `wholesale` |
| Ocultación de precios mayoristas | ✅ Bueno | `wholesale_price` solo se selecciona si `isWholesale` |
| Datos sensibles | ✅ Bueno | No expone precios de compra, proveedores, etc. |
| Validación de inputs | ✅ Bueno | Parámetros numéricos parseados con `Number()`, strings sanitizados |
| Cache headers API | ✅ Bueno | `Cache-Control: public, max-age=30, s-maxage=60` en listado |
| Fallback por SKU | ⚠️ | Podría permitir enumeración, sin logging |
| Rate limiting | ⚠️ | Sin rate limiting en endpoints de productos |

---

## 4. Rendimiento

| Aspecto | Estado | Notas |
|---------|--------|-------|
| SSR | ✅ | Ambas páginas son Server Components async |
| Cache de página | 🔴 | `revalidate = 0` + `force-dynamic` deshabilita todo cache |
| Cache API meta | ✅ | `max-age=300, s-maxage=600` (5 min) |
| Queries paralelas | ✅ | `Promise.all` para productos + categorías |
| Paginación | ✅ | 16 items por página, max 50 en API |
| Imágenes | ✅ | `next/image` con `priority` en primeros 4 productos |
| Meta endpoint | 🔴 | Descarga todos los precios para calcular min/max en JS |
| Debounce búsqueda | ✅ | 300ms debounce en `ProductSearch` |
| JSON-LD | ✅ | Structured data en detalle de producto |

---

## 5. Accesibilidad

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Búsqueda con `aria-label` | ✅ | `aria-label="Buscar productos"` |
| Paginación con `aria-label` | ✅ | `aria-label="Paginacion"`, `aria-current="page"` |
| Badges de filtro con `aria-label` | ✅ | Cada botón de remover tiene label descriptivo |
| Galería con `aria-label` | ✅ | Thumbnails con `aria-label` y `aria-pressed` |
| Botón compartir | ✅ | `aria-label="Compartir producto"` |
| Mobile filters sheet | ✅ | `SheetTitle` y `SheetDescription` presentes |
| Focus indicators | ✅ | `focus-visible:ring-2` en botones de filtro |
| Breadcrumbs | ✅ | Componente `Breadcrumbs` presente |

---

## 6. SEO

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Metadata estática | ✅ | Title, description, keywords, OpenGraph en layout |
| Metadata dinámica | ✅ | `generateMetadata` en detalle con nombre de producto |
| JSON-LD | ✅ | Schema de producto con precio, stock, marca |
| Breadcrumbs | ✅ | Navegación jerárquica |
| Nombre empresa | 🔴 | Hardcodeado "4G Celulares" en metadata |
| `rel="next/prev"` | ⚠️ | Falta en paginación |
| Canonical URLs | ⚠️ | No hay canonical explícito |
| Sitemap dinámico | ⚠️ | No hay generación de sitemap para productos |

---

## 7. Recomendaciones priorizadas

| # | Prioridad | Acción |
|---|-----------|--------|
| 1 | 🔴 Alta | Habilitar cache: cambiar a `revalidate = 60` en catálogo y `revalidate = 120` en detalle, eliminar `force-dynamic` | ✅ Implementado |
| 2 | 🔴 Alta | Hacer metadata dinámica con `company_info.name` en layout y detalle | ✅ Implementado |
| 3 | 🔴 Alta | Optimizar meta endpoint: usar agregación SQL para min/max precio en lugar de cargar todos los precios | ✅ Implementado |
| 4 | 🟡 Media | Extraer `MAX_PRICE` a constante compartida | ✅ Implementado |
| 5 | 🟡 Media | Extraer lógica de limpieza de filtros a función utilitaria | ✅ Implementado |
| 6 | 🟡 Media | Eliminar email hardcodeado como fallback | ✅ Implementado |
| 7 | 🟡 Media | Agregar logging al fallback por SKU en API de detalle | ✅ Implementado |
| 8 | 🟢 Baja | Eliminar hook `usePublicProducts` no utilizado | ✅ Implementado |
| 9 | 🟢 Baja | Agregar `rel="next"` / `rel="prev"` en paginación | ✅ Implementado |
| 10 | 🟢 Baja | Descomponer `components.tsx` en archivos separados | ✅ Implementado |
| 11 | 🟢 Baja | Descomponer `ProductFilters.tsx` en sub-componentes | ✅ Implementado |

---

## 8. Cambios implementados

### Archivos creados
- `src/lib/constants/products.ts` — Constante compartida `PRODUCTS_MAX_PRICE`
- `src/lib/utils/product-filters.ts` — Funciones `readActiveProductFilters()` y `clearAllProductFilters()`
- `src/app/(public)/productos/components/ProductSearch.tsx` — Componente de búsqueda
- `src/app/(public)/productos/components/ProductSort.tsx` — Componente de ordenamiento
- `src/app/(public)/productos/components/ProductPagination.tsx` — Componente de paginación
- `src/app/(public)/productos/components/MobileFilters.tsx` — Sheet de filtros móviles
- `src/app/(public)/productos/components/FilterBadges.tsx` — Badges de filtros activos
- `src/app/(public)/productos/components/ClearAllFiltersButton.tsx` — Botón limpiar filtros
- `src/app/(public)/productos/components/PaginationLinks.tsx` — `rel="next"` / `rel="prev"` para SEO
- `src/app/(public)/productos/components/index.ts` — Barrel export
- `src/components/public/filters/CategoryFilter.tsx` — Sub-componente de filtro de categorías
- `src/components/public/filters/BrandFilter.tsx` — Sub-componente de filtro de marcas
- `src/components/public/filters/StockFilter.tsx` — Sub-componente de filtro de stock
- `src/components/public/filters/PriceFilter.tsx` — Sub-componente de filtro de precio

### Archivos modificados
- `src/app/(public)/productos/page.tsx` — Cache habilitado (`revalidate = 60`), eliminado `force-dynamic`, usa constante compartida
- `src/app/(public)/productos/layout.tsx` — Metadata dinámica con `company_info.name`
- `src/app/(public)/productos/components.tsx` — Usa constante y funciones compartidas, eliminada lógica duplicada
- `src/app/(public)/productos/[id]/page.tsx` — Cache habilitado (`revalidate = 120`), metadata dinámica con nombre de empresa
- `src/app/(public)/productos/[id]/client-components.tsx` — Eliminado email hardcodeado como fallback
- `src/app/api/public/products/meta/route.ts` — Optimizado: usa `order+limit(1)` para min/max en lugar de cargar todos los precios
- `src/app/api/public/products/[id]/route.ts` — Agregado logging al fallback por SKU
- `src/lib/api/products-server.ts` — Usa constante compartida `PRODUCTS_MAX_PRICE`
- `src/components/public/ProductFilters.tsx` — Usa constante compartida y función `clearAllProductFilters()`

### Archivos eliminados
- `src/hooks/usePublicProducts.ts` — Hook no utilizado (dead code)
- `src/app/(public)/productos/components.tsx` — Reemplazado por archivos individuales en `components/`
