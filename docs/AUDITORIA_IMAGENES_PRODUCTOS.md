# Auditoría de Carga de Imágenes en Tarjetas de Producto (/productos)

## Análisis Inicial

Se revisó el componente `ProductCard.tsx` ubicado en `src/components/public/ProductCard.tsx` y la página de productos en `src/app/(public)/productos/page.tsx`.

### Hallazgos

1.  **Componente de Imagen**: Se utiliza correctamente `next/image` para la optimización de imágenes.
2.  **Atributo `sizes`**: La configuración `(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw` es adecuada para el layout de grid (2 columnas en móvil, 3 en tablet, 4 en desktop).
3.  **Carga Prioritaria (LCP)**: Se implementa correctamente `priority={index < 4}` en la página de listado, lo que asegura que las imágenes visibles en la primera pantalla se carguen inmediatamente.
4.  **Optimización de Google Drive**: Se detectó que las imágenes provenientes de `drive.google.com` estaban explícitamente excluidas de la optimización de Next.js (`unoptimized` prop). Esto provocaba que se descargaran las imágenes originales (potencialmente pesadas) en lugar de versiones redimensionadas y optimizadas (WebP/AVIF).
5.  **Manejo de Errores**: Existe un manejo básico que muestra un placeholder si la imagen falla al cargar.
6.  **Layout Shifts**: El contenedor tiene una relación de aspecto fija (`aspect-[4/3]`), lo que previene el Cumulatie Layout Shift (CLS).

## Cambios Realizados

Se modificó `src/components/public/ProductCard.tsx` para mejorar el rendimiento:

1.  **Habilitar Optimización para Google Drive**: Se eliminó la condición `imageSrc.includes('drive.google.com')` del prop `unoptimized`. Ahora Next.js intentará optimizar estas imágenes (siempre que el dominio esté configurado en `next.config.ts`, lo cual se verificó y es correcto).
2.  **Ajuste de Calidad**: Se añadió `quality={80}` para asegurar un buen equilibrio entre calidad visual y tamaño de archivo (el valor por defecto suele ser 75, 80 ofrece un poco más de detalle para productos sin aumentar excesivamente el peso).

## Solución de Inconsistencia de Imágenes (Listado vs Detalle)

Se detectó que el listado de productos y la página de detalle mostraban imágenes diferentes para el mismo producto.

### Causa
- **Listado (`ProductCard`)**: Utilizaba la propiedad `product.image` (que proviene de la columna `image_url` en base de datos).
- **Detalle (`ProductGallery`)**: Priorizaba el array `product.images` (galería) si existía, ignorando `product.image` si este último había sido actualizado recientemente pero no sincronizado con el array.

### Solución
Se actualizó `src/app/(public)/productos/[id]/client-components.tsx` para:
1.  **Unificar la Fuente de Verdad**: Ahora la galería siempre muestra `product.image` como la primera imagen principal.
2.  **Evitar Duplicados**: Se añaden las imágenes restantes de `product.images` filtrando la que ya es principal.
3.  **Optimización**: Se aplicó la misma mejora de optimización para imágenes de Google Drive en la galería de detalles.

## Recomendaciones Adicionales

1.  **Enlaces de Google Drive**: Para asegurar la mejor compatibilidad, se recomienda usar enlaces directos o IDs de archivo en lugar de enlaces de vista previa de HTML.
2.  **Placeholders**: Considerar implementar `blurDataURL` (placeholders difuminados) en el futuro si se dispone de las cadenas base64 de las imágenes pequeñas, para mejorar la percepción de carga (actualmente se usa un fondo sutil).
