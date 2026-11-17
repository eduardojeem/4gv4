# Detalle móvil de reparación — rediseño 2026-11-17

Referencia: organización del detalle web (datos técnicos y pagos separados, acciones de comprobante agrupadas).

La vista móvil pasa a tener encabezado compacto y resumen común con estado, equipo, cliente, saldo y avance. Se divide en Resumen (cliente, transiciones y garantía), Servicio (equipo, diagnóstico, desbloqueo protegido, técnico y fotos), y Pagos (presupuesto, pagos y repuestos). Imprimir/PDF abre una hoja independiente desde el encabezado o el acceso rápido; WhatsApp mantiene su borrador revisable. No se duplican ni se cambian endpoints de cobro, entrega, comprobantes o avisos.

Se conserva el costo final cero como monto definido, en lugar de presentarlo como presupuesto pendiente. Las acciones de edición/cobro requieren el mismo permiso repairs.orders.update que sus APIs. No se amplían roles ni se modifican datos.

Verificación: 24 pruebas de garantía, desbloqueo, recibo y WhatsApp. TypeScript móvil y ESLint. React Native Web con fixtures a 375/768 px: claro/oscuro, reparación activa, lista, entregada, pausa con costo final cero y solo lectura. Se comprueba navegación entre pestañas, acceso a comprobantes y ausencia de desbordes/errores. Los módulos nativos, editores y hojas se simularon; la cámara, impresión y teclado físico no se validan con estas capturas.

Sin producción, migración, commit, push ni publicación. Pendiente revisión física en la app instalada después de actualizarla.
