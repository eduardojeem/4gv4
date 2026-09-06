# Marketplace Profile Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sincronizar carritos y preferencias personales entre dispositivos, ofrecer historial de pedidos filtrable y validar la experiencia completa de `/marketplace/perfil`.

**Architecture:** Supabase será la fuente persistente para usuarios autenticados y `localStorage` seguirá siendo la fuente para visitantes y caché offline. Las rutas autenticadas validarán identidad y tenant; la revalidación del catálogo será server-side y nunca aceptará precio o stock del navegador como autoridad.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/PostgreSQL RLS, Zod, Vitest, Testing Library y Playwright.

**Spec:** `docs/superpowers/specs/2026-09-06-marketplace-profile-sync-design.md`

## Global Constraints

- No modificar la lógica financiera de pedidos, créditos ni reparaciones.
- No eliminar carritos existentes de `localStorage` hasta confirmar persistencia remota.
- Toda consulta personal debe quedar limitada a `auth.uid()` y toda consulta comercial a una organización validada.
- Promociones, comunicaciones comerciales y perfil público permanecen desactivados por defecto.
- Validar 320, 768, 1024 y 1440 px.

---

### Task 1: Persistencia y RLS de carritos y preferencias

**Files:**
- Create: `supabase/migrations/20260906170000_marketplace_customer_carts.sql`
- Create: `src/test/marketplace-cart-migration.test.ts`

**Interfaces:**
- Produces: tablas `customer_carts`, `customer_cart_items`, `marketplace_user_preferences` y políticas RLS basadas en `auth.uid()`.

- [ ] **Step 1: Escribir la prueba estructural fallida**

```ts
expect(sql).toContain('create table if not exists public.customer_carts')
expect(sql).toContain('unique (user_id, organization_id)')
expect(sql).toContain('auth.uid() = user_id')
expect(sql).toContain('create table if not exists public.marketplace_user_preferences')
```

- [ ] **Step 2: Ejecutar la prueba y confirmar RED**

Run: `npx vitest run src/test/marketplace-cart-migration.test.ts --pool=threads --maxWorkers=1`

Expected: FAIL porque la migración no existe.

- [ ] **Step 3: Crear tablas, índices y políticas**

```sql
create table if not exists public.customer_carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id)
);
```

Crear `customer_cart_items` con cantidad `1..999`, precio observado no negativo e índice único mediante `coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)`. Crear preferencias con defaults seguros. Habilitar RLS y políticas separadas para seleccionar, insertar, actualizar y eliminar.

- [ ] **Step 4: Ejecutar pruebas y revisar SQL**

Run: `npx vitest run src/test/marketplace-cart-migration.test.ts --pool=threads --maxWorkers=1`

Run: `git diff --check -- supabase/migrations/20260906170000_marketplace_customer_carts.sql`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260906170000_marketplace_customer_carts.sql src/test/marketplace-cart-migration.test.ts
git commit -m "feat: add secure marketplace cart persistence"
```

### Task 2: Contrato y API autenticada de carritos

**Files:**
- Create: `src/lib/marketplace/cart-sync.ts`
- Create: `src/app/api/marketplace/profile/carts/route.ts`
- Create: `src/app/api/marketplace/profile/carts/route.test.ts`
- Modify: `src/app/api/public/favorites/metadata/route.ts`

**Interfaces:**
- Produces: `CartSyncItem`, `CartSyncResult`, `mergeCartItems(local, remote)` y `GET|PUT|DELETE /api/marketplace/profile/carts`.
- Consumes: tablas y RLS de Task 1.

- [ ] **Step 1: Probar aislamiento, idempotencia y conflictos**

```ts
expect(mergeCartItems([{ productId: 'p', variantId: null, quantity: 2 }], [{ productId: 'p', variantId: null, quantity: 2 }]))
  .toEqual([{ productId: 'p', variantId: null, quantity: 2 }])
