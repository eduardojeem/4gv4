-- ============================================================================
-- Borrar tres funciones de inventario sin llamadores y sin filtro de empresa
-- ============================================================================
--
-- `get_inventory_stats`, `get_inventory_filtered` y `get_products_with_alerts`
-- vienen de 20260115_inventory_optimization.sql y no las invoca ningun archivo
-- del proyecto. Ninguna filtra por `organization_id` ni por sucursal:
-- `get_inventory_stats()` cuenta `FROM products` sin condicion alguna.
--
-- Hoy las salva que corren con los permisos de quien las llama y la RLS de
-- `products` es por inquilino. Pero su firma promete «estadisticas del
-- inventario» sin decir de quien, y estan escritas como si ese problema ya
-- estuviera resuelto. Se borran ahora para que nadie las descubra y las use
-- creyendo eso.
--
-- Los indices de esa misma migracion se conservan: siguen sirviendo.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.get_inventory_stats();
DROP FUNCTION IF EXISTS public.get_products_with_alerts();
DROP FUNCTION IF EXISTS public.get_inventory_filtered(TEXT, UUID, UUID, TEXT, BOOLEAN, INT, INT);

COMMIT;

NOTIFY pgrst, 'reload schema';
