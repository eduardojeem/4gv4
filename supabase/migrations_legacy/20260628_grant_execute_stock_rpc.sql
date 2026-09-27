-- Dar permisos de ejecución a la función de stock
GRANT EXECUTE ON FUNCTION public.set_branch_inventory_stock(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_branch_inventory_stock(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) TO service_role;
