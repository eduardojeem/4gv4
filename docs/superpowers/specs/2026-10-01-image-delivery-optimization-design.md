# Diseño: optimización previa y entrega económica de imágenes

Fecha: 2026-10-01

## Objetivo

Reducir el consumo de Vercel Image Optimization y el peso descargado por los visitantes sin romper imágenes existentes ni trasladar secretos de Supabase al navegador. Las nuevas imágenes públicas se normalizarán antes de almacenarse y se servirán directamente desde Supabase Storage con caché larga. Vercel quedará reservado para recursos locales o imágenes LCP controladas que realmente necesiten transformación dinámica.

## Situación actual

- El cargador de productos usa `browser-image-compression`, pero permite aproximadamente 1 MB, hasta 1920 px y normalmente conserva el formato original.
- `uploadFile()` no establece `cacheControl` ni `contentType` explícitos.
- Productos, logos globales, branding y recursos del sitio usan rutas de subida diferentes.
- Las rutas generan nombres únicos, por lo que pueden usar caché inmutable sin sobrescribir contenido bajo la misma URL.
- Algunos consumidores públicos usan `next/image` con `unoptimized` para evitar el error 402 de Vercel.
- Las imágenes ya almacenadas pueden ser JPG, PNG, WebP, AVIF, SVG o GIF y deben seguir funcionando.

## Alcance

### Incluido

- Fotografías nuevas de productos cargadas desde el editor de productos.
- Nuevos logos raster de marcas globales y branding.
- Nuevos banners y recursos raster del editor público del sitio.
- Opciones de subida de Supabase Storage (`cacheControl`, `contentType`, `upsert`).
- Política de entrega para recursos de Supabase ya normalizados.
- Pruebas unitarias y de contrato del procesamiento y la subida.

### Excluido

- Reprocesar o borrar archivos existentes.
- Cambiar columnas o formatos de datos en PostgreSQL.
- Crear tres variantes por imagen o introducir un manifiesto de variantes.
- Transformar fotos privadas de reparaciones; tienen requisitos de privacidad y URLs firmadas diferentes.
- Optimizar imágenes agregadas mediante una URL externa: se mantienen como enlaces externos validados.

## Arquitectura

### 1. Contrato común de optimización

Se creará un módulo compartido con perfiles explícitos:

| Perfil | Formato de salida | Dimensión máxima | Objetivo de peso |
|---|---|---:|---:|
| `product` | WebP | 1280 px | 200 KB |
| `banner` | WebP | 1920 px | 400 KB |
| `logo` | WebP | 512 px | 100 KB |

El perfil define también la calidad inicial y un mínimo aceptable. La implementación reducirá calidad de forma limitada cuando sea necesario, sin bucles ilimitados. No ampliará imágenes pequeñas.

En el navegador se utilizará `browser-image-compression`, que ya es una dependencia directa. La salida será un `File` con MIME `image/webp` y extensión `.webp`.

En rutas de servidor se utilizará un procesador raster compartido. La dependencia se declarará explícitamente; no se dependerá de una copia transitiva incluida por Next.js. El módulo devolverá bytes, MIME, extensión y dimensiones finales.

### 2. Excepciones de formato

- SVG se conserva para logos porque ya es vectorial y no se beneficia de WebP.
- GIF animado se conserva cuando el flujo lo admita; convertirlo como imagen estática eliminaría la animación.
- AVIF existente sigue siendo válido, pero las nuevas cargas raster normalizadas usan WebP para limitar variantes y mantener compatibilidad amplia.
- Un archivo que no pueda decodificarse se rechaza con un error claro; no se almacena silenciosamente el original sin optimizar.

### 3. Almacenamiento y caché

Toda nueva imagen pública normalizada se subirá con:

```ts
{
  cacheControl: '31536000',
  contentType: output.mimeType,
  upsert: false,
}
```

Los nombres seguirán siendo únicos mediante UUID, marca temporal o hash. No se reemplazará un archivo manteniendo la misma URL. Esto permite caché de navegador de un año y aprovecha Smart CDN de Supabase sin riesgo de contenido obsoleto.

`uploadFile()` ampliará su contrato de opciones sin exponer `service_role`. Las subidas públicas que hoy usan políticas RLS seguirán usando el cliente autenticado. Las rutas administrativas que usan el cliente de servicio conservarán sus validaciones de sesión, organización y permisos.

