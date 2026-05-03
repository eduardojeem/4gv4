# Auditoría — Sección `/inicio`

**Fecha:** 3 de mayo de 2026  
**Archivos auditados:**
- `src/app/(public)/inicio/page.tsx` (página principal)
- `src/app/(public)/layout.tsx` (layout público)
- `src/hooks/useWebsiteSettings.ts` (hook de datos)
- `src/app/api/public/website/settings/route.ts` (API settings)
- `src/app/api/public/products/route.ts` (API productos)
- `src/components/public/PublicHeader.tsx`
- `src/components/public/PublicFooter.tsx`
- `src/components/public/MaintenanceGuard.tsx`
- `src/components/whatsapp-float-button.tsx`
- `src/components/ui/skip-link.tsx`
- `src/types/website-settings.ts`
- `middleware.ts`

---

## 1. Resumen general

La sección `/inicio` es una landing page pública tipo "one-page" con las siguientes secciones:
- **Hero** con stats, CTA y badge dinámicos
- **Ofertas/productos destacados** con carrusel horizontal
- **Servicios** (dinámicos desde settings)
- **Proceso** ("Cómo funciona" — 4 pasos estáticos)
- **Testimonios** (dinámicos desde settings)
- **CTA final** con info de contacto

Los datos provienen de `useWebsiteSettings` (SWR + Supabase realtime) y un fetch directo a `/api/public/products` para las ofertas.

**Estado de compilación:** ✅ Sin errores de TypeScript ni diagnósticos.

---

## 2. Hallazgos

### 🔴 Críticos

#### 2.1 Componente monolítico de ~600 líneas
El archivo `page.tsx` contiene toda la lógica y UI en un solo componente `HomePage`. Esto dificulta el mantenimiento, testing y la reutilización. Cada sección (Hero, Ofertas, Servicios, Proceso, Testimonios, CTA) debería ser un componente independiente.

**Impacto:** Mantenibilidad baja, re-renders innecesarios de toda la página ante cualquier cambio de estado.

#### 2.2 Fetch de productos sin manejo de cache en cliente
El `useEffect` que carga ofertas hace un `fetch('/api/public/products?...')` directo sin SWR ni React Query. Esto significa:
- No hay deduplicación de requests si el componente se remonta.
- No hay cache en cliente (a diferencia de `useWebsiteSettings` que usa SWR).
- No hay revalidación automática.

**Recomendación:** Usar SWR consistentemente, como ya se hace con settings.

#### 2.3 Página completamente client-side (`'use client'`) sin SSR/SSG
Toda la página es un Client Component. Esto significa:
- El HTML inicial enviado al navegador está vacío (solo un spinner).
- **SEO nulo**: los buscadores no ven contenido en el primer render.
- **LCP alto**: el usuario ve un spinner hasta que se cargan settings + productos.
- Para una landing page pública, esto es un problema serio.

**Recomendación:** Convertir a Server Component con fetch de settings en el servidor, o al menos usar `generateMetadata` y renderizar el contenido estático en SSR.

---

### 🟡 Importantes

#### 2.4 Footer con horarios hardcodeados
`PublicFooter.tsx` muestra horarios estáticos ("Lun - Vie: 8:00 - 18:00", "Sabados: 9:00 - 13:00") en lugar de usar `company_info.hours` de settings. Esto contradice la configuración dinámica del admin.

#### 2.5 Footer con nombre de empresa hardcodeado
El footer muestra "4G Celulares" en texto fijo en lugar de usar `company_info.name`. Lo mismo ocurre con la descripción y el copyright.

#### 2.6 Botón CTA del Hero con color hardcodeado
```tsx
<Button asChild size="lg" className="bg-white text-blue-900 hover:bg-blue-50">
```
El texto usa `text-blue-900` fijo en lugar de `brand.ctaBtn`, lo que rompe la coherencia visual cuando se usa un `brandColor` distinto de blue.

#### 2.7 Sección "Cómo funciona" con colores hardcodeados
Los pasos 1-3 usan `bg-blue-100 text-blue-600` fijo y el paso 4 usa `bg-green-100 text-green-600`. No respetan el `brandColor` configurado.

#### 2.8 Carrusel de ofertas: auto-play sin control de usuario explícito
El carrusel avanza automáticamente cada 5 segundos. Si bien se pausa al hover/touch y respeta `prefers-reduced-motion`, no hay un botón visible de pausa/play. Esto puede ser molesto para algunos usuarios y es un requisito WCAG 2.2.2 (Pause, Stop, Hide).

