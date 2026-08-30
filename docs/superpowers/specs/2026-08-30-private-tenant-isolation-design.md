# Aislamiento tenant de superficies privadas

## Objetivo

Garantizar que cada pantalla privada del sistema lea y modifique exclusivamente datos de la organización activa, incluso si una política RLS heredada es demasiado permisiva, el usuario pertenece a más de una organización o selecciona "Todas las sucursales".

## Alcance

La implementación se divide en seis entregables que pueden verificarse y revertirse por separado:

1. endurecimiento de políticas RLS y vistas de créditos;
2. contexto tenant compartido y resumen server-side del Dashboard;
3. Créditos y Usuarios;
4. Productos, Inventario, Proveedores y Promociones;
5. Reportes, POS, Caja, Clientes y agenda técnica;
6. pruebas integrales de aislamiento con dos organizaciones.

No se modifica el comportamiento público del Marketplace, las tiendas públicas ni las funciones globales de Superadmin. Tampoco se elimina información histórica.

## Invariantes de seguridad

- Toda lectura o mutación privada debe resolver la organización activa en el servidor o recibir un `organizationId` obtenido de un endpoint autenticado.
- Cada consulta a una tabla operativa debe incluir `organization_id = activeOrganizationId`; RLS es una segunda barrera, no la única.
- Un `branch_id` solo es aceptable cuando la sucursal pertenece a la misma organización activa y el usuario tiene acceso a ella.
- Seleccionar "Todas las sucursales" elimina únicamente el filtro de sucursal; nunca el filtro de organización.
- Los perfiles administrativos se obtienen mediante `organization_members`; no se lista `profiles` globalmente.
- Las vistas privadas usan `security_invoker = true` y solo exponen columnas necesarias.
- Ningún endpoint operativo con `service_role` puede consultar por un identificador sin combinarlo con `organization_id`.
- Las páginas públicas continúan resolviendo la organización por slug y mantienen sus reglas públicas actuales.
- Superadmin conserva acceso global únicamente en rutas `/superadmin` protegidas por autorización explícita.

## Contexto tenant

El servidor seguirá usando `getCurrentOrganizationContext(userId)` como fuente canónica. Se añadirá un endpoint autenticado de solo lectura que devuelva la organización activa mínima:

```ts
export type ActiveOrganizationPayload = {
  id: string
  name: string
  slug: string
  role: OrganizationRole
}
```

El cliente consumirá este contexto mediante un provider dedicado. El provider no aceptará un ID arbitrario desde `localStorage`; la selección persistida continuará en la cookie `active_organization_id`, validada contra una membresía activa en el servidor.

## Dashboard

`/dashboard` dejará de consultar tablas operativas desde el navegador. Un endpoint `GET /api/dashboard/summary` devolverá:

```ts
export type DashboardSummary = {
  organization: ActiveOrganizationPayload
  salesToday: { amount: number; count: number; trend: number[] }
  activeOrders: number
  newCustomers: number
  catalog: { products: number; services: number; lowStock: number }
  repairs: {
    active: number
    todayCount: number
    todayAmount: number
    deliveredCount: number
    deliveredAmount: number
    readyCount: number
    readyAmount: number
  }
  recentActivity: Array<{
    id: string
    type: 'sale' | 'repair' | 'customer'
    title: string
    amount: number | null
    status: string | null
    createdAt: string
  }>
}
```

Todas las consultas del endpoint usarán la organización resuelta y, cuando corresponda, una sucursal previamente validada. El enlace "Mi tienda pública" utilizará el slug devuelto por ese mismo contexto.

## Base de datos y RLS

Se creará una migración idempotente que:

- elimine por nombre todas las políticas históricas conocidas con `USING (true)` o lectura por rol global en tablas tenant;
- recree políticas SELECT/INSERT/UPDATE/DELETE con `TO authenticated` y `has_org_permission(organization_id, ...)`;
- mantenga políticas públicas exclusivamente con `TO anon` y predicados públicos estrechos;
- recree `credit_installments_progress` con `security_invoker = true` e incluya `organization_id` mediante la relación con `customer_credits`;
- compruebe que las tablas operativas tienen RLS habilitado;
- falle deliberadamente si quedan filas operativas críticas con `organization_id IS NULL`, salvo tablas documentadas en una fase de backfill previa.

La migración no se aplicará automáticamente a producción. Se validará primero mediante consultas de políticas y pruebas con usuarios de dos organizaciones.

## Migración de secciones privadas

### Créditos

Las lecturas directas de `credit_details`, `credit_installments`, `credit_payments`, `credit_summary`, `credit_installments_progress` y `customers` pasarán por `/api/credits` o incluirán el tenant explícito obtenido del contexto autenticado. Las vistas que no puedan demostrar aislamiento se reemplazarán por consultas server-side.

### Usuarios

La administración listará `organization_members` de la organización activa y unirá únicamente los perfiles de esos IDs. Actualizar, suspender, invitar y reasignar sucursales conservarán `organization_id` en autorización y persistencia.

### Catálogo

Productos, categorías, marcas, proveedores, movimientos, alertas, promociones y comparaciones incluirán el tenant explícito. Los formularios asignarán `organization_id` en el servidor; nunca confiarán en un valor editable enviado por el navegador.

### Operaciones

Reportes, POS, Caja, Clientes y agenda técnica migrarán a endpoints tenant-aware o agregarán el filtro explícito usando el contexto validado. Las operaciones financieras y de stock continuarán siendo atómicas.

## Errores y estados de carga

- Si no puede resolverse una organización activa, las consultas privadas no se ejecutan y la interfaz muestra un estado de acceso no disponible.
- Una sucursal ajena devuelve `403`, no se reemplaza silenciosamente por "todas".
- Errores parciales del Dashboard no deben mostrar ceros como si fueran datos válidos; el endpoint devuelve error y la interfaz ofrece reintentar.
- No se registran IDs de clientes, importes sensibles ni tokens en logs del navegador.

## Pruebas

Cada entregable sigue TDD. Las pruebas mínimas crean Organización A y Organización B, un usuario miembro solo de A y registros equivalentes en ambas. Deben demostrar:

- las APIs de A nunca devuelven IDs, importes, nombres ni conteos de B;
- `branch_id` de B es rechazado cuando la organización activa es A;
- "Todas las sucursales" devuelve únicamente filas de A;
- las vistas de créditos respetan RLS del invocador;
- un usuario autenticado no aprovecha políticas públicas destinadas a `anon`;
- Superadmin conserva sus agregados globales solo en `/superadmin`;
- las pantallas muestran la organización activa correcta después de cambiarla.

## Despliegue y reversión

El despliegue será progresivo: primero migración en staging, luego Dashboard, después cada módulo. Antes de aplicar RLS se exportará la definición actual de políticas. La reversión de interfaz restaura el consumidor anterior; la reversión de base reinstala únicamente las políticas tenant seguras, nunca políticas globales `USING (true)`. Cada fase tendrá un commit independiente y una verificación funcional antes de continuar.

