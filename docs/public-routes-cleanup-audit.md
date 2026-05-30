# Auditoria y limpieza de rutas publicas legacy

## Rutas legacy

Estas rutas ya no deben usarse como destino canonico:

- `/inicio`
- `/productos`
- `/productos/[id]`
- `/mis-reparaciones`
- `/mis-reparaciones/[ticketId]`

Ahora la ruta canonica incluye el slug de organizacion:

- `/{organizationSlug}/inicio`
- `/{organizationSlug}/productos`
- `/{organizationSlug}/productos/[id]`
- `/{organizationSlug}/mis-reparaciones`
- `/{organizationSlug}/mis-reparaciones/[ticketId]`

Ejemplo:

- `/default/inicio`
- `/default/productos`
- `/default/mis-reparaciones`

## Compatibilidad segura

Para no romper enlaces existentes, QR de reparaciones, emails o marcadores guardados, las rutas legacy no se borraron fisicamente.

El middleware redirige con `308`:

- `/inicio` -> `/default/inicio`
- `/productos` -> `/default/productos`
- `/productos/abc` -> `/default/productos/abc`
- `/mis-reparaciones` -> `/default/mis-reparaciones`
- `/mis-reparaciones/R-123?verify=xxx` -> `/default/mis-reparaciones/R-123?verify=xxx`

Esto permite retirar las URLs viejas del uso normal sin romper compatibilidad externa.

## Rutas internas revisadas

Estas rutas existen para soporte tecnico/desarrollo y no deberian quedar publicas:

- `/debug`
- `/debug/check-user`
- `/debug/prefetch`
- `/setup`
- `/setup-access`

Se protegieron desde middleware como rutas internas de superadmin.

Tambien se detecto `/products/[id]`, una ruta legacy en ingles con datos internos de producto. Se redirige a:

- `/products/[id]` -> `/dashboard/products/[id]`

Asi queda protegida por el flujo normal del dashboard.

## Rutas publicas canonicas actuales

- `/saas`: landing para vender el SaaS.
- `/register`: registro de nueva empresa.
- `/marketplace`: marketplace global.
- `/empresas/[slug]`: ficha publica de empresa.
- `/{slug}/inicio`: sitio publico de la empresa.
- `/{slug}/productos`: catalogo publico de la empresa.
- `/{slug}/mis-reparaciones`: portal de reparaciones de la empresa.

## Pendiente recomendado

- Actualizar generacion de QR para incluir slug real de organizacion cuando el payload de reparacion lo tenga disponible.
- Quitar rutas legacy fisicamente solo despues de confirmar que no quedan QR/enlaces antiguos en circulacion.
- Eliminar fisicamente `src/app/products/[id]` cuando se confirme que ningun enlace interno la usa directamente.
