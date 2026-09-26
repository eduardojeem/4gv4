# Diseño: perfil de negocio y módulos por organización

## Objetivo

Permitir que cada organización adapte el sistema a su actividad real sin perder las funciones incluidas en su plan ni eliminar información histórica. El rubro comercial, el modelo operativo y los módulos activos serán conceptos distintos.

## Decisiones

1. `business_vertical` describe qué vende la organización: `general`, `clothing`, `cosmetics`, `electronics`, `food`, `hardware` u `other`.
2. `operating_model` describe cómo trabaja: `retail`, `wholesale`, `service`, `repair` o `mixed`.
3. `enabled_modules` describe qué herramientas desea ver y usar. La disponibilidad efectiva se calcula como módulos incluidos por el plan o prueba activa, intersectados con los módulos elegidos por la organización.
4. Los datos se conservan cuando un módulo se desactiva. Desactivar oculta la navegación y bloquea nuevas operaciones; no borra productos, reparaciones, ventas ni configuraciones.
5. `organizations` será la fuente canónica del perfil. `organization_settings.modules` seguirá guardando configuraciones internas específicas, pero no será la fuente del rubro.
6. El sitio público tendrá controles separados. Por ejemplo, desactivar el módulo operativo de servicios no equivale automáticamente a publicar u ocultar `/servicios`.

## Contrato funcional

```ts
type BusinessVertical =
  | 'general'
  | 'clothing'
  | 'cosmetics'
  | 'electronics'
  | 'food'
  | 'hardware'
  | 'other'

type OperatingModel = 'retail' | 'wholesale' | 'service' | 'repair' | 'mixed'

type OrganizationModule =
  | 'inventory'
  | 'inventory_admin'
  | 'pos'
  | 'crm'
  | 'orders'
  | 'ecommerce'
  | 'repairs'
  | 'services'
  | 'credits'
  | 'delivery'
  | 'analytics'
  | 'promotions'
  | 'security'

interface OrganizationBusinessProfile {
  businessVertical: BusinessVertical
  operatingModel: OperatingModel
  enabledModules: OrganizationModule[]
  effectiveModules: OrganizationModule[]
}
```

`effectiveModules = entitledModules union activeTrialModules`, filtrado por `enabledModules`. Los módulos base que la aplicación necesita para operar se documentarán explícitamente; no deben habilitarse por accidente mediante valores faltantes.

## Presets iniciales

| Perfil | Vertical | Modelo | Módulos sugeridos |
|---|---|---|---|
| Tienda de ropa | clothing | retail | inventory, pos, crm, orders, ecommerce, promotions |
| Cosmética | cosmetics | retail | inventory, pos, crm, orders, ecommerce, promotions |
| Mayorista | general | wholesale | inventory, inventory_admin, pos, crm, orders, credits, analytics |
| Taller técnico | electronics | repair | inventory, pos, crm, repairs, services |
| Servicios | general | service | crm, services, pos |
| Negocio mixto | general | mixed | inventory, pos, crm, orders, repairs, services |

Los presets solo proponen una configuración. El administrador puede personalizarla dentro de lo permitido por su plan.

## Reglas de acceso

- Plan sin módulo: mostrar oferta de actualización o prueba, como hoy.
- Plan con módulo pero organización lo desactivó: ocultarlo de la navegación y mostrar una pantalla de “Módulo desactivado” al acceder por URL directa, con enlace a configuración para owner/admin.
- Rol sin permiso: conservar el comportamiento de acceso denegado actual.
- API: validar organización, permiso del rol, derecho del plan y estado habilitado del módulo. La UI nunca será la única barrera.
- Superadmin y soporte deberán respetar el contexto de organización; cualquier bypass deberá ser explícito y auditable.

## Migración y compatibilidad

- Añadir columnas con valores predeterminados y sin eliminar `company_info.businessType`.
- Inferir valores iniciales conservadores: negocios con uso o configuración de reparaciones conservan `repairs`; los demás mantienen temporalmente todos los módulos a los que ya tienen derecho.
- Sincronizar el campo legado durante una versión de transición y luego dejarlo solo para lectura compatible.
- No eliminar datos de módulos desactivados.
- Registrar cambios de perfil y módulos en `tenant_audit_log`.

## Alcance de la primera versión

- Perfil de negocio y presets.
- Selector durante onboarding y edición en configuración.
- Resolución centralizada de módulos efectivos.
- Navegación, dashboards, rutas y APIs protegidas.
- Pruebas de aislamiento multi-tenant, compatibilidad y responsive.

## Evolución posterior

Los atributos específicos de producto se implementarán después de estabilizar el perfil: talla/color para ropa, tono/lote/vencimiento para cosméticos, IMEI/serie para electrónica y lote/vencimiento/unidad para alimentos. Se usarán variantes y atributos extensibles, no columnas nuevas por cada rubro.

