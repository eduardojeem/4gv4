# API de Inventario de Reparaciones

## Objetivo
- Sincronización con productos en tiempo real
- Consulta y filtrado de inventario
- Historial de movimientos de stock
- Exportaciones CSV/PDF

## Endpoints Supabase
- Tabla `products`: lectura, cambios en tiempo real
- RPC `update_product_stock(product_id, quantity_change, movement_type, reason, reference_id, reference_type)`
- RPC `get_recent_movements(product_id, limit_count)`

## Eventos en tiempo real
- Canal `products` para cambios de productos
- Canal `product_movements` para inserciones de movimientos

## Filtros
- `search`: texto
- `category`: id o nombre
- `supplier`: id o nombre
- `stockStatus`: `in_stock | low_stock | out_of_stock | overstocked`
- `featured`: boolean

## Respuestas
- Productos: `id, name, sku, stock_quantity, min_stock, sale_price, purchase_price, category, supplier`
- Movimientos: `type, quantity, previous_stock, new_stock, reason, user, timestamp`

## Exportaciones
- CSV: columnas básicas de producto
- PDF: tabla con producto, SKU, stock y precio
