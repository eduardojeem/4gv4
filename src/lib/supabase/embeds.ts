/**
 * Relaciones a nombrar al embeber en PostgREST.
 *
 * `agenda_services` (organization_id, product_id) es una tabla intermedia
 * entre productos y organizaciones: desde que existe, PostgREST ve dos
 * caminos de `products` a `organizations` y responde PGRST201 («relación
 * ambigua») a cualquier `organizations(...)` embebido desde productos. Las
 * consultas devolvían error, el código lo tomaba como «sin resultados» y el
 * marketplace mostraba 0 productos y ninguna categoría. Con el nombre de la
 * clave foránea, el camino es uno solo: el producto y su empresa.
 */
export const PRODUCT_ORGANIZATION = 'organizations!productos_organizacion_id_fk'
