# Marketplace Effective Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Calcular stock, precio público y ofertas antes de paginar, mostrando «Desde…» solo cuando las variantes disponibles tienen precios efectivos diferentes.

**Architecture:** Una RPC de lectura calcula el conjunto público elegible y sus resúmenes en PostgreSQL. Un adaptador server-only hidrata las filas sin alterar el precio usado para ordenar. Los consumidores comparten un contrato de resumen separado de los precios originales del producto y de la variante seleccionada.

**Tech Stack:** Next.js, TypeScript, Supabase/PostgreSQL, Vitest y React Testing Library existentes; sin nuevas dependencias de producción.

**Spec:** `docs/superpowers/specs/2026-10-11-marketplace-effective-catalog-design.md`

## Global Constraints

- Conservar el diseño de portada recuperado, búsqueda paginada y mejoras móviles.
- No cambiar precios guardados, inventario, ventas, planes ni condiciones comerciales.
- No ejecutar SQL remoto ni publicar en producción dentro de este plan.
- Mantener descuentos sin acumulación y el contrato de `resolvePublicVariantPrice`.
- No convertir cupones, descuentos fijos ni condiciones de carrito en descuentos garantizados de tarjeta.
- RPC `SECURITY INVOKER`, revocada a PUBLIC/anon/authenticated, concedida solo a service_role.
- No enviar un mínimo oculto adicional ni ordenar los productos ocultos por ese importe.
- Error o migración ausente: estado recuperable, nunca vacío engañoso ni fallback incorrecto.
- Preservar cambios locales previos; commits con archivos/hunks del incremento, sin incluir trabajo ajeno.

## Review Focus

1. Variante agotada más barata: no influye en «Desde…» ni en el orden; prueba en tareas 1 y 2.
2. Empates entre promociones/precios: filas y variante representativa estables; prueba en tarea 2.
3. Precio oculto: ausencia del resumen numérico y posición independiente del importe; pruebas en tareas 2 y 4.
4. Fecha/límite de promoción cambia entre peticiones: caché corta y cálculo coherente por petición; prueba en tareas 2 y 3.
5. Productos desaparecen entre consulta e hidratación: no mostrar totales como si la carga fuera completa; prueba de error recuperable en tarea 3.

## Contratos comunes

Crear `src/lib/public/catalog-summary.ts` (sin acceso a BD) con:

```ts
export type PublicCatalogSummary = {
  stockQuantity: number
  price: number | null
  originalPrice: number | null
  priceFrom: boolean
  hasOffer: boolean
  representativeVariantId: string | null
  promotionName: string | null
}
```

Los campos de precio son null cuando `hide_price` está activo. No reemplazar `product.sale_price`/`offer_price` con el mínimo: rompería el precio de una variante al abrir el modal. Agregar `catalog_summary?: PublicCatalogSummary` a `MarketplaceProduct`; consumidores de catálogo actualizado siempre lo reciben.

RPC `public.get_marketplace_effective_catalog(p_filters jsonb)` retorna un objeto JSON con `rows`, `total`, `brands` y `categories`. Cada fila contiene `product_id` y `summary` con los nombres del contrato anterior. Facetas: identificador/nombre/conteo y logo si existe. `rows=[]` conserva el total y facetas para páginas fuera de rango.

`p_filters`: `q`, `category_ids`, `brand`, `brand_ids`, `only_offers`, `sort`, `limit`, `offset`; solo el servidor construye estos filtros. Límite 1–100, offset entero no negativo y sin overflow; orden permitido default/price_asc/price_desc/newest/name_asc. Categorías/marcas se resuelven con los helpers existentes. Validar JSON y UUID también dentro de la RPC.

Crear `src/lib/public/effective-catalog.ts`, server-only, con `readEffectiveCatalog(filters: EffectiveCatalogFilters): Promise<EffectiveCatalogResult>`. `EffectiveCatalogResult` tiene filas de identificadores/resumen, total y facetas; errores lanzan `MarketplaceCatalogUnavailableError`, no listas vacías.

## Task 1: Oráculo de precios y disponibilidad

**Files:** crear `src/lib/public/catalog-summary.ts`, `src/test/marketplace-effective-pricing.test.ts`; leer `src/lib/public/offer-pricing.ts` y `src/lib/public-promotions.ts`.

**Interfaces:** `summarizeCatalogProduct(product, variants, promotions, { onlyOffers, now }): PublicCatalogSummary | null`, tipos estructurales basados en los modelos públicos existentes. null significa sin opciones disponibles o sin ofertas elegibles al filtrarlas.

