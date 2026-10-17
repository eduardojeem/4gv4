# Optimización de lecturas y entorno local — 2026-10-17

Los indicadores de Inicio, el resumen del POS y los ingresos mensuales de clientes se calculan en SQL. El navegador recibe agregados; el POS conserva la descarga completa del período al solicitar detalles o exportar. No se sustituye un error por ceros ni por una descarga masiva de respaldo.

La caché vive únicamente en memoria del navegador durante 30 segundos, con un máximo de 25 entradas. Se separa por usuario, organización, sucursal, período y autorización. Cambiar organización o autenticación la invalida; actualizar explícitamente fuerza la consulta. Las funciones usan `SECURITY INVOKER`, permisos y filtros de organización/sucursales, manteniendo las políticas RLS existentes.

## Aplicación antes de publicar

Aplicar estas tres migraciones, en este orden, antes de desplegar el código consumidor:

1. `supabase/migrations/20261017213627_dashboard_home_summary.sql`
2. `supabase/migrations/20261017213637_dashboard_pos_summary.sql`
3. `supabase/migrations/20261017213719_dashboard_customer_monthly_summary.sql`

Esta implementación no aplica SQL remoto ni publica una versión nueva. Si falta una función, la pantalla muestra que los datos no están disponibles. La comprobación autenticada en producción queda pendiente de aplicar las migraciones y desplegar. Los fixtures SQL locales no sustituyen esa comprobación.

## Docker

El entorno local `4gv4` se detuvo mediante Supabase CLI con `backup:true`. Se conservaron los volúmenes `supabase_db_4gv4`, `supabase_edge_runtime_4gv4` y `supabase_storage_4gv4`; no se ejecutó limpieza de imágenes o volúmenes. La aplicación apunta al proyecto remoto, no al contenedor local.

`supabase/config.toml` fija `project_id = "4gv4"` para conservar la identidad de los datos y deshabilita Analytics local. Los comandos son:

```sh
npm run supabase:local:start
npm run supabase:local:stop
```

El arranque excluye Logflare y Vector, cuyo recolector estaba reiniciándose por una conexión Docker TCP rechazada. No se modifica la observabilidad del proyecto alojado.

## Alcance del ahorro

Los fixtures con más de 1.000 registros verifican agregados completos y respuestas acotadas: Inicio devuelve menos de 2 KB; clientes devuelve filas mensuales; POS limita los recientes a 10 y los productos principales a 5. Las exportaciones siguen incluyendo todas las filas autorizadas del período.

Esto reduce consultas repetidas y transferencia al navegador. El importe de una factura depende también del plan, cómputo, almacenamiento y tráfico reales; no se pudo consultar Usage/Billing autenticado. No se eliminaron ni pausaron proyectos o ramas remotos, incluidos los dos identificadores consultados por el usuario.

La serie mensual admite hasta 400 días y el POS hasta 20 años, con error explícito ante rangos inválidos. Los registros históricos sin sucursal conservan el filtro de organización y las políticas existentes.

## Verificación local

- Suite consolidada: 18 archivos, 145 pruebas aprobadas.
- Regresiones finales de RPC, carga bajo demanda, cambio de período y payloads: 5 archivos, 31 pruebas aprobadas (hay solapamiento con la suite anterior).
- El último ajuste de protección contra respuestas de un período anterior pasó sus 6 pruebas del hook POS.
- Fixtures SQL de Inicio y clientes aprobados con más de 1.000 ventas, sucursales no asignadas/inactivas/ajenas, registros antiguos sin sucursal y límites de calendario. La RPC del POS se ejecuta en PGlite dentro de las pruebas anteriores.
- TypeScript sin emisión y ESLint de los archivos cambiados aprobados.
- Compilación de producción `next build --webpack`: código de salida 0; 283 páginas estáticas generadas. Se ejecutó con la configuración existente del proyecto, sin publicar el resultado.

El detalle de devoluciones filtra sus fuentes antes de devolver los casos, usando el patrón documentado de [filtros OR sobre recursos embebidos de PostgREST](https://docs.postgrest.org/en/v13/references/api/resource_embedding.html#or-filtering-across-embedded-resources). La forma de la consulta tiene pruebas de contrato; queda pendiente comprobarla con una sesión autenticada después del despliegue.
