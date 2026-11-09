# Suscripciones: tarjetas, lista y pagos

## Alcance
Mejora general de /superadmin/subscriptions, comprobada con un fixture de 4G Technology y búsqueda 4g-technology. No se verificaron datos ni credenciales reales de esa organización.

## Hallazgos corregidos
- Tarjeta completa como botón con enlaces internos: Enter podía abrir también la ficha. Ahora usa article y acciones explícitas.
- Falta de fecha presentada como Perpetuo: ahora Sin fecha definida y sin barra ficticia.
- Fechas de prueba inconsistentes con período de pago: fecha efectiva común para tabla, tarjeta, atención, filtro y orden de renovación. Fechas de prueba residuales de cuentas activas dejan de generar alertas.
- Franja con pseudoelemento en tr desplazaba las celdas respecto a encabezados: borde en primera celda y colgroup con anchos responsive. Alineación medida sin diferencias a 1280/1440/1920 px.
- Selector de tabla visible antes de que esa vista pudiera mostrarse: breakpoint unificado.
- Falta de proveedor e historial en tarjetas: ambas vistas muestran gestión y enlace a cobros filtrados. El proveedor asignado no demuestra cobro confirmado ni pasarela habilitada.
- Formulario de pago con medios poco visibles y monto anterior al cambiar plan: radios accesibles con ayuda, importe reseteado, explicación de cambio de plan y confirmación preservada.
- Acceso separado a configuración global de medios online. El formulario manual solo registra cobros ya recibidos.

## Verificación
60 pruebas del alcance en siete archivos. TypeScript sin errores y ESLint sin advertencias. Chrome con fixture y todas las APIs interceptadas: tabla/tarjetas, móvil 375 px, modo oscuro, selección de transferencia, cero solicitudes antes de confirmar, cambio de plan limpia importe. Sin desbordamiento horizontal. Prueba obsoleta de texto fuente sustituida por comprobación del precio renderizado.

## Límites
Sin cambios en APIs/RPC, migraciones, activación de proveedores, cobros, datos de producción, commit, push ni deploy. No se infiere cobro automático de un proveedor asignado; confirmaciones y disponibilidad se revisan en las pantallas existentes de cobros y medios de pago. Sigue documentado por separado el pendiente de atomicidad de publicación del PATCH.