- [ ] Escribir tests fallidos: padre stock 0 con variantes activas 2 y 3 → stock 5; variante agotada de 50 no gana frente a disponible de 100; todas agotadas → null, aunque el padre tenga stock.
- [ ] Tests de precio: variantes 100/150 con oferta del padre 20% → mínimo 80, original 100, `priceFrom=true`; 100/100 → `priceFrom=false`. Precio único simple 100 → 100.
- [ ] Tests: promoción porcentual dirigida mejor que manual gana sin acumular; vencida/inactiva/uso agotado no gana; cupón y fixed no se muestran como oferta. Fijar fecha en fixtures.
- [ ] Test «solo ofertas»: opción sin descuento de 80 y opción con descuento 90/100 → representante ofertado 90, no 80; `priceFrom` se calcula entre opciones ofertadas.
- [ ] Tests de precio oculto: price/originalPrice null, sin `priceFrom`; redondeo y oferta propia de variante mantienen el contrato del helper actual.
- [ ] Ejecutar `node node_modules/vitest/vitest.mjs run src/test/marketplace-effective-pricing.test.ts --pool=threads --maxWorkers=1 --reporter=default`; confirmar fallos por comportamiento ausente.
- [ ] Implementar usando los helpers actuales, stock positivo de variantes activas y desempate por id. No alterar los helpers comerciales existentes.
- [ ] Repetir comando hasta PASS; guardar solo este incremento en commit `feat: define public effective catalog summaries`.

## Task 2: RPC segura y paginación global

**Files:** nueva migración generada con CLI; crear `supabase/tests/marketplace_effective_catalog.sql` y test de integración `src/test/marketplace-effective-catalog.integration.test.ts`.

**Interfaces:** producir `get_marketplace_effective_catalog(jsonb)` con el contrato común. Consultar nombres/tipos reales de columnas antes de escribir SQL; no suponer que las variantes tienen una columna de oferta si no existe.

- [ ] Comprobar CLI con `--version` y `--help`, docs oficiales actuales, y disponibilidad de BD local. Generar archivo con `supabase migration new marketplace_effective_catalog`; registrar el nombre exacto generado en la entrega.
- [ ] Crear fixtures transaccionales locales de organizaciones elegibles/privadas y productos simples/variantes/promociones. Nunca usar datos remotos ni correo del usuario. Exigir fallo inicial por RPC ausente.
- [ ] Test SQL: al menos 15 resultados, página de 12, descuento en producto antes fuera de página debe moverlo a primera página; total global correcto y desempate estable por UUID.
- [ ] Repetir fixtures de tarea 1 y comparar resúmenes SQL con el oráculo TS, incluyendo empates y promoción que termina exactamente en el instante de referencia.
- [ ] Test de seguridad: privado/inactivo/organización bloqueada no aparece incluso con IDs enviados; anon/authenticated no pueden invocar; service_role sí.
- [ ] Test de precio oculto: modificar solo el importe oculto no modifica su posición entre ocultos ni agrega precio al resumen.
- [ ] Implementar consulta mediante CTEs: elegibilidad → opciones disponibles → mejor oferta padre → precio por variante → representantes/facetas → filtros → total/orden → paginación. Un único instante de referencia para toda la consulta.
- [ ] Reutilizar las reglas vigentes de suscripción de `blockedShowcaseOrganizationIds`, vigencia/uso y alcance de promociones. Resolver precio oculto por id, no por importe. No aceptar un array de organizaciones elegibles enviado como autoridad.
- [ ] SQL con búsqueda literal sanitizada, alcance por organización y límites validados; revisar permisos de función y esquema. Índices solo tras EXPLAIN de fixtures representativos, sin indexar `now()` ni almacenar promociones vencibles como columna generada.
- [ ] Ejecutar migración/tests únicamente en BD local y advisors; integración debe PASS, no skip, para declarar SQL verificado. Si falta BD local, detener entrega del SQL como listo y reportar ese bloqueo.
- [ ] Commit `feat: query public effective catalog before pagination` solo con migración y pruebas relacionadas.

## Task 3: Adaptador servidor y consumidores globales

**Files:** crear `src/lib/public/effective-catalog.ts`, modificar `src/lib/public/marketplace.ts`, `src/app/marketplace/productos/page.tsx`, `src/app/marketplace/buscar/page.tsx`, `src/app/marketplace/page.tsx`; tests `src/test/marketplace-effective-catalog.test.ts`, `src/test/marketplace-search-hardening.test.ts`, `src/test/marketplace-products-pagination.test.ts`.