#### 2.9 Triple llamada a `useWebsiteSettings` en la misma ruta
El layout público monta `PublicHeader`, `PublicFooter` y `MaintenanceGuard`, cada uno llama a `useWebsiteSettings()`. Luego `HomePage` también lo llama. Son 4 instancias del hook en la misma página. Aunque SWR deduplica el fetch, cada instancia crea/incrementa el ref-count del canal realtime de Supabase, generando overhead innecesario.

#### 2.10 API de settings pública sin cache headers
El endpoint `GET /api/public/website/settings` no establece headers de cache (`Cache-Control`). A diferencia del endpoint de productos que sí tiene `Cache-Control: public, max-age=30, s-maxage=60`, los settings se fetchean sin cache HTTP, generando una consulta a Supabase en cada request.

---

### 🟢 Menores / Mejoras

#### 2.11 `brandMap` y `colorMap` duplicados y extensos
Los objetos `brandMap` (12 colores × 6 propiedades) y `colorMap` (12 colores × 3 propiedades) están definidos inline en el componente. Deberían extraerse a un archivo de constantes compartido.

#### 2.12 `iconMap` limitado y sin fallback tipado
El `iconMap` usa keys como strings sin validación de tipo. Si el admin configura un icono no soportado, se usa `Wrench` como fallback silencioso. Sería mejor tipar las keys como un union type.

#### 2.13 Fallback offers con precios en CLP hardcodeados
Los precios de fallback ("Desde $49.990", "Desde $29.990", "Desde $19.990") están hardcodeados en pesos chilenos. Si el negocio opera en otra moneda, estos valores serían incorrectos.

#### 2.14 `WhatsAppFloatButton` usa `window.location.pathname` en render
El componente `shouldShow()` accede a `window.location.pathname` directamente durante el render, lo que puede causar hydration mismatches en SSR. Debería usar `usePathname()` de Next.js.

#### 2.15 Animación `animate-ping` permanente en botón WhatsApp
El botón flotante de WhatsApp tiene un `animate-ping` constante que nunca se detiene. Esto consume GPU innecesariamente y puede ser distractor. Debería detenerse después de unos segundos o respetar `prefers-reduced-motion`.

#### 2.16 Imágenes de ofertas sin `priority` ni `loading="lazy"` explícito
Las imágenes del carrusel usan `next/image` con `fill` pero sin `priority` ni `loading` explícito. Las imágenes visibles en el viewport inicial deberían tener `priority={true}` para mejorar LCP.

#### 2.17 Accesibilidad: dots del carrusel sin `role` semántico
Los dots indicadores del carrusel son `<button>` con `aria-label` correcto, pero el contenedor de dots no tiene `role="tablist"` ni los dots `role="tab"` para comunicar la relación semántica.

---

## 3. Seguridad

| Aspecto | Estado | Notas |
|---------|--------|-------|
| API settings pública | ✅ OK | Solo lectura, sin datos sensibles |
| API productos pública | ✅ OK | Sanitiza búsqueda, filtra solo `is_active`, oculta `wholesale_price` a no-mayoristas |
| Middleware | ✅ OK | `/inicio` no requiere auth, pasa directo |
| XSS en contenido dinámico | ✅ OK | React escapa automáticamente los strings renderizados |
| Links externos | ✅ OK | Usan `rel="noopener noreferrer"` correctamente |
| Inyección PostgREST | ✅ OK | `sanitizeSearch()` elimina caracteres especiales |

---

## 4. Rendimiento

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Bundle size | ⚠️ | Componente monolítico importa ~25 iconos de lucide-react. Tree-shaking debería manejar esto, pero el componente en sí es grande |
| SSR/SSG | 🔴 | Página 100% client-side, sin contenido en el HTML inicial |
| Cache HTTP settings | 🔴 | Sin `Cache-Control` en el endpoint de settings |
| Cache HTTP productos | ✅ | `max-age=30, s-maxage=60` |
| Realtime subscriptions | ⚠️ | 4 instancias del hook en la misma ruta (deduplicadas por SWR pero con overhead de ref-counting) |
| Imágenes | ⚠️ | Sin `priority` en imágenes above-the-fold del carrusel |
| Carrusel DOM | ✅ | Usa scroll nativo con snap, no virtualización pesada |

---

