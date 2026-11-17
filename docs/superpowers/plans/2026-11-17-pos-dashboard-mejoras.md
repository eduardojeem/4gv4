# Dashboard POS: mejoras aprobadas

Alcance: corregir los hallazgos de la auditoría y reorganizar Detalle de la venta. Sin migraciones, producción ni publicación. Conservar cambios ajenos.

1. Reproducir pagos mal clasificados, cartera sin cambio de ámbito y respuestas tardías del detalle.
2. Vincular cargas a usuario/empresa/sucursal y período. Invalidar respuestas obsoletas y permitir reintentar.
3. Conservar saldo a favor y cantidades en reimpresiones; rechazar métodos sin identificar y ventas anuladas. Usar únicamente datos del comercio.
4. Organizar el detalle en encabezado adaptable, resumen, cliente, artículos y pagos. Permisos en acciones, sin ampliar acceso. Mostrar datos faltantes explícitamente.
5. Propagar la anulación a estadísticas y detalles; avisar éxito de recarga solo si todas las consultas resultan correctas.
6. Verificar pruebas enfocadas, TypeScript, ESLint y vista con datos simulados.