**Interfaces:** consumir RPC; agregar `onlyOffers?: boolean` a `MarketplaceProductFilters` y `catalog_summary` al modelo. Resultado de página incluye facetas compartidas; hidratar filas conservando su orden por id, sin recalcular su resumen.

- [ ] Tests fallidos para `ofertas=1` en ambas rutas, propagación de marca/categoría/orden/página y uso del total global. Probar volver atrás y página fuera de rango sin borrar filtros.
- [ ] Tests mockeados para RPC ausente/error y producto perdido en hidratación: lanzar error recuperable, no devolver vacío ni usar `sale_price` como fallback.
- [ ] Implementar adaptador, sanitización y mapeo; no serializar error interno/credenciales. Migrar productos y ofertas al mismo lector. Facetas de marcas excluyen el filtro de marca para permitir cambiarla; respetan el resto del contexto.
- [ ] Portada/ofertas, marcas, categorías y conteos de organizaciones usan el mismo criterio de disponibilidad, sin la condición padre-stock>0 que pierde variantes.
- [ ] Mostrar estados de carga/error y opción de reintento con límites de error existentes de Next. No traducir errores a «sin resultados» en `.catch()` de portada.
- [ ] Mantener caché pública de 30 segundos, claves que incluyen filtros, y ningún dato personal. Test fecha/uso actualizado tras invalidación o fin de ventana; documentar ventana máxima de antigüedad.
- [ ] Ejecutar pruebas enfocadas anteriores y nuevas con un único worker y reporter default; actualizar contratos de código fuente solo cuando cambió la interfaz, sin quitar cobertura funcional.
- [ ] Commit `fix: unify marketplace search and offer results`.

## Task 4: Tarjetas, carruseles y modal coherentes

**Files:** modificar `ProductsClient.tsx`, `MarketplaceProductCarousel.tsx`, `MarketplaceBusinessPromoShowcase.tsx`, `MarketplaceProductModal.tsx` bajo `src/components/public/`; crear `src/test/marketplace-effective-price-display.test.tsx` y ampliar `src/test/marketplace-product-modal-contact.test.tsx`.

**Interfaces:** consumir `catalog_summary` sin sustituir precio del padre. Antes de seleccionar variante, modal muestra resumen; después, precio de esa variante mediante contrato existente y mismos datos/promociones vigentes.

- [ ] Tests render: «Desde…» para mínimos distintos, sin prefijo para iguales, tachado/porcentaje del representante correcto, «Consultar precio» sin números ocultos.
- [ ] Test de selección: variante 150 en producto con resumen mínimo 80 muestra su precio 120, no 80 ni doble descuento. Consulta por WhatsApp usa variante seleccionada; antes de selección no promete un precio fijo donde corresponde «Desde…».
- [ ] Test filtro ofertas server-side: ProductsClient no vuelve a filtrar ni ordenar el lote por campos antiguos; total/páginas provienen del servidor.
- [ ] Implementar helper de presentación basado en resumen compartido, preservar enlaces a vendedor y modal móvil. Mantener favoritos asociados al producto sin usar el mínimo como precio contractual de pedido.
- [ ] Ejecutar RTL y tests existentes de precio oculto, contacto, carrusel y móvil; commit `fix: display available variant starting prices consistently`.

## Task 5: Validación y entrega

- [ ] Ejecutar toda la suite marketplace y promoción/precio público afectada; sin suites paralelas escribiendo al mismo reporte.
- [ ] Ejecutar ESLint de archivos modificados, `node node_modules/typescript/bin/tsc --noEmit --incremental false`, build usando el script real de package.json y `git diff --check`; registrar fallos preexistentes sin declararlos aprobados.
- [ ] Revisar navegador local a 320/768/1024/1440 px: portada, búsqueda, ofertas, cambiar página, marca, atrás y modal/selección. Comprobar teclado, overflow horizontal, errores y precios ocultos sin mutaciones reales de compra.
- [ ] Revisar rama completa mediante método elegido, sin añadir subagentes si no fueron autorizados. Corregir hallazgos antes de entrega.
- [ ] Entregar nombre exacto y orden de migraciones, verificación local y límites pendientes. No reparar historial como sustituto de aplicar SQL ni publicar sin autorización específica.

## Handoff

Recomendación: ejecución nativa en esta conversación, por las dependencias entre contratos SQL, servidor y presentación. El usuario revisa este plan y confirma método antes de implementar. Una implementación con subagentes queda como alternativa si la solicita explícitamente.