```

Agregar casos para usuario sin sesión `401`, organización inválida `404`, variante de otra organización `422`, producto inactivo y cantidad superior al stock.

- [ ] **Step 2: Ejecutar la prueba y confirmar RED**

Run: `npx vitest run src/app/api/marketplace/profile/carts/route.test.ts --pool=threads --maxWorkers=1`

- [ ] **Step 3: Implementar validación y revalidación server-side**

```ts
const inputSchema = z.object({
  organizationSlug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,47}$/),
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().nullable(),
    quantity: z.number().int().min(1).max(999),
  })).max(200),
})
```

Resolver la sesión desde cookies, la organización desde el slug y precio/stock desde `products` y `product_variants`. Persistir encabezado e ítems de forma idempotente y devolver valores aceptados, conflictos y `lastVerifiedAt`.

- [ ] **Step 4: Ejecutar pruebas enfocadas, lint y tipos**

Run: `npx vitest run src/app/api/marketplace/profile/carts/route.test.ts --pool=threads --maxWorkers=1`

Run: `npx eslint src/lib/marketplace/cart-sync.ts src/app/api/marketplace/profile/carts/route.ts`

Run: `npm run typecheck`

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketplace/cart-sync.ts src/app/api/marketplace/profile/carts src/app/api/public/favorites/metadata/route.ts
git commit -m "feat: add authenticated marketplace cart API"
```

### Task 3: Cliente híbrido local, remoto y offline

**Files:**
- Create: `src/lib/marketplace/cart-sync-client.ts`
- Create: `src/lib/marketplace/cart-sync-client.test.ts`
- Create: `src/hooks/use-synced-marketplace-carts.ts`
- Modify: `src/components/profile/profile-store-carts.tsx`
- Modify: `src/lib/public-cart.ts`

**Interfaces:**
- Produces: `useSyncedMarketplaceCarts()` con `{ carts, status, retry, clearCart, lastVerifiedAt }`.
- Consumes: API de Task 2 y claves existentes `mipos-public-cart:<slug>`.

- [ ] **Step 1: Probar migración idempotente y cola offline**

```ts
expect(mergeForMigration(localItems, remoteItems)).toEqual(expectedWithoutDuplicatedQuantity)
expect(compactPendingOperations([setQuantity(1), setQuantity(2)])).toEqual([setQuantity(2)])
```

- [ ] **Step 2: Ejecutar la prueba y confirmar RED**

Run: `npx vitest run src/lib/marketplace/cart-sync-client.test.ts --pool=threads --maxWorkers=1`

- [ ] **Step 3: Implementar hook y estados visibles**

Estados exactos: `local`, `syncing`, `synced`, `pending`, `conflict`, `error`. Mantener caché local tras éxito, conservarla ante error y reintentar al evento `online`. Mostrar última verificación solo cuando el servidor la confirme.

- [ ] **Step 4: Probar UI y regresiones**

Run: `npx vitest run src/lib/marketplace/cart-sync-client.test.ts src/test/profile-store-carts-and-favorites.test.tsx --pool=threads --maxWorkers=1`

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketplace/cart-sync-client.ts src/lib/marketplace/cart-sync-client.test.ts src/hooks/use-synced-marketplace-carts.ts src/components/profile/profile-store-carts.tsx src/lib/public-cart.ts
git commit -m "feat: sync marketplace carts across devices"
```

### Task 4: Preferencias personales persistentes

**Files:**
- Create: `src/app/api/marketplace/profile/preferences/route.ts`
- Create: `src/app/api/marketplace/profile/preferences/route.test.ts`
- Create: `src/components/profile/marketplace-preferences-form.tsx`
- Create: `src/test/marketplace-preferences-form.test.tsx`
- Modify: `src/components/profile/profile-settings-panel.tsx`

**Interfaces:**
- Produces: `MarketplacePreferences` y `GET|PATCH /api/marketplace/profile/preferences`.
- Consumes: `marketplace_user_preferences` de Task 1.

- [ ] **Step 1: Probar defaults seguros y rollback visual**

```ts
expect(defaults.promotions).toBe(false)
expect(defaults.marketingCommunications).toBe(false)
expect(defaults.publicProfile).toBe(false)
```

Probar `401`, campos desconocidos rechazados y que un `PATCH` fallido restaure el switch.

- [ ] **Step 2: Ejecutar la prueba y confirmar RED**

Run: `npx vitest run src/app/api/marketplace/profile/preferences/route.test.ts src/test/marketplace-preferences-form.test.tsx --pool=threads --maxWorkers=1`

- [ ] **Step 3: Implementar API y formulario**

```ts
const patchSchema = z.object({
  orderNotifications: z.boolean().optional(),
  repairNotifications: z.boolean().optional(),
  creditNotifications: z.boolean().optional(),
  promotions: z.boolean().optional(),
  marketingCommunications: z.boolean().optional(),
  publicProfile: z.boolean().optional(),
}).strict()
```

Guardar cada control independientemente, anunciar `Guardando`, `Guardado` o el error mediante `aria-live` y explicar la diferencia con la configuración empresarial.

- [ ] **Step 4: Ejecutar pruebas, lint y tipos**

Run: `npx vitest run src/app/api/marketplace/profile/preferences/route.test.ts src/test/marketplace-preferences-form.test.tsx --pool=threads --maxWorkers=1`

Run: `npm run typecheck`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/marketplace/profile/preferences src/components/profile/marketplace-preferences-form.tsx src/components/profile/profile-settings-panel.tsx src/test/marketplace-preferences-form.test.tsx
git commit -m "feat: add marketplace account preferences"
```

