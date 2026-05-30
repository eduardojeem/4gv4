# Auditoria de seccion publica SaaS y marketplace

## Estado encontrado

La seccion publica existente estaba enfocada en una tienda tenant:

- `/inicio`: landing publica de la empresa actual.
- `/productos`: catalogo publico de productos del tenant resuelto por subdominio/header.
- `/productos/[id]`: detalle publico de producto.
- `/mis-reparaciones`: portal publico de seguimiento de reparaciones.
- `/api/public/*`: APIs publicas ya filtradas por `organization_id` mediante resolucion de tenant.

Esto es correcto para una tienda individual, pero no separaba tres experiencias diferentes:

- Landing comercial del SaaS para nuevos suscriptores.
- Marketplace global de organizaciones.
- Pagina publica de informacion/productos por organizacion.

## Cambios implementados

### Landing SaaS

Nueva ruta:

- `/saas`

Objetivo:

- Ofrecer el sistema SaaS a nuevos suscriptores.
- Mostrar modulos: POS, inventario, reparaciones, ecommerce, WhatsApp, delivery y analytics.
- Mostrar planes: FREE, BASIC, PRO, ENTERPRISE.
- Enviar el registro a `/register`, que ya crea empresa via `/api/auth/register-company`.

### Marketplace global

Nueva ruta:

- `/marketplace`

Objetivo:

- Listar organizaciones publicas.
- Mostrar productos destacados de varias empresas.
- Separar descubrimiento global de la tienda tenant.

### Pagina publica por organizacion

Nueva ruta:

- `/empresas/[slug]`

Objetivo:

- Mostrar informacion de la empresa.
- Mostrar productos publicos de esa organizacion.
- Mantener datos aislados por `organization_id`.
- Enlazar a tienda tenant por subdominio cuando `NEXT_PUBLIC_BASE_DOMAIN` este configurado.

### Capa de datos publica

Nueva capa:

- `src/lib/public/marketplace.ts`

Responsabilidades:

- Leer organizaciones con cliente admin server-side.
- Leer productos publicos filtrando `organization_id`, `is_active` y `visibility = public`.
- Transformar productos a `PublicProduct` sin exponer costos, proveedores ni datos internos.

## Seguridad

La nueva capa publica no usa `SERVICE_ROLE_KEY` en cliente. Todas las consultas admin ocurren en Server Components o server-side helpers.

Los productos se exponen con datos seguros:

- No se expone precio de compra.
- No se expone proveedor.
- No se expone informacion interna de inventario.
- No se exponen productos `hidden` ni inactivos.

## Compatibilidad

No se modifico el flujo existente de:

- `/inicio`
- `/productos`
- `/mis-reparaciones`
- `/login`
- `/register`

La ruta raiz sigue redirigiendo a `/inicio` para mantener compatibilidad con la tienda actual.

## Siguiente fase recomendada

- Agregar columna/setting `marketplace_enabled` por organizacion.
- Agregar `public_description`, `public_category`, `cover_url` y `custom_domain`.
- Crear filtros reales en `/marketplace`.
- Crear pagina `/empresas/[slug]/productos` si se quiere catalogo completo sin depender del subdominio.
- Conectar planes reales desde `subscription_plans` cuando la tabla quede estable.
