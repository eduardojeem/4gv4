# Auditoria de busqueda global de /marketplace

## Problema encontrado

- El buscador principal de `/marketplace` enviaba a `/marketplace/empresas`.
- La busqueda solo filtraba empresas por `name` y `slug`.
- Los productos se buscaban aparte en `/marketplace/productos`, solo dentro del cliente.
- No existia una ruta global para buscar productos y empresas al mismo tiempo.
- El buscador no consideraba marca, SKU ni categoria.

## Cambios aplicados

- Se creo `/marketplace/buscar`.
- Se agrego `MarketplaceSearchBox`, reutilizable para home y navbar.
- El home de `/marketplace` ahora busca globalmente.
- El navbar de marketplace incluye acceso/busqueda global.
- La busqueda global filtra:
  - productos por nombre
  - SKU
  - marca
  - categoria
  - empresa
  - empresas por nombre y slug
- La busqueda normaliza acentos para que `categoria` y `categoría` coincidan.

## Rutas relacionadas

- `/marketplace`
- `/marketplace/buscar?q=texto`
- `/marketplace/productos?q=texto`
- `/marketplace/empresas?q=texto`

## Recomendacion siguiente

Para escalar a miles de empresas, mover la busqueda a Postgres con indice `pg_trgm` o `tsvector` por tenant/public marketplace, evitando traer muchos registros para filtrar en memoria.