### Task 5: Historial de pedidos paginado y filtrable

**Files:**
- Create: `src/app/api/marketplace/profile/orders/route.ts`
- Create: `src/app/api/marketplace/profile/orders/route.test.ts`
- Create: `src/components/profile/profile-order-history.tsx`
- Create: `src/test/profile-order-history.test.tsx`
- Modify: `src/app/(public)/perfil/profile-client.tsx`

**Interfaces:**
- Produces: `GET /api/marketplace/profile/orders?cursor=&organization=&status=&payment=&from=&to=` y `ProfileOrderHistory`.

- [ ] **Step 1: Probar tenant, cursor y filtros combinados**

```ts
expect(nextCursor).toMatch(/^\d{4}-\d{2}-\d{2}T.+\|[0-9a-f-]+$/)
expect(result.items.every((order) => order.customerUserId === authenticatedUserId)).toBe(true)
```

- [ ] **Step 2: Ejecutar la prueba y confirmar RED**

Run: `npx vitest run src/app/api/marketplace/profile/orders/route.test.ts src/test/profile-order-history.test.tsx --pool=threads --maxWorkers=1`

- [ ] **Step 3: Implementar API, filtros URL y carga incremental**

Validar estados con `ORDER_STATUS_META` y `PAYMENT_STATUS_META`, limitar páginas a 20, ordenar por `created_at desc, id desc` y mantener la organización de cada pedido en todos los enlaces.

- [ ] **Step 4: Ejecutar pruebas y regresiones**

Run: `npx vitest run src/app/api/marketplace/profile/orders/route.test.ts src/test/profile-order-history.test.tsx src/test/profile-multi-store.test.tsx --pool=threads --maxWorkers=1`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/marketplace/profile/orders src/components/profile/profile-order-history.tsx src/app/'(public)'/perfil/profile-client.tsx src/test/profile-order-history.test.tsx
git commit -m "feat: add filtered marketplace order history"
```

### Task 6: QA visual, accesibilidad y documentación

**Files:**
- Create: `tests/e2e/marketplace-profile.spec.ts`
- Create: `docs/marketplace/perfil-cliente.md`
- Modify: componentes de perfil solo si una prueba reproduce un defecto concreto.

**Interfaces:**
- Consumes: entregables de Tasks 1–5.
- Produces: cobertura E2E y guía operativa.

- [ ] **Step 1: Crear escenarios E2E**

```ts
for (const width of [320, 768, 1024, 1440]) {
  test(`perfil usable a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('heading', { name: 'Mi actividad' })).toBeVisible()
  })
}
```

Agregar teclado, foco de diálogos, múltiples tiendas, carrito offline, conflicto de stock, filtros y preferencias.

- [ ] **Step 2: Ejecutar E2E y corregir únicamente fallos reproducidos**

Run: `npx playwright test tests/e2e/marketplace-profile.spec.ts`

- [ ] **Step 3: Documentar funcionamiento y recuperación**

Explicar sincronización, estados, privacidad, filtros, pérdida de conexión y diferencia entre perfil personal y `/admin/settings`.

- [ ] **Step 4: Ejecutar verificación final**

Run: `npx vitest run src/test/profile-*.test.tsx src/lib/marketplace/*.test.ts src/app/api/marketplace/profile/**/*.test.ts --pool=threads --maxWorkers=1`

Run: `npx eslint src/components/profile src/lib/marketplace src/app/api/marketplace/profile`

Run: `npm run typecheck`

Run: `git diff --check`

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/marketplace-profile.spec.ts docs/marketplace/perfil-cliente.md
git commit -m "test: verify marketplace profile experience"
```
