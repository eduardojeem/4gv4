# Private Tenant Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impedir que cualquier superficie privada lea, cuente o modifique filas de una organización distinta de la organización activa.

**Architecture:** El servidor resuelve la organización activa y la expone mediante un contexto mínimo autenticado. Dashboard y módulos sensibles consumen APIs tenant-aware que siempre combinan `organization_id` y, cuando existe, una sucursal validada. RLS y vistas `security_invoker` forman una segunda barrera comprobada con dos tenants.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/PostgreSQL RLS, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-30-private-tenant-isolation-design.md`

## Global Constraints

- No modificar las reglas públicas de Marketplace ni tiendas por slug.
- No modificar los agregados globales autorizados de `/superadmin`.
- No eliminar datos históricos; primero corregir filas críticas con tenant nulo y luego exigir `NOT NULL` donde corresponda.
- Toda consulta privada operativa debe incluir `organization_id = activeOrganizationId`, aunque RLS ya exista.
- `branch_id` debe pertenecer a la organización activa y ser accesible para el usuario.
- Seleccionar todas las sucursales elimina solo el filtro de sucursal.
- Ningún valor de organización enviado por el navegador es autoridad suficiente.
- Cada tarea debe conservar los cambios locales ajenos y terminar con `git diff --check`.

---

### Task 1: Endurecer políticas RLS y vistas de créditos

**Files:**
- Create: `supabase/migrations/20260830020000_harden_private_tenant_isolation.sql`
- Create: `src/lib/security/private-tenant-isolation-migration.test.ts`

**Interfaces:**
- Consumes: `public.has_org_permission(uuid, text)` y las columnas `organization_id` existentes.
- Produces: políticas tenant exclusivas y `public.credit_installments_progress` con `organization_id` y `security_invoker = true`.

- [ ] **Step 1: Crear la migración con el comando oficial**

Run:

```bash
npx supabase migration new harden_private_tenant_isolation
Move-Item -LiteralPath (Get-ChildItem supabase/migrations/*_harden_private_tenant_isolation.sql | Select-Object -First 1).FullName -Destination supabase/migrations/20260830020000_harden_private_tenant_isolation.sql
```

Expected: `supabase/migrations/20260830020000_harden_private_tenant_isolation.sql` existe y no reemplazó otra migración.

- [ ] **Step 2: Escribir primero el test de contrato que falle**

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('../../../supabase/migrations/20260830020000_harden_private_tenant_isolation.sql', import.meta.url),
  'utf8',
).toLowerCase()

describe('private tenant isolation migration', () => {
  it('removes known global read policies', () => {
    expect(sql).toContain('drop policy if exists "auth read active products" on public.products')
    expect(sql).toContain('drop policy if exists "allow authenticated read products" on public.products')
    expect(sql).toContain('drop policy if exists products_read_all on public.products')
  })

  it('makes installment progress honor invoker RLS', () => {
    expect(sql).toContain('with (security_invoker = true)')
    expect(sql).toContain('cc.organization_id')
  })

  it('does not create authenticated using true policies', () => {
    expect(sql).not.toMatch(/to authenticated[\s\S]{0,120}using\s*\(true\)/)
  })
})
```

- [ ] **Step 3: Ejecutar el test y verificar RED**

Run:

```bash
npx vitest run src/lib/security/private-tenant-isolation-migration.test.ts
```

Expected: FAIL porque la migración todavía no contiene el contrato.

- [ ] **Step 4: Implementar la migración idempotente**

La migración debe ejecutar `DROP POLICY IF EXISTS` para todos los nombres permisivos conocidos de `products`, `categories`, `customers`, `sales`, `repairs`, `cash_registers`, `cash_closures`, `cash_movements`, `profiles`, `customer_credits`, `credit_installments` y `credit_payments`. Para cada tabla operativa debe conservar o recrear políticas con este patrón:

```sql
create policy "tenant members can read products"
on public.products
for select to authenticated
using (public.has_org_permission(organization_id, 'inventory.products.read'));
```

La vista de cuotas debe recrearse así:

```sql
drop view if exists public.credit_installments_progress;
create view public.credit_installments_progress
with (security_invoker = true) as
select
  i.id,
  i.credit_id,
  cc.organization_id,
  i.installment_number,
  i.due_date,
  i.amount,
  i.amount_paid,
  i.status,
  case when i.amount > 0
    then least(100, round((coalesce(i.amount_paid, 0) / i.amount) * 100)::int)
    else 0
  end as progreso
from public.credit_installments i
join public.customer_credits cc on cc.id = i.credit_id;

grant select on public.credit_installments_progress to authenticated;
revoke all on public.credit_installments_progress from anon;
```

- [ ] **Step 5: Verificar GREEN y sintaxis local**

Run:

```bash
npx vitest run src/lib/security/private-tenant-isolation-migration.test.ts
npx supabase db lint --local
git diff --check
```

Expected: test PASS; si Supabase local no está disponible, registrar ese límite sin afirmar validación remota.

- [ ] **Step 6: Commit de la fase**

```bash
git add supabase/migrations src/lib/security/private-tenant-isolation-migration.test.ts
git commit -m "security: harden private tenant RLS"
```

---

### Task 2: Exponer el contexto autenticado de organización activa

**Files:**
- Create: `src/app/api/organization-context/route.ts`
- Create: `src/contexts/ActiveOrganizationContext.tsx`
- Create: `src/app/api/organization-context/route.test.ts`
- Modify: `src/app/dashboard/layout.tsx`
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: `getCurrentOrganizationContext(userId)`.
- Produces: `ActiveOrganizationPayload` y `useActiveOrganization()`.

- [ ] **Step 1: Escribir el test RED del endpoint**

El test debe simular usuario autenticado y contexto activo, y comprobar que la respuesta nunca acepta un ID del query string:

```ts
expect(await readPayload(response)).toEqual({
  activeOrganization: {
    id: ORG_A,
    name: 'Organización A',
    slug: 'organizacion-a',
    role: 'owner',
  },
})
```

- [ ] **Step 2: Ejecutar RED**

Run:

```bash
npx vitest run src/app/api/organization-context/route.test.ts
```

Expected: FAIL porque la ruta no existe.

- [ ] **Step 3: Implementar el endpoint**

```ts
export type ActiveOrganizationPayload = {
  id: string
  name: string
  slug: string
  role: OrganizationRole
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const context = await getCurrentOrganizationContext(user.id)
  if (!context) return NextResponse.json({ error: 'Organización no disponible' }, { status: 403 })
  return NextResponse.json({
    activeOrganization: {
      id: context.id,
      name: context.name,
      slug: context.slug,
      role: context.role,
    },
  })
}
```

- [ ] **Step 4: Implementar el provider sin autoridad en localStorage**

`useActiveOrganization()` debe devolver `{ organization, isLoading, error, refresh }`, cargar solo `/api/organization-context` y limpiar el estado ante `401/403`.

- [ ] **Step 5: Montar el provider en layouts privados y verificar GREEN**

Run:

```bash
npx vitest run src/app/api/organization-context/route.test.ts
npm run typecheck
npx eslint src/app/api/organization-context/route.ts src/contexts/ActiveOrganizationContext.tsx src/app/dashboard/layout.tsx src/app/admin/layout.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/organization-context src/contexts/ActiveOrganizationContext.tsx src/app/dashboard/layout.tsx src/app/admin/layout.tsx
git commit -m "security: add validated active organization context"
```

---

### Task 3: Centralizar las métricas del Dashboard en el servidor

**Files:**
- Create: `src/app/api/dashboard/summary/route.ts`
- Create: `src/app/api/dashboard/summary/route.test.ts`
- Create: `src/lib/dashboard/summary.ts`
- Create: `src/lib/dashboard/summary.test.ts`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/components/dashboard/stats-overview.tsx`

**Interfaces:**
- Consumes: `ActiveOrganizationPayload`, `resolveAccessibleBranch()` y estados canónicos de ventas/reparaciones.
- Produces: `DashboardSummary` definido en la especificación.

- [ ] **Step 1: Escribir pruebas RED con dos organizaciones**

Los fixtures deben incluir ventas, clientes, productos y reparaciones en A y B. La llamada autenticada en A debe comprobar:

```ts
expect(summary.salesToday.count).toBe(1)
expect(summary.catalog.products).toBe(1)
expect(summary.recentActivity.every(item => !item.id.startsWith('org-b'))).toBe(true)
```

También debe comprobar `403` para una sucursal de B y que `branch=all` conserva el tenant A.

- [ ] **Step 2: Ejecutar RED**

Run:

```bash
npx vitest run src/lib/dashboard/summary.test.ts src/app/api/dashboard/summary/route.test.ts
```

- [ ] **Step 3: Implementar el cargador server-side**

Todas las consultas deben comenzar con el tenant:

```ts
let salesQuery = admin
  .from('sales')
  .select('id,total_amount,status,created_at,branch_id')
  .eq('organization_id', organizationId)

if (branchId) salesQuery = salesQuery.eq('branch_id', branchId)
```

Repetir explícitamente el patrón para pedidos, clientes, productos, categorías y reparaciones. No reutilizar una consulta sin tenant.

- [ ] **Step 4: Implementar la ruta autenticada**

La ruta resuelve usuario, organización y sucursal; nunca recibe `organizationId` como autoridad. Devuelve `503` con `{ error, retryable: true }` ante fallo de datos.

- [ ] **Step 5: Migrar la página y actividad reciente**

Eliminar las llamadas directas a tablas en `page.tsx` y `RecentActivity`. Ambos consumen una sola respuesta de `/api/dashboard/summary?branch=<id|all>`. El enlace de tienda usa `summary.organization.slug`.

- [ ] **Step 6: Verificar GREEN**

Run:

```bash
npx vitest run src/lib/dashboard/summary.test.ts src/app/api/dashboard/summary/route.test.ts
npm run typecheck
npx eslint src/lib/dashboard src/app/api/dashboard/summary/route.ts src/app/dashboard/page.tsx src/components/dashboard/stats-overview.tsx
git diff --check
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/dashboard src/app/api/dashboard/summary src/app/dashboard/page.tsx src/components/dashboard/stats-overview.tsx
git commit -m "security: scope dashboard summary to active tenant"
```

---

### Task 4: Aislar Créditos y Usuarios

**Files:**
- Modify: `src/app/api/credits/route.ts`
- Modify: `src/hooks/use-credits.ts`
- Modify: `src/app/api/admin/users/route.ts`
- Modify: `src/hooks/use-users-optimized.ts`
- Modify: `src/components/dashboard/user-management.tsx`
- Create: `src/app/api/credits/tenant-isolation.test.ts`
- Create: `src/app/api/admin/users/tenant-isolation.test.ts`

**Interfaces:**
- Consumes: contexto tenant server-side y `organization_id` de la vista corregida.
- Produces: listas de créditos y usuarios exclusivas de la organización activa.

- [ ] **Step 1: Escribir tests RED de A contra B**

Créditos debe excluir capital, cuotas y pagos de B. Usuarios debe listar solo membresías de A aunque `profiles` contenga usuarios adicionales.

- [ ] **Step 2: Ejecutar RED**

```bash
npx vitest run src/app/api/credits/tenant-isolation.test.ts src/app/api/admin/users/tenant-isolation.test.ts
```

- [ ] **Step 3: Reforzar `/api/credits`**

Cada consulta y vista debe incluir `.eq('organization_id', organizationId)`. Para cuotas/pagos que no tengan la columna directa, primero obtener IDs de créditos de A y aplicar `.in('credit_id', creditIds)`.

- [ ] **Step 4: Eliminar lecturas directas del hook de créditos**

`useCredits` debe cargar exclusivamente `/api/credits` y conservar filtros de presentación en memoria. No debe ejecutar `supabase.from(...)`.

- [ ] **Step 5: Basar usuarios en membresías**

El endpoint selecciona `organization_members` con `.eq('organization_id', organizationId)` y une `profiles` solo para los `user_id` resultantes. Mutaciones combinan `user_id` y `organization_id`.

- [ ] **Step 6: Verificar y commit**

```bash
npx vitest run src/app/api/credits/tenant-isolation.test.ts src/app/api/admin/users/tenant-isolation.test.ts
npm run typecheck
git diff --check
git add src/app/api/credits src/hooks/use-credits.ts src/app/api/admin/users src/hooks/use-users-optimized.ts src/components/dashboard/user-management.tsx
git commit -m "security: isolate credits and users by organization"
```

---

### Task 5: Aislar Catálogo, Inventario, Proveedores y Promociones

**Files:**
- Modify: `src/app/api/products/route.ts`
- Modify: `src/app/api/products/[id]/route.ts`
- Modify: `src/hooks/useProductsSupabase.ts`
- Modify: `src/hooks/use-products.ts`
- Modify: `src/hooks/useInventory.ts`
- Modify: `src/components/dashboard/promotions/PromotionDialog.tsx`
- Modify: `src/app/dashboard/suppliers/compare/page.tsx`
- Create: `src/app/api/products/tenant-isolation.test.ts`
- Create: `src/hooks/products-tenant-contract.test.ts`

**Interfaces:**
- Consumes: `useActiveOrganization()` para lecturas client-side transitorias y contexto server-side para escrituras.
- Produces: catálogo administrativo y selectores limitados al tenant activo.

- [ ] **Step 1: Escribir tests RED**

Comprobar que listar, obtener, actualizar y eliminar un producto de B desde A devuelve lista vacía o `404`; la respuesta nunca revela si el ID existe en B.

- [ ] **Step 2: Ejecutar RED**

```bash
npx vitest run src/app/api/products/tenant-isolation.test.ts src/hooks/products-tenant-contract.test.ts
```

- [ ] **Step 3: Reforzar APIs de producto**

Todas las operaciones por ID deben usar:

```ts
.eq('id', productId)
.eq('organization_id', organizationId)
```

Insert y upsert deben reemplazar cualquier `organization_id` recibido por el valor resuelto en servidor.

- [ ] **Step 4: Aislar hooks y tablas relacionadas**

Aplicar `.eq('organization_id', organization.id)` a productos, categorías, proveedores, marcas, movimientos y alertas. Si una tabla relacionada no tiene tenant directo, filtrar por IDs padre ya acotados o migrarla a un endpoint server-side.

- [ ] **Step 5: Aislar selectores de promociones y proveedores**

Los productos ofrecidos en ambos selectores deben venir de `/api/products` o incluir el tenant validado; nunca de una lectura global de `products`.

- [ ] **Step 6: Verificar y commit**

```bash
npx vitest run src/app/api/products/tenant-isolation.test.ts src/hooks/products-tenant-contract.test.ts
npm run typecheck
git diff --check
git add src/app/api/products src/hooks/useProductsSupabase.ts src/hooks/use-products.ts src/hooks/useInventory.ts src/components/dashboard/promotions/PromotionDialog.tsx src/app/dashboard/suppliers/compare/page.tsx
git commit -m "security: isolate private catalog data"
```

---

### Task 6: Aislar Reportes, POS, Caja, Clientes y agenda técnica

**Files:**
- Modify: `src/app/dashboard/reports/page.tsx`
- Modify: `src/app/dashboard/reports/products/page.tsx`
- Modify: `src/hooks/useSales.ts`
- Modify: `src/hooks/use-customers.ts`
- Modify: `src/hooks/useCashRegister.ts`
- Modify: `src/app/admin/cash-monitor/hooks/useCashMonitor.ts`
- Modify: `src/app/dashboard/technician/schedule/page.tsx`
- Create: `src/app/api/reports/summary/route.ts`
- Create: `src/app/api/reports/summary/tenant-isolation.test.ts`
- Create: `src/lib/branches/tenant-branch-validation.test.ts`

**Interfaces:**
- Consumes: organización activa y resolución de sucursal accesible.
- Produces: reportes y operaciones diarias con doble filtro tenant/sucursal.

- [ ] **Step 1: Escribir pruebas RED**

Los casos deben comprobar reportes sin filas de B, rechazo de `branch_id` perteneciente a B y comportamiento correcto de `all` dentro de A.

- [ ] **Step 2: Ejecutar RED**

```bash
npx vitest run src/app/api/reports/summary/tenant-isolation.test.ts src/lib/branches/tenant-branch-validation.test.ts
```

- [ ] **Step 3: Crear resumen server-side de reportes**

Ventas, ítems, clientes, reparaciones y productos deben incluir `.eq('organization_id', organizationId)` antes de fechas, estados o sucursales.

- [ ] **Step 4: Migrar páginas de reportes**

Eliminar consultas directas desde ambas páginas y consumir `/api/reports/summary` con filtros serializados y validados.

- [ ] **Step 5: Aislar POS, clientes y caja**

Las lecturas conservadas en hooks deben usar el contexto tenant. Caja debe combinar `organization_id` y `branch_id`; perfiles de operadores se consultan solo para IDs presentes en sesiones tenant-scoped.

- [ ] **Step 6: Aislar agenda técnica**

La agenda usa `/api/repairs` o añade el tenant validado; el filtro de técnico nunca sustituye el filtro de organización.

- [ ] **Step 7: Verificar y commit**

```bash
npx vitest run src/app/api/reports/summary/tenant-isolation.test.ts src/lib/branches/tenant-branch-validation.test.ts
npm run typecheck
npx eslint src/app/dashboard/reports src/hooks/useSales.ts src/hooks/use-customers.ts src/hooks/useCashRegister.ts src/app/admin/cash-monitor/hooks/useCashMonitor.ts src/app/dashboard/technician/schedule/page.tsx
git diff --check
git add src/app/dashboard/reports src/app/api/reports src/hooks/useSales.ts src/hooks/use-customers.ts src/hooks/useCashRegister.ts src/app/admin/cash-monitor/hooks/useCashMonitor.ts src/app/dashboard/technician/schedule/page.tsx src/lib/branches/tenant-branch-validation.test.ts
git commit -m "security: isolate operational reporting and cash data"
```

---

### Task 7: Añadir guardas de regresión para consultas privadas

**Files:**
- Create: `src/test/security/private-query-contract.test.ts`
- Create: `src/test/integration/two-tenant-isolation.test.ts`
- Create: `docs/security/tenant-isolation.md`

**Interfaces:**
- Consumes: endpoints y providers de Tasks 1-6.
- Produces: control automático contra nuevas consultas privadas sin tenant y guía operativa.

- [ ] **Step 1: Escribir el contrato estático RED**

El test inspecciona archivos privados y prohíbe nuevas lecturas directas de tablas sensibles fuera de una allowlist mínima documentada:

```ts
const sensitiveTables = ['sales', 'customers', 'products', 'repairs', 'cash_movements']
expect(unscopedPrivateQueries).toEqual([])
```

Cada excepción debe registrar archivo, motivo y barrera server-side; no se aceptan excepciones por depender únicamente de RLS.

- [ ] **Step 2: Escribir integración con dos tenants**

Crear fixtures A/B, autenticar miembro de A y recorrer Dashboard, Créditos, Usuarios, Productos y Reportes comprobando que ningún ID semilla de B aparece.

- [ ] **Step 3: Ejecutar RED y corregir residuos**

```bash
npx vitest run src/test/security/private-query-contract.test.ts src/test/integration/two-tenant-isolation.test.ts
```

- [ ] **Step 4: Documentar operación y diagnóstico**

`docs/security/tenant-isolation.md` debe explicar organización activa, filtro de sucursal, políticas RLS, vistas `security_invoker`, consultas de verificación y rollback seguro.

- [ ] **Step 5: Verificación completa**

```bash
npx vitest run src/test/security/private-query-contract.test.ts src/test/integration/two-tenant-isolation.test.ts
npm run test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: cero fallos. Advertencias globales preexistentes deben informarse con su archivo y no presentarse como éxito total.

- [ ] **Step 6: Auditoría de seguridad antes del despliegue**

En staging, consultar `pg_policies` y verificar que no exista `TO authenticated USING (true)` en tablas tenant. Ejecutar pruebas autenticadas con usuario de A contra IDs de B y confirmar `0 rows`, `403` o `404` según el contrato.

- [ ] **Step 7: Commit final de guardas**

```bash
git add src/test/security src/test/integration docs/security/tenant-isolation.md
git commit -m "test: guard private tenant isolation"
```

---

## Checkpoints de despliegue

1. Aplicar Task 1 solo en staging y exportar políticas antes/después.
2. Desplegar Tasks 2-3 y comparar métricas del Dashboard con consultas tenant manuales.
3. Desplegar Task 4; validar créditos y usuarios con una cuenta real de cada tenant.
4. Desplegar Task 5; validar inventario, promociones y costos.
5. Desplegar Task 6; reconciliar ventas, caja y reportes por organización/sucursal.
6. Ejecutar Task 7 completa antes de producción.

## Rollback

- Revertir cada commit de interfaz de manera independiente.
- Restaurar consumidores anteriores solo si la base conserva políticas tenant seguras.
- Nunca restaurar políticas `USING (true)` para resolver errores de permisos.
- Si una vista falla, revocar temporalmente `SELECT` a `authenticated` antes de considerar una vista sin `security_invoker`.