## 5. Accesibilidad

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Skip link | ✅ | `SkipToContentLink` presente en layout |
| `main` landmark | ✅ | `<main id="main-content">` en layout |
| Navegación con `aria-label` | ✅ | Header tiene `aria-label="Navegacion principal"` |
| Carrusel keyboard | ✅ | Soporta ArrowLeft/ArrowRight |
| Carrusel `role="region"` | ✅ | Con `aria-label` descriptivo |
| `aria-labelledby` en ofertas | ✅ | Cada `<article>` referencia su título |
| Contraste de colores | ⚠️ | Depende del `brandColor` elegido; algunos combos (amber, cyan) podrían no cumplir ratio 4.5:1 |
| `prefers-reduced-motion` | ✅ | Carrusel respeta la preferencia |
| Pausa del carrusel | ⚠️ | Se pausa al hover/touch pero no hay botón explícito (WCAG 2.2.2) |
| Dots sin `role="tab"` | ⚠️ | Falta semántica de tabs en los indicadores |

---

## 6. Recomendaciones priorizadas

| # | Prioridad | Acción | Estado |
|---|-----------|--------|--------|
| 1 | 🔴 Alta | Implementar SSR o al menos `generateMetadata` + fetch server-side de settings para SEO y LCP | ✅ Implementado |
| 2 | 🔴 Alta | Agregar `Cache-Control` al endpoint `/api/public/website/settings` | ✅ Implementado |
| 3 | 🟡 Media | Descomponer `HomePage` en sub-componentes: `HeroSection`, `OffersCarousel`, `ServicesGrid`, `ProcessSteps`, `TestimonialsGrid`, `ContactCTA` | ✅ Implementado |
| 4 | 🟡 Media | Migrar fetch de ofertas a SWR para consistencia y cache | ✅ Implementado |
| 5 | 🟡 Media | Corregir footer para usar datos dinámicos de `company_info` (horarios, nombre, descripción) | ✅ Implementado |
| 6 | 🟡 Media | Corregir color hardcodeado del botón Hero CTA para respetar `brandColor` | ✅ Implementado |
| 7 | 🟡 Media | Hacer que la sección "Cómo funciona" respete `brandColor` | ✅ Implementado |
| 8 | 🟢 Baja | Agregar botón pausa/play visible al carrusel (WCAG 2.2.2) | ✅ Implementado |
| 9 | 🟢 Baja | Extraer `brandMap`, `colorMap`, `iconMap` a archivos de constantes | ✅ Implementado |
| 10 | 🟢 Baja | Agregar `priority` a la primera imagen visible del carrusel | ✅ Implementado |
| 11 | 🟢 Baja | Detener `animate-ping` del botón WhatsApp después de unos segundos | ✅ Implementado |
| 12 | 🟢 Baja | Usar `usePathname()` en `WhatsAppFloatButton` en lugar de `window.location.pathname` | ✅ Implementado |

---

## 7. Cambios implementados

### Archivos creados
- `src/lib/constants/brand-theme.ts` — Constantes compartidas: `brandMap`, `colorMap`, `iconMap`, `getBrandTheme()`
- `src/lib/website/fetch-settings.ts` — Función server-side reutilizable para obtener settings desde Supabase
- `src/app/(public)/inicio/HomePageClient.tsx` — Client component que recibe settings como props y mantiene realtime via SWR
- `src/components/public/inicio/HeroSection.tsx` — Sección hero con stats y CTAs
- `src/components/public/inicio/OffersCarousel.tsx` — Carrusel de ofertas con SWR, botón pausa/play, `priority` en primera imagen, `role="tablist"` en dots
- `src/components/public/inicio/ServicesGrid.tsx` — Grid de servicios dinámicos
- `src/components/public/inicio/ProcessSteps.tsx` — Pasos del proceso con `brandColor` dinámico
- `src/components/public/inicio/TestimonialsGrid.tsx` — Grid de testimonios
- `src/components/public/inicio/ContactCTA.tsx` — CTA final con info de contacto

### Archivos modificados
- `src/app/(public)/inicio/page.tsx` — Convertido a Server Component async con `generateMetadata` para SEO dinámico; pasa settings al client component
- `src/app/api/public/website/settings/route.ts` — Agregado `Cache-Control: public, max-age=30, s-maxage=60`
- `src/components/public/PublicFooter.tsx` — Usa `company_info.hours` y `company_info.name` dinámicos
- `src/components/whatsapp-float-button.tsx` — Usa `usePathname()`, `animate-ping` se detiene después de 4s
