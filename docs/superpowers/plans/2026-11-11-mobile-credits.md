# Créditos móvil — correcciones y cartera clara

Alcance aprobado: corregir errores que aparentan ausencia de deuda, respetar moneda/centavos y calendario del negocio, evitar datos anteriores bajo filtros nuevos. Dos vistas paginadas (cliente/cuota), filtros fecha/código/sucursal, indicadores globales y filtrados separados. Ficha con capital/interés/total/cuotas/pagos, estado de cuenta compartible, recordatorio manual y consulta del resumen del expediente. Respuesta compacta de API sin descargar todos los pagos, conservando compatibilidad web. Sin cobros reales, producción, migraciones aplicadas ni publicación.

Verificar primero montos decimales, datos inválidos, fechas y agrupación. Después pruebas de API compacta/tenant/sucursal, recuperación de cobros y contratos existentes. TypeScript raíz/mobile y ESLint tocados. Documentar límites de prueba física y cobertura de datos.
