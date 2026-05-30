# Arquitectura SaaS Multi-Tenant

Este documento define la migracion progresiva del sistema actual a una plataforma SaaS multiempresa para POS, inventario, reparaciones, ecommerce, delivery y marketplace.

## Diagnostico Del Proyecto Actual

Stack detectado:

- Next.js App Router con `src/app`.
- Supabase SSR en `src/lib/supabase/server.ts`.
- Supabase service role aislado en `src/lib/supabase/admin.ts`.
- API Routes para productos, POS, reparaciones, usuarios, settings, uploads y endpoints publicos.
- Roles actuales legacy: `super_admin`, `admin`, `vendedor`, `tecnico`, `cliente`.
- Sucursales ya iniciadas con helpers en `src/lib/branches`.
- RLS y hardening acumulado en muchas migraciones.
- El proyecto usa `src/proxy.ts` como middleware/proxy central de Next 16.

Riesgo principal: el modelo actual parece monoempresa con roles globales. Para SaaS, los roles deben ser por organizacion y todas las consultas sensibles deben quedar filtradas por `organization_id`.

## Objetivo Arquitectonico

Modelo recomendado: shared database, shared schema, aislamiento por columna `organization_id` con RLS obligatoria.

Este modelo es el mejor punto de partida porque:

- Mantiene Supabase simple y economico.
- Permite miles de empresas con indices correctos.
- Evita duplicar esquemas por cliente.
- Permite migracion progresiva desde el sistema actual.
- Encaja con RLS, App Router y API Routes existentes.

## Estructura De Carpetas Propuesta

```txt
src/
  app/
    (public)/
    auth/
      register-company/
      invite/
      onboarding/
    dashboard/
      saas/
        page.tsx
      layout.tsx
    api/
      organizations/
      invitations/
      billing/
      webhooks/
        stripe/
        pagopar/
        bancard/
  components/
    saas/
      organization-switcher.tsx
      plan-usage-card.tsx
      module-gate.tsx
      onboarding-checklist.tsx
  contexts/
    OrganizationContext.tsx
  lib/
    api/
      withTenantAuth.ts
    billing/
      plans.ts
      subscription-service.ts
      providers/
        stripe.ts
        pagopar.ts
        bancard.ts
    modules/
      registry.ts
    repositories/
      product-repository.ts
      customer-repository.ts
      repair-repository.ts
    saas/
      context.ts
      permissions.ts
      plans.ts
      tenant.ts
    services/
      products-service.ts
      repairs-service.ts
      pos-service.ts
  modules/
    inventory/
    pos/
    repairs/
    crm/
    ecommerce/
    delivery/
    analytics/
supabase/
  migrations/
    20260601000000_saas_multitenant_foundation.sql
```

## Modelo De Datos

Tablas SaaS base:

- `organizations`: empresa tenant.
- `organization_members`: membresia y rol por organizacion.
- `organization_invitations`: invitaciones.
- `organization_settings`: branding, moneda, zona horaria y configuracion.
- `plans`: definicion de planes.
- `subscriptions`: suscripcion actual.
- `tenant_audit_log`: auditoria por organizacion.

Entidades que deben tener `organization_id`:

- `products`
- `categories`
- `customers`
- `sales`
- `sale_items`
- `payments`
- `repairs`
- `inventory`
- `branches`
- `employees`
- `orders`
- `suppliers`
- `settings`
- `promotions`
- `brands`
- `cash_register_sessions`
- `cash_movements`
- `customer_credits`
- `website_settings`
- `communication_messages`

Regla: ninguna tabla operativa debe depender de un rol global para aislamiento. El tenant siempre manda.

## Roles SaaS

Roles por organizacion:

- `owner`: controla facturacion, plan, usuarios, seguridad y eliminacion.
- `admin`: administra operacion y configuracion.
- `manager`: opera sucursales, inventario, reportes y usuarios operativos.
- `cashier`: POS, caja y ventas.
- `technician`: reparaciones asignadas e inventario tecnico.
- `seller`: ventas, clientes y catalogo limitado.
- `customer`: portal cliente, reparaciones, pedidos y perfil.

