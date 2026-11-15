# Créditos móvil: implementación de la auditoría

Fecha: 2026-11-11. Rama local `feat/mobile-finanzas-coherencia`, worktree `fin-ux`. Preserva los cambios anteriores de Finanzas. Sin producción, cobros reales, commit, push, merge ni deploy.

## Qué cambió

- Cartera paginada por cliente y por cuota, con búsqueda, Por cobrar (incluye vencidas), Vencidas, Pagadas y Todas. Fechas de vencimiento, código de crédito y sucursal; accesos a hoy y próximos siete días.
- Los indicadores de toda la cartera del alcance se separan explícitamente del resumen filtrado. Los resultados anteriores no se muestran bajo una búsqueda, vista, organización o sucursal diferente. Se descartan respuestas anteriores y se controlan las solicitudes de paginación.
- Moneda configurada y hasta dos decimales, tanto al mostrar como al enviar cobros. Se rechazan montos ambiguos, separadores de miles y precisión no admitida. Se eliminó el redondeo a enteros del adaptador nuevo.
- Los errores de consulta ya no se convierten en “No tiene créditos” o en un historial vacío. Se muestran errores y acciones de reintento. Los importes inconsistentes se rechazan en lugar de presentarse como cero.
- La ficha usa el calendario del negocio para vencimientos. Muestra capital, intereses/ajustes, total financiado, pagado, pendiente, cuotas y pagos. Los créditos anulados se identifican como anulados; no se presentan como saldados ni permiten cobrar.
- Estado de cuenta informativo compartible y recordatorio manual. No envía mensajes automáticamente ni requiere configurar WhatsApp Business. El usuario elige el destino al compartir.
- Consulta de comprobantes existentes a través de `/api/credits/receipts`. Los pagos antiguos sin snapshot se informan como tales, sin fabricar un comprobante. Se usa la moneda del comprobante guardado.
- Acceso de lectura al resumen del expediente crediticio: estado, límite, utilizado, disponible y requisitos. No agrega aprobación automática, edición de decisiones ni subida de documentos; la administración completa sigue en la web.
- API compacta opcional para móvil. Omite consultas y descarga de historiales de pagos, ventas, ítems y vistas auxiliares que la cartera no necesita; devuelve solo los créditos de la página de cuotas o grupos paginados de clientes. Los consumidores web conservan el formato completo cuando no solicitan el modo compacto.
- La sucursal solicitada se valida con el resolver existente antes de leer créditos. “Todas” explícito se permite a dueño/administrador. No se ampliaron permisos de cobro.

## Recuperación de cobros e integridad

Los cobros nuevos conservan centavos y registran versión de serialización 2 antes del primer envío. Los intentos antiguos sin versión se recuperan con los valores enteros que enviaba su adaptador anterior, la misma clave y el mismo reparto. Esto evita reinterpretar un cobro que pudo haberse confirmado antes de actualizar la app. El mensaje de recuperación muestra el importe realmente enviado. Se conservan las barreras por usuario, empresa, sucursal y cliente y la recuperación persistente de resultados inciertos.

Las pruebas nuevas reproducen montos decimales, fechas cerca de medianoche, consultas fallidas, respuestas inválidas, cartera compacta, agrupación antes de paginar, permisos de sucursal y compatibilidad de reintentos antiguos/nuevos. Las dos pruebas de actualización fallaron antes de corregir la serialización y luego se vuelven a ejecutar con la suite relacionada.

## Límites de la entrega

No requiere una migración nueva. No se aplicaron migraciones existentes. Las consultas de cartera todavía leen las cuotas del alcance para calcular indicadores completos: el modo compacto reduce consultas y respuesta, pero no introduce agregados SQL ni se afirma una mejora medida de latencia.

La ficha del cliente conserva el alcance organizacional de sus APIs existentes; el filtro de sucursal de la cartera no se presenta como un filtro de toda la ficha. La consulta del expediente y de comprobantes depende de los módulos y datos ya habilitados en el sistema; una ausencia o fallo se muestra explícitamente.

Pruebas con mocks y fixtures. No se certificó información histórica de producción ni se probó físicamente en iPhone/Android. La app y las adiciones de API deben actualizarse de forma compatible antes de distribuir esta versión. No se ejecutó la suite completa de todo el repositorio.

Resultados observados al cerrar: suite relacionada de créditos/cobros/expediente/POS, 70 archivos aprobados y 1 omitido; 535 pruebas aprobadas y 8 omitidas (exit 0). Después del ajuste de visualización de fechas de pago, 30 pruebas enfocadas aprobadas (exit 0), incluida la nueva regresión de calendario. TypeScript y ESLint de archivos modificados: raíz y móvil exit 0. git diff --check exit 0; Git avisa de normalización CRLF/LF en un test, sin errores de espacios. La prueba física y las integraciones que omite la suite no se presentan como verificadas.
