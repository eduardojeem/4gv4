# Auditoria de seccion publica

## Separacion final

La seccion publica queda dividida en tres areas sin mezclar responsabilidades:

### 1. Marketing SaaS

Ruta principal:

- `/saas`

Navegacion:

- Marketplace
- Caracteristicas
- Negocios
- Planes

Objetivo:

- Vender el sistema a nuevos suscriptores.
- Mostrar planes SaaS.
- Llevar a `/register` para crear una empresa.

### 2. Marketplace global

Rutas:

- `/marketplace`
- `/marketplace/productos`
- `/marketplace/categorias`
- `/marketplace/empresas`

Objetivo:

- Descubrir empresas y productos publicados.
- Agregar categorias globales a partir de productos publicos.
- Mantener un directorio global separado del sitio propio de cada empresa.

### 3. Sitio publico de empresa

Rutas canonicas:

- `/{organizationSlug}/inicio`
- `/{organizationSlug}/productos`
- `/{organizationSlug}/productos/[id]`
- `/{organizationSlug}/mis-reparaciones`
- `/{organizationSlug}/mis-reparaciones/[ticketId]`

Objetivo:

- Mostrar solo informacion, productos y reparaciones de una organizacion.
- No incluir navegacion de marketplace ni marketing SaaS.
- Resolver datos por `organization_id`.

## Limpieza aplicada

- El header de empresa ya no muestra `Marketplace` ni `Para empresas`.
- Marketplace tiene su propio layout y navegacion.
- SaaS tiene su propia navegacion comercial.
- Las rutas legacy `/inicio`, `/productos` y `/mis-reparaciones` siguen redirigiendo a `/default/...` para no romper enlaces antiguos.

## Riesgos pendientes

- La generacion de QR de reparaciones todavia usa URL legacy y depende del redirect; conviene pasarle `organization.slug`.
- Filtros visuales del marketplace estan preparados, pero la busqueda global aun no ejecuta query por parametro.
- Conviene agregar `marketplace_enabled` por organizacion para controlar que empresas aparecen publicamente.
