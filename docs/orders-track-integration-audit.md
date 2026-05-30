# Auditoria e integracion de orders/track

## ZIP recibido

- `orders/page.tsx`: dashboard completo de pedidos con filtros, estados, exportacion y modales.
- `orders/components/CreateOrderModal.tsx`: alta de pedido desde productos y clientes.
- `orders/components/OrderDetailModal.tsx`: detalle operativo y acciones de estado/pago.
- `track/page.tsx` y `track/TrackOrderClient.tsx`: consulta publica por numero de pedido o email.

## Hallazgos

- El codigo del ZIP no podia copiarse directo porque dependia de hooks y rutas que no existen en este proyecto: `useOptimizedOrders`, `useOptimizedProducts`, `useTenantPublicRouting`, `/api/orders/public/track`.
- El proyecto actual ya tiene arquitectura SaaS con `organizations`, `organization_members`, `customers`, `products`, `withTenantAuth` y paginas publicas por `/:organizationSlug/...`.
- No existia una tabla ecommerce de pedidos separada de POS `sales`; mezclar ambos flujos habria dejado estados y tracking publicos acoplados al POS.

## Cambios aplicados

- Se agrego `customer_orders`, `customer_order_items` y `customer_order_status_history` con `organization_id`, RLS tenant-aware e indices.
- Se creo una capa compartida en `src/lib/orders` para estados, tipos, normalizacion y formato base.
- Se agregaron APIs admin:
  - `GET/POST /api/orders`
  - `GET/PUT /api/orders/[id]`
  - `PATCH /api/orders/[id]/status`
- Se agrego API publica:
  - `GET /api/public/orders/track`
- Se integro el dashboard en `/dashboard/orders`.
- Se integro tracking publico en:
  - `/track`
  - `/:organizationSlug/track`
- Se agrego acceso en sidebar, mobile nav, breadcrumb y header/footer publico.
- Se agrego carrito publico por tenant:
  - `/:organizationSlug/carrito`
  - boton de carrito en header publico
  - boton agregar al carrito en catalogo y detalle de producto
  - checkout publico conectado a `customer_orders`

## Sincronizacion

- Los pedidos quedan ligados a `organization_id`.
- El dashboard usa clientes existentes o crea un cliente rapido en la organizacion activa.
- Los items se validan contra productos de la organizacion activa.
- `track` consulta la misma tabla que actualiza `orders`, filtrada por organizacion.
- Los estados administrativos se reflejan en la vista publica al volver a buscar o recargar.
- El carrito usa `localStorage` separado por empresa y el servidor recalcula precios/productos antes de crear el pedido.

## Pendientes recomendados

- Agregar notificaciones WhatsApp/email al cambiar estado.
- Descontar stock automaticamente si el flujo comercial lo requiere.
- Agregar historial visible en el detalle admin si se quiere auditoria completa de cambios.
