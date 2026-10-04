# SuperAdmin Global Catalogs Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir los cinco catálogos globales del SuperAdmin en un sistema íntegro, transaccional, escalable y con revisión editorial sin romper los consumidores actuales.

**Architecture:** La implementación sigue un despliegue expand/contract: primero añade validaciones y contratos compatibles, después mueve mutaciones masivas y agregaciones a PostgreSQL, y finalmente activa relaciones y estados nuevos en API/UI. Las rutas actuales permanecen estables y consumen módulos pequeños para jerarquía, resultados masivos, paginación y métricas.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, Supabase/PostgreSQL RLS, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-03-superadmin-global-catalogs-hardening-design.md`

## Global Constraints

- Las tiendas conservan sus entidades locales; los catálogos globales normalizan y enriquecen.
- Solo SuperAdmin modifica datos maestros; las funciones privilegiadas solo pueden ser ejecutadas por `service_role`.
- Las bajas son lógicas y las operaciones masivas no pueden informar éxito total después de fallos parciales.
- Profundidad máxima de categorías: niveles `0`, `1` y `2`.
- Tamaño máximo de página para listados: `100`.
- Las migraciones deben seguir expand/contract y no se aplican automáticamente al remoto.
- No añadir dependencias npm para esta implementación.
- Preservar todos los cambios ajenos existentes en el checkout.

## Review Focus

- Una categoría con padre inexistente o con ciclo histórico debe seguir apareciendo una vez y no bloquear el listado; Task 1 lo fija con pruebas.
- Una mudanza de rama que haga que un nieto llegue a nivel `3` debe rechazarse sin cambios parciales; Task 2 lo fija en el contrato SQL.
- IDs tenant manipulados por el cliente no deben poder vincularse si no pertenecen al conjunto revisado; Task 3 lo fija en pruebas de ruta/RPC.
- Una marca histórica ambigua por alias no debe asignarse automáticamente a un modelo; Task 4 la deja pendiente y la prueba.
- Una consulta posterior al límite histórico de 20.000 usos debe conservar totales correctos y declarar truncamiento solo para candidatos; Task 6 lo fija con pruebas de contrato.

---

### Task 1: Recorrido defensivo del árbol de categorías

**Files:**
- Modify: `src/lib/categories/global-catalog.ts:75-98`
- Modify: `src/lib/categories/global-catalog.test.ts`

**Interfaces:**
- Produces: `sortGlobalCategories(catalog: GlobalCategory[]): GlobalCategory[]` que devuelve cada ID como máximo una vez aun con ciclos u orfandad.
- Consumes: `GlobalCategory` existente.

- [ ] **Step 1: Escribir pruebas fallidas para ciclo y orfandad**

Añadir casos que construyan `A -> B -> A`, una categoría cuyo padre no existe y un duplicado de ID; afirmar terminación, una aparición por ID y conservación de todos los IDs válidos.

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo**

Run: `npx vitest run src/lib/categories/global-catalog.test.ts`

Expected: FAIL por recursión/duplicado en los casos nuevos.

- [ ] **Step 3: Implementar conjuntos `visiting` y `visited`**

Modificar `sortGlobalCategories` para cortar ciclos, no repetir IDs y añadir al final huérfanas/cíclicas en orden estable.

- [ ] **Step 4: Ejecutar las pruebas focalizadas**

Run: `npx vitest run src/lib/categories/global-catalog.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/categories/global-catalog.ts src/lib/categories/global-catalog.test.ts
git commit -m "fix(catalogs): make category traversal cycle safe"
```

### Task 2: Movimiento transaccional y niveles de categorías

**Files:**
- Create via CLI: `supabase/migrations/<generated>_move_global_category_safely.sql`
- Modify: `src/app/api/superadmin/global-categories/route.ts:335-399`
- Create: `src/test/global-category-move-migration.test.ts`
- Modify: `src/components/superadmin/__tests__/global-catalog-managers.test.tsx`

**Interfaces:**
- Produces database RPC: `move_global_category_safely(p_category_id uuid, p_parent_id uuid, p_actor_user_id uuid) returns void`.
- Consumes: `createAdminSupabase().rpc('move_global_category_safely', ...)`.

- [ ] **Step 1: Crear el archivo con la CLI**

Run: `npx supabase migration new move_global_category_safely`

Expected: un nuevo archivo fechado en `supabase/migrations/`; usar esa ruta en todos los pasos siguientes.

- [ ] **Step 2: Escribir el contrato de migración fallido**

Probar que el SQL contiene CTE recursivo, bloqueo de filas, rechazo de ciclos, validación de nivel máximo, actualización de descendientes, `REVOKE ... FROM PUBLIC, anon, authenticated` y `GRANT EXECUTE ... TO service_role`.

- [ ] **Step 3: Ejecutar el contrato y confirmar el fallo**

Run: `npx vitest run src/test/global-category-move-migration.test.ts`

Expected: FAIL porque la migración todavía no contiene la función.

- [ ] **Step 4: Implementar la función SQL**

La función usa `SECURITY DEFINER SET search_path = public, pg_temp`, valida `p_actor_user_id`, bloquea rama y ancestros, rechaza ciclos/profundidad y actualiza `parent_id`, `level` y `updated_at` en una transacción.

- [ ] **Step 5: Escribir la prueba fallida de ruta**

Simular un cambio de `parent_id`; afirmar llamada RPC con IDs exactos, `409` para códigos de ciclo/profundidad y que no se ejecuta el `UPDATE` directo de jerarquía.

- [ ] **Step 6: Actualizar la API**

Delegar únicamente el movimiento a la RPC y conservar el `UPDATE` normal para nombre, descripción, aliases, icono, orden, estado y rubros.

- [ ] **Step 7: Ejecutar pruebas**

Run: `npx vitest run src/test/global-category-move-migration.test.ts src/components/superadmin/__tests__/global-catalog-managers.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/*_move_global_category_safely.sql src/app/api/superadmin/global-categories/route.ts src/test/global-category-move-migration.test.ts src/components/superadmin/__tests__/global-catalog-managers.test.tsx
git commit -m "fix(catalogs): move category branches atomically"
```

### Task 3: Contrato común y RPC de vinculaciones masivas

**Files:**
- Create: `src/lib/catalog/bulk-result.ts`
- Create: `src/lib/catalog/bulk-result.test.ts`
- Create via CLI: `supabase/migrations/<generated>_atomic_catalog_links.sql`
- Modify: `src/app/api/superadmin/global-categories/route.ts`
- Modify: `src/app/api/superadmin/global-brands/route.ts`
- Modify: `src/lib/catalog/manual-link-actions.ts`
- Create: `src/test/catalog-bulk-rpc-migration.test.ts`
- Create: `src/test/superadmin-catalog-bulk-routes.test.ts`
- Modify: `src/components/superadmin/GlobalCategoriesManager.tsx`
- Modify: `src/components/superadmin/GlobalBrandsManager.tsx`

**Interfaces:**
- Produces: `BulkCatalogResult` con `requested`, `created`, `updated`, `linked`, `skipped`, `failed`.
- Produces RPCs: `apply_global_category_links(jsonb, uuid)` y `apply_global_brand_links(jsonb, uuid)`, ambas devuelven `jsonb` compatible con `BulkCatalogResult`.
- Consumes: selecciones ya presentadas al SuperAdmin; cada elemento lleva ID tenant y destino global esperado.

- [ ] **Step 1: Definir el tipo y sus pruebas**

Crear `isBulkCatalogResult(value: unknown): value is BulkCatalogResult` y probar estructura válida, arreglos ausentes y contadores negativos.

- [ ] **Step 2: Confirmar RED**

Run: `npx vitest run src/lib/catalog/bulk-result.test.ts`

Expected: FAIL porque el módulo no existe.

- [ ] **Step 3: Implementar tipo y guard**

Crear también `bulkResultSucceeded(result)` que solo sea verdadero cuando `failed.length === 0`.

- [ ] **Step 4: Crear migración con la CLI y contrato SQL fallido**

Run: `npx supabase migration new atomic_catalog_links`

El test exige validación del conjunto propuesto, operaciones set-based, auditoría resumida, idempotencia de conflictos y permisos solo para `service_role`.

- [ ] **Step 5: Implementar las RPC transaccionales**

Las funciones rechazan IDs tenant que no coincidan con nombre/destino revisado y devuelven el contrato común. Una excepción inesperada revierte toda la llamada.

- [ ] **Step 6: Escribir pruebas de rutas fallidas**

Afirmar que categorías, marcas y acciones manuales llaman las RPC; una respuesta con `failed` devuelve `success: false`; no quedan bucles de `update()` por fila.

- [ ] **Step 7: Actualizar rutas y UI**

Eliminar mutaciones iterativas y mostrar resumen de creados, vinculados, omitidos y fallidos. Mantener las acciones y copias actuales.

- [ ] **Step 8: Ejecutar pruebas**

Run: `npx vitest run src/lib/catalog/bulk-result.test.ts src/test/catalog-bulk-rpc-migration.test.ts src/test/superadmin-catalog-bulk-routes.test.ts src/components/superadmin/__tests__/global-catalog-managers.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/catalog/bulk-result.ts src/lib/catalog/bulk-result.test.ts src/lib/catalog/manual-link-actions.ts src/app/api/superadmin/global-categories/route.ts src/app/api/superadmin/global-brands/route.ts src/components/superadmin/GlobalCategoriesManager.tsx src/components/superadmin/GlobalBrandsManager.tsx src/test/catalog-bulk-rpc-migration.test.ts src/test/superadmin-catalog-bulk-routes.test.ts supabase/migrations/*_atomic_catalog_links.sql
git commit -m "fix(catalogs): make tenant links transactional"
```

### Task 4: Relacionar modelos con marcas globales

**Files:**
- Create via CLI: `supabase/migrations/<generated>_link_device_models_to_global_brands.sql`
- Modify: `src/app/api/superadmin/global-device-models/route.ts`
- Modify: `src/lib/devices/global-models.ts`
- Modify: `src/components/superadmin/GlobalDeviceModelsManager.tsx`
- Modify: `src/app/api/products/device-options/route.ts`
- Create: `src/test/global-device-model-brand-migration.test.ts`
- Modify: `src/lib/devices/global-models.test.ts`
- Create: `src/test/superadmin-device-models-route.test.ts`

**Interfaces:**
- Produces column: `global_device_models.global_brand_id uuid null references global_brands(id) on delete restrict`.
- Produces API model: `{ global_brand_id: string | null; brand: string; ... }` durante compatibilidad.
- Consumes: `global_brand_id` en POST/PUT/import; `brand` queda como fallback de lectura.

- [ ] **Step 1: Crear migración y prueba de contrato RED**

Run: `npx supabase migration new link_device_models_to_global_brands`

Probar FK `ON DELETE RESTRICT`, backfill por nombre/alias solo con coincidencia inequívoca, unicidad por marca/modelo y conservación de ambiguos con `global_brand_id IS NULL`.

- [ ] **Step 2: Implementar la migración expand**

Agregar columna/índices, realizar backfill determinista y no imponer `NOT NULL` todavía.

- [ ] **Step 3: Escribir pruebas RED de dominio y ruta**

Probar lectura por relación, fallback histórico, rechazo de marca global inactiva, importación con ID y ambigüedad no autovinculada.

- [ ] **Step 4: Actualizar API y normalización**

POST/PUT validan el ID contra una marca activa y derivan `brand` de esa fila. Importar resuelve nombre/alias solo cuando hay un único destino.

- [ ] **Step 5: Actualizar consumidores y gestor**

La UI selecciona por ID; `device-options` lee `global_brands(name)` y usa `brand` como fallback. No cambiar la forma final de las opciones consumidas por productos/reparaciones.

- [ ] **Step 6: Ejecutar pruebas**

Run: `npx vitest run src/test/global-device-model-brand-migration.test.ts src/test/superadmin-device-models-route.test.ts src/lib/devices/global-models.test.ts src/test/global-device-models-migration.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/*_link_device_models_to_global_brands.sql src/app/api/superadmin/global-device-models/route.ts src/app/api/products/device-options/route.ts src/lib/devices/global-models.ts src/lib/devices/global-models.test.ts src/components/superadmin/GlobalDeviceModelsManager.tsx src/test/global-device-model-brand-migration.test.ts src/test/superadmin-device-models-route.test.ts
git commit -m "feat(catalogs): link device models to global brands"
```

### Task 5: Importaciones atómicas de productos y modelos

**Files:**
- Create via CLI: `supabase/migrations/<generated>_atomic_catalog_candidate_imports.sql`
- Modify: `src/app/api/superadmin/global-products/route.ts:145-212`
- Modify: `src/app/api/superadmin/global-device-models/route.ts:117-155`
- Modify: `src/components/superadmin/global-products/GlobalProductCandidates.tsx`
- Modify: `src/components/superadmin/GlobalDeviceModelsManager.tsx`
- Create: `src/test/catalog-candidate-import-rpc.test.ts`
- Modify: `src/components/superadmin/__tests__/global-products-manager.test.tsx`

**Interfaces:**
- Produces RPCs: `import_global_product_candidates(jsonb, uuid)` e `import_global_device_model_candidates(jsonb, uuid)` que devuelven `BulkCatalogResult`.
- Consumes: candidatos validados por Zod y marca/categoría global activa.

- [ ] **Step 1: Crear migración y pruebas RED**

Run: `npx supabase migration new atomic_catalog_candidate_imports`

Probar GTIN normalizado, conflictos idempotentes, referencias activas, actor requerido, permisos exclusivos y rollback ante error inesperado.

- [ ] **Step 2: Implementar RPCs set-based**

Usar `jsonb_to_recordset`, `INSERT ... ON CONFLICT` y respuesta común; no descargar ni actualizar una fila por iteración.

- [ ] **Step 3: Escribir pruebas RED de rutas/UI**

Probar propagación de `failed`, resumen parcial visible y ausencia de éxito engañoso.

- [ ] **Step 4: Reemplazar bucles por RPC**

Mantener endpoints y payloads externos; adaptar internamente y devolver el resultado estructurado.

- [ ] **Step 5: Ejecutar pruebas**

Run: `npx vitest run src/test/catalog-candidate-import-rpc.test.ts src/components/superadmin/__tests__/global-products-manager.test.tsx src/test/superadmin-device-models-route.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/*_atomic_catalog_candidate_imports.sql src/app/api/superadmin/global-products/route.ts src/app/api/superadmin/global-device-models/route.ts src/components/superadmin/global-products/GlobalProductCandidates.tsx src/components/superadmin/GlobalDeviceModelsManager.tsx src/components/superadmin/__tests__/global-products-manager.test.tsx src/test/catalog-candidate-import-rpc.test.ts src/test/superadmin-device-models-route.test.ts
git commit -m "fix(catalogs): import candidates atomically"
```

### Task 6: Agregaciones y paginación del servidor

**Files:**
- Create via CLI: `supabase/migrations/<generated>_catalog_admin_queries.sql`
- Create: `src/lib/catalog/admin-query.ts`
- Create: `src/lib/catalog/admin-query.test.ts`
- Modify: `src/app/api/superadmin/global-products/route.ts`
- Modify: `src/app/api/superadmin/global-device-models/route.ts`
- Modify: `src/app/api/superadmin/global-categories/route.ts`
- Modify: `src/app/api/superadmin/global-brands/route.ts`
- Modify: `src/components/superadmin/GlobalProductsManager.tsx`
- Modify: `src/components/superadmin/GlobalDeviceModelsManager.tsx`
- Create: `src/test/catalog-admin-query-migration.test.ts`
- Create: `src/test/superadmin-catalog-pagination-routes.test.ts`

**Interfaces:**
- Produces: `parseCatalogAdminQuery(searchParams): CatalogAdminQuery` con `q`, `status`, `brand`, `category`, `sort`, `page >= 1`, `pageSize <= 100`.
- Produces response: `{ items, page, pageSize, total, metrics, candidates, candidatesTotal, truncated }`.
- Produces read RPCs para productos/modelos y métricas agregadas; no son ejecutables por clientes públicos.

- [ ] **Step 1: Escribir pruebas RED del parser**

Cubrir valores inválidos, `pageSize=101`, búsqueda vacía, filtros desconocidos y orden por defecto.

- [ ] **Step 2: Implementar parser Zod**

Normalizar a página `1`, tamaño predeterminado `50`, máximo `100` y listas cerradas de filtros/orden.

- [ ] **Step 3: Crear migración y contrato RED**

Run: `npx supabase migration new catalog_admin_queries`

Probar agregación SQL de usos sin tope de 20.000, paginación después de filtros/orden y campo `truncated` para candidatos limitados.

- [ ] **Step 4: Implementar funciones de lectura**

Las funciones devuelven JSON agregado, usan índices existentes cuando sirven y revocan acceso público. Añadir índices solo para predicados confirmados por las consultas.

- [ ] **Step 5: Escribir pruebas RED de rutas**

Probar parámetros, total independiente de página, página vacía válida y preservación de totales por encima de 20.000.

- [ ] **Step 6: Actualizar rutas**

Eliminar `limit(5000)`, `PRODUCT_ROW_CAP` y `USAGE_ROW_CAP` de estos flujos; adaptar respuesta común.

- [ ] **Step 7: Actualizar gestores**

Enviar búsqueda/filtros/orden/página al servidor con debounce; los KPI usan `metrics`, no `items.length`. Añadir controles anterior/siguiente y estado de carga sin borrar la página actual.

- [ ] **Step 8: Ejecutar pruebas**

Run: `npx vitest run src/lib/catalog/admin-query.test.ts src/test/catalog-admin-query-migration.test.ts src/test/superadmin-catalog-pagination-routes.test.ts src/components/superadmin/__tests__/global-products-manager.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/*_catalog_admin_queries.sql src/lib/catalog/admin-query.ts src/lib/catalog/admin-query.test.ts src/app/api/superadmin/global-products/route.ts src/app/api/superadmin/global-device-models/route.ts src/app/api/superadmin/global-categories/route.ts src/app/api/superadmin/global-brands/route.ts src/components/superadmin/GlobalProductsManager.tsx src/components/superadmin/GlobalDeviceModelsManager.tsx src/test/catalog-admin-query-migration.test.ts src/test/superadmin-catalog-pagination-routes.test.ts
git commit -m "perf(catalogs): paginate and aggregate admin queries"
```

### Task 7: Estados editoriales y procedencia

**Files:**
- Create via CLI: `supabase/migrations/<generated>_catalog_editorial_workflow.sql`
- Create: `src/lib/catalog/editorial-status.ts`
- Create: `src/lib/catalog/editorial-status.test.ts`
- Modify: `src/app/api/superadmin/global-products/route.ts`
- Modify: `src/app/api/superadmin/global-device-models/route.ts`
- Modify: `src/app/api/products/barcode-lookup/route.ts`
- Modify: `src/app/api/products/device-options/route.ts`
- Modify: `src/components/superadmin/GlobalProductsManager.tsx`
- Modify: `src/components/superadmin/GlobalDeviceModelsManager.tsx`
- Create: `src/test/catalog-editorial-migration.test.ts`
- Create: `src/test/catalog-editorial-consumers.test.ts`

**Interfaces:**
- Produces: `CatalogStatus = 'candidate' | 'review' | 'published' | 'inactive'`.
- Produces: `canTransitionCatalogStatus(from, to): boolean`.
- Expande ambas tablas con `catalog_status`, `source_type`, `source_summary`, `confidence`, `reviewed_by`, `reviewed_at`, `deactivation_reason`.
- Consumidores operativos leen solo `catalog_status = 'published'`.

- [ ] **Step 1: Escribir pruebas RED de transiciones**

Permitir candidate→review, review→published, published→inactive e inactive→review; rechazar candidate→published sin revisión y valores desconocidos.

- [ ] **Step 2: Implementar el dominio editorial**

Centralizar etiquetas, transiciones y schema Zod.

- [ ] **Step 3: Crear migración y contrato RED**

Run: `npx supabase migration new catalog_editorial_workflow`

Probar backfill activo→published, inactivo→inactive, restricciones de estado/confianza y FK de revisor.

- [ ] **Step 4: Implementar migración expand**

Conservar `is_active` sincronizado durante compatibilidad mediante constraint/trigger pequeño y explícito.

- [ ] **Step 5: Escribir pruebas RED de consumidores**

Probar que barcode lookup y device options excluyen candidate, review e inactive y conservan published.

- [ ] **Step 6: Actualizar rutas y UI editorial**

Importaciones nuevas crean `candidate`; aprobación/rechazo exige acción explícita, actor y fecha. Mostrar fuente, confianza y alternativas sin publicar automáticamente.

- [ ] **Step 7: Ejecutar pruebas**

Run: `npx vitest run src/lib/catalog/editorial-status.test.ts src/test/catalog-editorial-migration.test.ts src/test/catalog-editorial-consumers.test.ts src/test/global-products-migration.test.ts src/test/global-device-models-migration.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/*_catalog_editorial_workflow.sql src/lib/catalog/editorial-status.ts src/lib/catalog/editorial-status.test.ts src/app/api/superadmin/global-products/route.ts src/app/api/superadmin/global-device-models/route.ts src/app/api/products/barcode-lookup/route.ts src/app/api/products/device-options/route.ts src/components/superadmin/GlobalProductsManager.tsx src/components/superadmin/GlobalDeviceModelsManager.tsx src/test/catalog-editorial-migration.test.ts src/test/catalog-editorial-consumers.test.ts
git commit -m "feat(catalogs): add editorial review workflow"
```

### Task 8: Centro de control operativo

**Files:**
- Create: `src/lib/catalog/health.ts`
- Create: `src/lib/catalog/health.test.ts`
- Modify: `src/app/superadmin/catalogs/page.tsx`
- Modify: `src/components/superadmin/CatalogsHub.tsx`
- Modify: `src/test/superadmin-catalogs-hub.test.tsx`
- Modify: `src/components/superadmin/superadmin-shell.tsx` only if labels need alignment; otherwise leave unchanged.

**Interfaces:**
- Produces: `CatalogHealthData` con estado `healthy | warning | error | unknown`, `measuredAt`, métricas y acciones `{ label, href }`.
- Consumes: RPC agregadas de Task 6 y estados de Task 7.

- [ ] **Step 1: Escribir pruebas RED de agregación de salud**

Probar que una medición fallida produce `unknown`, que pendientes producen `warning`, que anomalías de integridad producen `error` y que `healthy` requiere todas las comprobaciones relevantes medidas.

- [ ] **Step 2: Implementar `buildCatalogHealth`**

Convertir métricas sin IO en tarjetas/alertas; cada pendiente incluye filtro accionable en la ruta destino.

- [ ] **Step 3: Escribir pruebas RED del hub**

Cubrir ciclos/huérfanas, ambiguos, desactivados usados, falta de imagen/categoría/marca, candidatos y modelos sin marca global. Afirmar que `unknown` nunca muestra “Al día”.

- [ ] **Step 4: Sustituir conteos independientes**

La página obtiene una sola respuesta agregada, conserva `revalidate = 60` y pasa `CatalogHealthData` al componente.

- [ ] **Step 5: Actualizar la UI**

Mostrar última medición, estados diferenciados y enlaces con parámetros de filtro. No duplicar formularios CRUD.

- [ ] **Step 6: Ejecutar pruebas**

Run: `npx vitest run src/lib/catalog/health.test.ts src/test/superadmin-catalogs-hub.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/catalog/health.ts src/lib/catalog/health.test.ts src/app/superadmin/catalogs/page.tsx src/components/superadmin/CatalogsHub.tsx src/test/superadmin-catalogs-hub.test.tsx
git commit -m "feat(catalogs): turn catalog hub into work queue"
```

### Task 9: Validación integral y entrega de migraciones

**Files:**
- Modify only when failures reveal defects in files owned by Tasks 1-8.
- Create: `docs/qa/superadmin-global-catalogs-verification.md`

**Interfaces:**
- Consumes all interfaces from Tasks 1-8.
- Produces evidence and exact commands for local/development migration application; does not mutate production.

- [ ] **Step 1: Verificar diferencias y secretos**

Run: `git diff --check`

Run: `git diff --cached | rg -i "password|secret|api_key|service_role"`

Expected: sin errores de whitespace ni secretos agregados.

- [ ] **Step 2: Ejecutar suite focalizada**

Run: `npx vitest run src/lib/categories/global-catalog.test.ts src/lib/catalog src/lib/devices/global-models.test.ts src/components/superadmin/__tests__/global-catalog-managers.test.tsx src/components/superadmin/__tests__/global-products-manager.test.tsx src/test/superadmin-catalogs-hub.test.tsx src/test/global-products-migration.test.ts src/test/global-device-models-migration.test.ts src/test/global-brands-catalog-contract.test.ts src/test/catalog-*.test.ts src/test/superadmin-catalog-*.test.ts`

Expected: PASS.

- [ ] **Step 3: Ejecutar TypeScript**

Run: `npx tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 4: Validar migraciones localmente**

Descubrir comandos con `npx supabase --help`, iniciar/restablecer la base local según el flujo disponible y ejecutar consultas que comprueben permisos, ciclos, niveles, FK, estados y totales agregados.

Expected: migraciones aplicadas en orden y consultas de integridad sin filas inválidas no explicadas.

- [ ] **Step 5: Prueba autenticada en desarrollo**

Recorrer las cinco rutas, crear/editar/reactivar, intentar un ciclo, ejecutar una importación, aprobar un candidato, buscar/paginar y comprobar los consumidores de código/modelos.

Expected: comportamiento conforme a la especificación y sin errores de consola/red.

- [ ] **Step 6: Documentar evidencia y aplicación remota**

Registrar comandos ejecutados, resultados, limitaciones y la secuencia exacta para aplicar las migraciones posteriormente con CLI enlazada, sin ejecutarla.

- [ ] **Step 7: Commit**

```bash
git add docs/qa/superadmin-global-catalogs-verification.md
git commit -m "docs: record global catalog verification"
```

### Task 10: Revisión final

**Files:**
- No cambios previstos; corregir únicamente hallazgos confirmados.

**Interfaces:**
- Consumes el resultado completo.
- Produces una revisión de seguridad, integridad, rendimiento, UX y compatibilidad.

- [ ] **Step 1: Revisar contra la especificación**

Comprobar uno por uno los criterios de aceptación del documento de diseño.

- [ ] **Step 2: Revisar permisos Supabase**

Confirmar RLS, `REVOKE` de funciones privilegiadas, `search_path`, ausencia de autorización por metadatos editables y acceso de lectura mínimo.

- [ ] **Step 3: Revisar compatibilidad expand/contract**

Confirmar que consumidores anteriores siguen leyendo `brand`/`is_active` mientras los nuevos usan relaciones/estados.

- [ ] **Step 4: Ejecutar nuevamente verificaciones afectadas por correcciones**

Expected: todas las verificaciones relevantes pasan después del último cambio.

- [ ] **Step 5: Commit de correcciones, si existen**

Usar un commit focalizado por hallazgo; no crear commit vacío.