Roles legacy a mapear:

- `super_admin`: solo plataforma interna, no tenant. Mantener para soporte.
- `admin`: `owner` o `admin` durante migracion.
- `vendedor`: `seller` o `cashier`.
- `tecnico`: `technician`.
- `cliente`: `customer`.

## Permisos

Formato recomendado: `modulo.recurso.accion`.

Ejemplos:

- `inventory.products.read`
- `inventory.products.create`
- `pos.sales.create`
- `pos.cash.close`
- `repairs.orders.assign`
- `crm.customers.update`
- `ecommerce.orders.manage`
- `settings.billing.manage`

La autorizacion final debe evaluar:

1. Usuario autenticado.
2. Membresia activa en la organizacion.
3. Rol con permiso suficiente.
4. Modulo habilitado por plan.
5. Limites de plan.
6. Alcance de sucursal cuando aplique.

## Subdominios

Resolucion:

- `empresa1.dominio.com` -> `slug = empresa1`.
- `www.dominio.com` o dominio raiz -> landing/public marketplace general.
- Dominios internos de Vercel/localhost se ignoran.

El proxy/middleware debe:

- refrescar sesion Supabase.
- detectar slug por host.
- enviar `x-tenant-slug` y `x-tenant-host`.
- proteger `/dashboard` y `/admin`.
- no resolver datos sensibles con service role.

El layout o server helpers resuelven el slug contra `organizations` usando cliente anonimo/RLS o una RPC segura.

## Planes

Planes iniciales:

| Plan | Usuarios | Productos | Sucursales | Storage | Modulos |
| --- | ---: | ---: | ---: | ---: | --- |
| FREE | 2 | 100 | 1 | 1 GB | inventory, pos |
| BASIC | 5 | 1000 | 1 | 5 GB | inventory, pos, repairs |
| PRO | 20 | 10000 | 5 | 50 GB | inventory, pos, repairs, ecommerce, whatsapp, analytics |
| ENTERPRISE | ilimitado | ilimitado | ilimitado | personalizado | todos |

El control de limites debe vivir en servicios server-side y, cuando sea posible, en funciones SQL/RPC transaccionales.

## Migracion Progresiva

Fase 0: inventario de seguridad

- Listar endpoints sin `withAuth` o `withAdminAuth`.
- Auditar endpoints publicos: productos, categorias, reparaciones publicas, webhook WhatsApp, uploads.
- Confirmar que `SUPABASE_SERVICE_ROLE_KEY` solo exista en server.
- Bloquear logs con PII o tokens.

Fase 1: fundacion SaaS

- Crear tablas SaaS base.
- Crear organizacion default para los datos existentes.
- Agregar `organization_id` nullable a tablas operativas.
- Backfill con la organizacion default.
- Crear indices `(organization_id, ...)`.
- Introducir helpers `resolveTenantContext`, `withTenantAuth`, permisos y planes.

Fase 2: RLS multiempresa

- Cambiar policies de tablas operativas para exigir `is_org_member(organization_id)`.
- Mantener acceso publico solo mediante columnas explicitas: `is_public`, `is_active`, `visible_in_store`.
- Separar policies publicas de marketplace de policies privadas del dashboard.
- Agregar auditoria por tenant.

Fase 3: migracion de APIs

- Cambiar APIs privadas a `withTenantAuth`.
- Toda lectura/escritura debe usar `organizationId`.
- Validar `organization_id` desde contexto, nunca desde body del cliente.
- Aplicar limites de plan antes de `insert`.
- Paginacion obligatoria en listas.

Fase 4: UI SaaS

- Registro de empresa.
- Selector de organizacion.
- Selector de sucursal.
- Dashboard SaaS.
- Onboarding inicial.
- Sidebar dinamica por rol, modulo y plan.

Fase 5: billing

