# Login y registro de clientes por empresa

## Objetivo

Separar el acceso de clientes finales del login interno de la empresa.

## Rutas nuevas

- `/{organizationSlug}/cliente/registro`
- `/{organizationSlug}/cliente/login`

## Registro de cliente

Endpoint:

- `/api/public/customer-register`

El registro crea:

- usuario en Supabase Auth;
- `organization_members.role = customer`;
- `profiles.role = cliente` para compatibilidad legacy;
- `user_roles.role = cliente` para compatibilidad legacy;
- fila en `customers` con `organization_id` y `profile_id`.

Esto vincula al cliente solamente con la empresa desde la cual se registro.

## Login de cliente

La pantalla `/{organizationSlug}/cliente/login` inicia sesion con Supabase Auth y luego valida:

- que exista la organizacion del slug;
- que el usuario tenga membresia activa en esa organizacion;
- que la membresia sea `role = customer`.

Si no cumple, se cierra la sesion y se muestra error.

Endpoint de validacion:

- `/api/public/customer-scope?slug=...`

## Header publico

Se quitaron los CTA de `Escribinos` del header.

Ahora, cuando el visitante no tiene sesion, el header de empresa muestra:

- `Login cliente`
- `Registrarme`

En mobile:

- `Login cliente`
- `Registrarme como cliente`

## Tenant awareness

Se agrego `cliente` a las rutas reconocidas como publicas por tenant para que:

- cargue branding correcto;
- cargue configuracion de website por organizacion;
- los links del header mantengan el slug de empresa.

Archivos:

- `src/lib/saas/tenant.ts`
- `src/hooks/useWebsiteSettings.ts`

## Recomendacion

Mantener `/login` para staff, owners y superadmin.

Usar `/{organizationSlug}/cliente/login` solamente para clientes finales de esa empresa.
