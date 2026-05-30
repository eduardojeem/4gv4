# Auditoria de /marketplace y carruseles

## Problema encontrado

- El inicio de `/marketplace` construia el carrusel desde `featured_products` dentro de cada organizacion.
- `featured_products` esta limitado a pocos productos por empresa, por eso el carrusel podia quedar vacio aunque hubiera productos publicos.
- El componente anterior enlazaba productos a `/{slug}/inicio`, no al detalle real del producto.
- Las imagenes dependian de `next/image`; si una URL externa no esta en `next.config.ts`, puede fallar el render de imagen.
- El carrusel de categorias tenia clases dinamicas que Tailwind no puede detectar bien y un typo en el tamano responsive del icono.

## Cambios aplicados

- Se creo `src/components/public/MarketplaceProductCarousel.tsx`.
- El inicio de `/marketplace` ahora consulta `getMarketplaceProducts(48)` y arma el carrusel desde el catalogo global.
- `/marketplace/productos` reutiliza el nuevo carrusel para ofertas y destacados.
- Los productos del carrusel y del grid enlazan a `/{organizationSlug}/productos/{productId}`.
- El nuevo carrusel usa `img` con fallback para tolerar URLs remotas no configuradas en Next Image.
- Se corrigio el carrusel de categorias para usar clases Tailwind estaticas.

## Rutas auditadas

- `/marketplace`
- `/marketplace/productos`
- `/marketplace/categorias`
- `/marketplace/empresas`

## Recomendacion siguiente

Agregar un campo explicito `marketplace_featured` o una tabla `marketplace_promotions` para controlar que productos aparecen en el carrusel principal sin depender solo de `products.featured`.