- Crear abstraccion de proveedor.
- Implementar webhooks firmados.
- Guardar estado normalizado en `subscriptions`.
- Bloquear creaciones nuevas al exceder limites.
- No bloquear lectura de datos por impago; degradar funciones con politica de negocio.

Fase 6: modularizacion

- Mover logica por dominio a `src/modules`.
- Crear repositories por entidad.
- Servicios orquestan permisos, plan y transacciones.
- Componentes se vuelven reutilizables.

## Cambios Necesarios En Codigo

Prioridad alta:

- Actualizar `src/proxy.ts` para detectar subdominio, refrescar sesion y proteger rutas.
- Crear `src/lib/saas/*`.
- Crear `src/lib/api/withTenantAuth.ts`.
- Migrar primero `products`, `categories`, `customers`, `sales`, `repairs`, `branches`.
- Reemplazar roles legacy globales por membresias tenant.
- Eliminar cualquier dependencia frontend de service role.

Prioridad media:

- Introducir repositories.
- Consolidar logs.
- Reducir `any`.
- Centralizar errores.
- Crear schemas Zod por API.

Prioridad baja:

- Reorganizar toda la UI a `src/modules`.
- Billing real con proveedores.
- Analytics multiempresa avanzado.

## Patron De API Privada

```ts
export const GET = withTenantAuth(
  { permission: 'inventory.products.read', module: 'inventory' },
  async (request, context) => {
    const products = await productRepository.list({
      organizationId: context.organization.id,
      branchId: context.branch?.id,
      searchParams: request.nextUrl.searchParams,
    })

    return NextResponse.json({ success: true, data: products })
  }
)
```

## Patron De Insercion

Nunca aceptar `organization_id` desde el body:

```ts
const body = productCreateSchema.parse(await request.json())

const product = await productRepository.create({
  ...body,
  organization_id: context.organization.id,
  created_by: context.user.id,
})
```

## RLS Base

Cada tabla operativa debe terminar con esta forma:

```sql
create policy "tenant select" on products
for select using (public.is_org_member(organization_id));

create policy "tenant insert" on products
for insert with check (
  public.has_org_permission(organization_id, 'inventory.products.create')
);

create policy "tenant update" on products
for update using (
  public.has_org_permission(organization_id, 'inventory.products.update')
) with check (
  public.has_org_permission(organization_id, 'inventory.products.update')
);
```

## Reglas Para Endpoints Publicos

Endpoints publicos permitidos:

- Marketplace publico.
- Verificacion publica de reparacion por ticket/token.
- Webhooks firmados.
- Auth callback.

Cada endpoint publico debe cumplir:

- Rate limit.
- Validacion Zod.
- No devolver datos internos.
- No usar service role salvo webhook/operacion server-side justificada.
- Resolver tenant por subdominio, slug o token firmado.

## Dashboard SaaS

Widgets iniciales:

- Selector de organizacion.
- Selector de sucursal.
- Estado del plan.
- Uso: usuarios, productos, sucursales, storage.
- Modulos habilitados.
- Actividad reciente.
- Facturacion y proxima renovacion.
- Alertas de seguridad.

## DevOps

Variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `APP_ROOT_DOMAIN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PAGOPAR_PRIVATE_KEY`
- `BANCARD_PRIVATE_KEY`

Produccion:

- Vercel con preview environments.
- Supabase migrations revisadas antes de aplicar.
- CI: lint, typecheck, tests, build.
- Monitoreo de errores y latencia.
- Backups Supabase diarios.
- Rate limiting para auth, uploads, webhooks y busquedas.

## Orden Recomendado De Implementacion

1. Aplicar fundacion SaaS en DB sin bloquear funcionalidades existentes.
2. Crear organizacion default y backfill.
3. Encapsular contexto tenant en server.
4. Migrar Products API.
5. Migrar POS/Sales.
6. Migrar Repairs.
7. Migrar Customers/Suppliers/Categories.
8. Activar RLS estricta por tabla.
9. Agregar UI de organizacion/onboarding.
10. Implementar billing y limites.
