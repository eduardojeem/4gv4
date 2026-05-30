# Auditoria de ofertas en marketplace

## Referencia

La URL indicada `https://www.topdekinformatica.com.br/` estaba en mantenimiento al momento de revisar, por lo que no fue posible ver el carrusel exacto. Se implemento una vitrina de ofertas tipo ecommerce, adaptada al marketplace actual.

## Cambios aplicados

- Se agrego `MarketplaceOffersSection`.
- `/marketplace` ahora agrupa productos con oferta por organizacion.
- Cada organizacion tiene una pestana/pill con contador de ofertas.
- La vitrina activa muestra nombre de empresa, cantidad de ofertas, enlace a tienda y carrusel horizontal.
- Se reutiliza `MarketplaceProductCarousel` en variante `offers`.

## Criterio de seleccion

Un producto entra en ofertas si:

- `has_offer = true`
- `offer_price` existe
- `offer_price < sale_price`

Dentro de cada empresa se priorizan productos `featured` y se muestran hasta 12 ofertas.

## Recomendacion siguiente

Crear un campo especifico `marketplace_offer_featured` o una tabla `marketplace_offer_slots` para controlar manualmente que ofertas aparecen primero en esta seccion.