### 4. Entrega pública

- Los WebP normalizados de Supabase se servirán directamente, manteniendo `next/image` para dimensiones, lazy loading y prevención de layout shift, pero con `unoptimized`.
- SVG, GIF y recursos muy pequeños también evitarán transformaciones de Vercel.
- Las imágenes locales versionadas y los recursos LCP controlados podrán usar el optimizador de Vercel si está disponible.
- `sizes` debe describir el ancho visible real en cada componente; no se ampliará el conjunto de `deviceSizes` o `imageSizes`.

La función de política de imágenes identificará como evitables las transformaciones de recursos normalizados del bucket `product-images`, sin cambiar el tratamiento de hosts externos no confiables.

## Flujo de datos

### Producto

1. El usuario selecciona una imagen.
2. Se valida tipo y tamaño original.
3. El navegador aplica el perfil `product` y produce WebP.
4. El nombre cambia a una ruta única terminada en `.webp`.
5. El cliente autenticado sube a `product-images` con caché larga.
6. La URL pública se guarda en el producto como hasta ahora.

### Branding, logo o banner

1. El endpoint valida autenticación, organización, tipo y tamaño original.
2. El servidor conserva SVG/GIF admitidos o aplica el perfil correspondiente al raster.
3. Sube el resultado a una ruta única con MIME y caché correctos.
4. Persiste o devuelve la URL como en el contrato actual.

## Seguridad y aislamiento

- No se añade ninguna clave privada al cliente.
- Las rutas con `service_role` mantienen guardias de administrador o superadministrador.
- El procesamiento ocurre después de validar el tamaño máximo de entrada para evitar consumo descontrolado de memoria.
- Se validan MIME y decodificación real; la extensión enviada por el usuario no es autoridad suficiente.
- `upsert: false` evita sobrescribir objetos de otro flujo.
- No se amplían buckets públicos ni políticas RLS.

## Compatibilidad y despliegue

- Las URLs existentes no cambian y no se migran en este trabajo.
- Los consumidores siguen aceptando JPG, PNG, WebP, AVIF, SVG y GIF existentes.
- La adopción es progresiva: solo las nuevas subidas quedan normalizadas.
- El cambio puede revertirse sin tocar base de datos; los WebP ya creados continúan siendo imágenes válidas.

## Observabilidad

System Health seguirá midiendo archivos raster directos. Después del despliegue deberá mostrar:

- nuevas fotos de producto como `.webp`;
- archivos dentro del presupuesto del perfil;
- ausencia de recomendación de Vercel cuando el optimizador responda 402;
- tamaño y estado del optimizador en metadatos del chequeo.

La comprobación operativa en Vercel se hará en Observability → Image Optimization y en Supabase mediante `cf-cache-status` y `Cache-Control` de una imagen nueva.

## Pruebas

- El optimizador de navegador produce `.webp`, MIME correcto y respeta cada perfil.
- No amplía imágenes pequeñas.
- Rechaza archivos corruptos o tipos no admitidos.
- `uploadFile()` transmite `cacheControl`, `contentType` y `upsert: false`.
- Productos guardan la URL nueva y conservan la limpieza de archivos descartados.
- Endpoints administrativos mantienen sus guardias y almacenan WebP con ruta única.
- SVG/GIF admitidos se conservan sin rasterización accidental.
- Los consumidores continúan aceptando URLs antiguas.
- TypeScript, ESLint, pruebas focalizadas y build de producción forman la puerta de salida. Si Turbopack vuelve a quedar detenido, se reportará como build no verificado y no como aprobado.

## Criterios de aceptación

1. Una nueva fotografía JPG/PNG de producto queda almacenada como WebP de hasta 1280 px y objetivo de 200 KB.
2. Una nueva imagen raster de banner o logo usa su perfil correspondiente.
3. La respuesta pública de una imagen nueva incluye caché larga y una URL inmutable.
4. La portada y el catálogo muestran imágenes nuevas y antiguas sin errores.
5. Las imágenes normalizadas de Supabase no generan solicitudes `/_next/image`.
6. No se modifica el esquema remoto ni se exponen credenciales privilegiadas.
7. Las pruebas del contrato de procesamiento, Storage y compatibilidad pasan.
