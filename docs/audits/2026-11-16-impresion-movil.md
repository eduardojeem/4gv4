# Impresión y PDF móvil: reparaciones, créditos, POS y productos — 2026-11-16

## Resultado por sección
- Reparaciones: desde el detalle se ofrece imprimir o compartir PDF del comprobante para cliente y ficha técnica simple. Usa generateRepairReceiptHTML, buildRepairPrintPayload y mapSupabaseRepairToUi de la web; toma papel, garantía, cláusulas y opciones guardadas del comercio. Permite 58 mm, 80 mm y A4. La ficha detallada con PIN no se ofrece en móvil. Firma QR con datos persistidos; retira scripts de autoimpresión de la plantilla para que el sistema operativo controle la salida.
- Créditos: agrega Imprimir al historial de comprobantes del cliente y después de cobrar; PDF existente se conserva. Usa el snapshot guardado, no reconstruye cobros históricos sin comprobante y no vuelve a cobrar.
- POS: auditado el recorrido actual; PosSaleDone ya ofrece imprimir y PDF al completar una venta, con papel 58/80/A4. No se duplicó. Esta tarea no agrega reimpresión al detalle histórico de ventas abierto desde notificaciones.
- Productos: desde el detalle se imprimen o comparten etiquetas con nombre, comercio, SKU/código real y barras. Reutiliza la hoja/formatos web y la codificación JsBarcode sin DOM. Cantidad 1–100, A4 de 24 etiquetas, 50×25 mm o tira de 80 mm. No incluye precio ni variantes en esta primera opción móvil. Sin código/SKU imprimible se explica el requisito; no genera uno nuevo al imprimir.

## Acceso y privacidad
Rutas de solo lectura. Reparaciones reutiliza guard de módulo, permiso, organización y sucursal, y fetchRepairById con su redacción de costos. Productos valida permiso/módulo, sucursal y filtro organization_id; no consulta costos. Respuestas private/no-store. El cliente vuelve a solicitar el documento al imprimir y comprueba época de sesión/sucursal/permisos antes de mostrarlo o compartirlo. Los PDF temporales se eliminan también si falla compartir. No se registran nuevas ventas, pagos o movimientos de stock.

## Verificación
83 pruebas enfocadas y de regresión (12 nuevas) de APIs, permisos, aislamiento, códigos, cantidades, limpieza temporal, recibos, garantías y pagos. TypeScript raíz y mobile y ESLint de lo tocado. React Native Web con plataforma iOS y módulos nativos simulados en 375/768 px: imprimir, compartir, borrar temporal y validar cantidades, sin errores ni desbordes.

Pendiente: prueba física de iOS/Android y una impresora compatible con el servicio de impresión del teléfono. No incorpora un controlador Bluetooth directo. PDF/impresión física y precisión del adhesivo requieren confirmar papel y escala en la impresora. Las pruebas visuales no abrieron un diálogo real de impresión.

Sin migración, producción, commit, push ni deploy. Cambios locales en C:\proyecto\mitiendapy.
