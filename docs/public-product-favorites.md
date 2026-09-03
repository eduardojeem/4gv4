# Favoritos públicos

- Corazón en tarjetas y vistas rápidas de tienda y marketplace. El corazón del encabezado abre **Mis favoritos**.
- **Ver todos los favoritos** abre `/marketplace/favoritos`, con búsqueda por producto o tienda, filtro por tienda, enlaces al vendedor y eliminación mediante el corazón. La página y el modal comparten el mismo estado; no mantienen copias separadas.
- Visitantes: referencias guardadas en localStorage, compartidas entre las tiendas de este dominio. Máximo 200 productos agregados desde la interfaz.
- Con sesión: referencias privadas en `public_product_favorites`. Se combinan los favoritos locales al iniciar sesión; se borran del navegador solo después de confirmar el guardado remoto.
- Al salir o cambiar de cuenta, no se muestran las referencias de la cuenta anterior. Fallos de guardado no cambian la selección; fallos de carga ofrecen Reintentar.
- Se guarda solo nombre del producto, identificador, slug y nombre de tienda. No se guardan precios internos, sesiones ni información de otros usuarios. Los nombres son una referencia guardada; precio, stock y disponibilidad actuales se verifican en la página de la tienda. Agotar o retirar un producto no elimina su referencia guardada.
- Las rutas de compra conservan el vendedor. No se mezclan carritos y no se altera el stock al guardar favoritos.

## Despliegue y verificación

Aplicar `supabase/migrations/20260902215636_public_product_favorites.sql` antes de habilitar la sincronización de cuentas. No fue aplicada remotamente por este trabajo. Las políticas RLS limitan SELECT/INSERT/UPDATE/DELETE al propietario autenticado y deniegan acceso anónimo.

`scripts/verify-public-favorites.mjs` valida las políticas en PostgreSQL embebido aislado, usando `PGLITE_MODULE` con una instalación temporal de PGlite. No conecta a producción.

Pruebas: favoritos sin sesión, combinación sin duplicados, cambio de cuenta, respuesta tardía, error de conexión y rutas de tienda. Pendiente prueba autenticada entre dos navegadores tras migrar. No se afirma actualización de stock en tiempo real dentro de la lista de favoritos.
