# Auditoria de superadmin.zip

Archivo revisado:

`F:\multi empresa\Mipos-main (1)\Nueva carpeta\superadmin.zip`

## Resultado

El ZIP contiene un modulo completo `superadmin/` con paginas, hooks, componentes y migraciones. No se integro de forma directa porque no es compatible de manera segura con la arquitectura actual.

## Hallazgos principales

- Usa rutas `/api/superadmin/*` que no existen en este proyecto.
- Espera helpers incompatibles como `createAdminClient` desde `@/lib/supabase/server`.
- Usa `@/hooks/use-auth`, pero el proyecto actual usa `@/contexts/auth-context`.
- Mezcla accesos directos desde cliente con Supabase para datos globales. En un SaaS multi-tenant, los datos plataforma deben pasar por servidor con verificacion fuerte de super admin.
- Incluye migraciones propias para `subscription_plans`, `audit_logs`, `system_settings` y `email_templates`; algunas se solapan con migraciones SaaS ya creadas.
- Tiene bastante codigo de UI aprovechable, pero copiarlo completo agregaria deuda y errores de tipos.

## Decision de adaptacion

Se implemento una version nativa y reducida:

- `/superadmin` como panel global.
- `/superadmin/organizations` para ver tenants.
- `/superadmin/users` para ver memberships SaaS.
- `/superadmin/billing` como base de suscripciones.
- Guard server-side con `requireSuperAdmin`.
- Middleware/proxy protegiendo `/superadmin`.
- Consultas con `SERVICE_ROLE_KEY` solo en servidor.

## Pendiente recomendado

- Crear endpoints `/api/superadmin/*` solo cuando el panel necesite acciones mutables.
- Agregar auditoria para acciones de super admin.
- Incorporar gestion de planes y billing cuando se definan Stripe/Pagopar/Bancard.
- Migrar piezas utiles del ZIP una por una, con tipado y permisos.
