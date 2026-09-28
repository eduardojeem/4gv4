# Diseño: imágenes privadas de reparaciones

## Objetivo

Evitar que fotografías de dispositivos y trabajos de reparación puedan abrirse mediante una URL pública permanente. Las imágenes de catálogo y los avatares mantienen su comportamiento actual; el alcance de este cambio es exclusivamente el bucket `repair-images`.

El flujo debe conservar las cinco imágenes remotas existentes, permitir nuevas cargas desde la creación y el detalle de una reparación, y mantener el acceso del cliente desde el seguimiento público autenticado por `repair_token`.

## Decisiones de arquitectura

### Bucket y persistencia

- Una migración establece `storage.buckets.public = false` para `repair-images`.
- La columna heredada `repair_images.image_url` pasa a guardar una referencia interna del objeto, no una URL utilizable. Se conserva el nombre para evitar una migración de contrato innecesaria en todas las consultas existentes.
- La migración reemplaza las URLs públicas históricas cuyo prefijo sea `/storage/v1/object/public/repair-images/` por su ruta interna decodificada.
- Las nuevas filas guardan la ruta interna devuelta por Storage. No se persisten URLs firmadas porque expiran.

### Carga

- `POST /api/upload` conserva autenticación, validación MIME, límite de tamaño y control del plan.
- Para `repair-images`, responde `path` y una URL firmada temporal para previsualización; deja de llamar a `getPublicUrl`.
- El cliente envía `storagePath` al endpoint de imágenes de la reparación. El servidor rechaza rutas externas, traversal y buckets distintos.
- El flujo de creación puede cargar antes de que exista la reparación usando `uploads/<archivo>`. La imagen solo se vuelve accesible desde las APIs de reparación cuando queda vinculada a una fila autorizada.

### Lectura autorizada

- Un helper server-only transforma cada fila de `repair_images` en el contrato existente `{ id, url, description }`, generando una URL firmada de cinco minutos desde la referencia almacenada.
- Las APIs administrativas firman únicamente después de resolver usuario, organización, sucursal y permiso de reparación.
- `GET /api/public/repairs/[ticketId]/images` firma únicamente después de validar `repair_token`, ticket, reparación y organización.
- No se agrega una API genérica que firme rutas arbitrarias.

### Eliminación y compatibilidad

- Al eliminar una imagen se borra primero la fila autorizada y luego el objeto exacto del bucket. Un fallo de Storage se registra y se devuelve como error operativo sin permitir borrar objetos de otra reparación.
- Las cinco filas históricas se convierten desde sus URLs actuales. Si alguna URL no pertenece a `repair-images`, la migración no inventa una ruta y aborta antes de volver privado el bucket.
- Antes de ejecutar la migración, el resolver acepta tanto la URL pública histórica como la ruta interna. Nunca devuelve directamente una URL pública.

## Seguridad y RLS

- El bucket privado no tendrá política pública de `SELECT`.
- Las cargas siguen pasando por la ruta de servidor con service role; el navegador no recibe credenciales elevadas.
- Las políticas de `repair_images` se corrigen para usar `organization_id` de la reparación o `has_org_permission` mediante `EXISTS`, eliminando ramas basadas solamente en roles globales.
- Las rutas se normalizan y deben estar dentro de `repair-images`; no se aceptan URLs proporcionadas por el cliente como autoridad de borrado o firma.
- Las URLs firmadas expiran en 300 segundos y no se almacenan en base de datos, logs ni auditorías.

## Diagnóstico de System Health

- `repair-images` público se considera un error de severidad alta por contenido operativo sensible.
- `product-images` y `avatars` públicos se consideran permitidos, pero el panel informa cuántos objetos y MIME se pudieron inspeccionar.
- Un bucket público desconocido permanece como advertencia hasta inspeccionar su contenido.
- La inspección se limita y pagina para que System Health no haga recorridos ilimitados.

## Pruebas

- Contratos de migración: bucket privado, conversión de rutas y políticas sin rol global.
- Helper de rutas: URL pública histórica, ruta interna, URL ajena y traversal.
- API de carga: `repair-images` devuelve ruta y URL firmada; los buckets públicos conservan URL pública.
- API administrativa: firma solo imágenes de una reparación autorizada y elimina el objeto correcto.
- API pública: token válido recibe URL firmada; token de otro ticket no obtiene imágenes.
- Contrato UI: ambos cargadores usan `storagePath` y siguen mostrando la previsualización temporal.
- Regresión: productos y avatares continúan públicos.

## Despliegue y reversión

1. Desplegar primero código de lectura dual capaz de resolver URLs históricas y rutas internas, mientras el bucket sigue público.
2. Verificar carga, detalle administrativo y seguimiento público con ese código.
3. Aplicar la migración que convierte los cinco valores históricos, endurece políticas y vuelve privado el bucket.
4. Comprobar nuevamente detalle administrativo y seguimiento público con una imagen existente.

La reversión inmediata vuelve a marcar el bucket como público; no elimina objetos. Para recuperar URLs públicas se construyen a partir de las rutas internas existentes, sin modificar ni mover archivos.

## Fuera de alcance

- Cambiar la privacidad de `product-images` o `avatars`.
- Redactar o publicar documentos legales.
- Mover archivos a otro proveedor de almacenamiento.
- Conservar enlaces firmados por más de cinco minutos o exponerlos en páginas indexables.
