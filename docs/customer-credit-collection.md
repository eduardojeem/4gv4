# Cobros de Clientes y Créditos

## SQL antes de publicar

Ejecutar una sola vez, después de las migraciones anteriores del repositorio:

`supabase/migrations/20261012010454_customer_collection_atomic.sql`

La migración crea el registro privado de intentos y la función transaccional de cobro. Solo `service_role` puede invocarla; no exponer esa clave al navegador. Las funciones financieras anteriores se conservan. Este cambio no migra deuda ni aprueba fichas de clientes.

La verificación con fixtures se hace únicamente en la base Docker local. No ejecutar `supabase/tests/customer_collection_atomic.test.sql` ni el script de concurrencia en producción. Que la prueba local pase no confirma que la migración esté aplicada en el proyecto remoto.

## Uso

1. En Clientes, abrir el cliente y revisar su situación: **deuda total**, **deuda vencida**, **cupo disponible** y **saldo a favor** son conceptos distintos. El saldo a favor no se resta automáticamente de la deuda; el cupo no equivale a una aprobación.
2. Elegir **Cobrar**, verificar la sucursal y el reparto automático o manual. Las reparaciones se cobran respetando su sucursal; la cartera de cuotas pertenece a la organización.
3. Ingresar monto y método. Transferencias requieren referencia; tarjetas requieren cupón. Confirmar explícitamente si un excedente debe convertirse en saldo a favor.
4. Confirmar una sola vez. Toda la solicitud se registra o se revierte: cuotas, reparaciones, caja y excedente no quedan como un éxito parcial.
5. El comprobante `COL-…` muestra el importe aplicado y los saldos registrados, no una proyección del formulario. La fidelidad se procesa después y no revierte un cobro confirmado.

Las cuotas antiguas de financiación pueden tener hasta dos decimales. Se conservan y liquidan exactamente; no se redondea la deuda. En el modal de cuotas, la coma separa los decimales. El formulario general de Clientes mantiene su ingreso habitual en guaraníes enteros.

En Créditos, **Cuotas** es la vista inicial. Los accesos **Vencidas** y **Hoy** llevan al listado correspondiente. Se mantienen resumen, créditos, pagos, exportación y ficha documental según permisos existentes.

## Si se pierde la respuesta

El intento conserva su clave y sus datos en esta pestaña, separados por organización, usuario y cliente. Usar **Recuperar/Reintentar el mismo cobro**; no recibir dinero otra vez ni cambiar el monto. La base devuelve el mismo resultado si ya se confirmó. Un error de recuperación no autoriza comenzar otro intento.

Créditos muestra un acceso **Recuperar comprobante** aunque el cobro haya liquidado la última cuota. Clientes también permite recuperar un intento aunque la consulta de deuda falle o ya no queden deudas.

Si se cierra la pestaña, se borra su almacenamiento o se cambia de equipo, revisar primero el historial y los movimientos de caja. No existe recuperación automática entre equipos. Los comprobantes de intentos pendientes no se emiten hasta obtener confirmación del servidor.

## Alcance de datos

Las lecturas recorren páginas de hasta 500 filas, sin truncar la cartera a las primeras 1.000 cuotas o a pagos recientes. El resumen global se calcula en servidor, independiente de página y filtros; el resumen filtrado corresponde al conjunto filtrado. Los anulados no cuentan como deuda activa y los completados no aportan saldo activo pendiente.

Por compatibilidad con los gráficos y las exportaciones actuales, el dashboard todavía descarga el conjunto completo. No es un rediseño de escalabilidad ilimitada: el tamaño de respuesta y la memoria aumentan con la cartera. La API admite paginación explícita de cuotas; migrar todos los consumidores a filtros y agregados SQL queda para una entrega separada.

Vencimientos y pagos usan la zona horaria configurada en la organización, con `America/Asuncion` como respaldo. Sin fecha se muestra **Sin vencimiento definido**; sin historial, **Sin historial suficiente**. La evaluación es orientativa y no decide la elegibilidad del cliente.

El día de vencimiento completo todavía cuenta como a tiempo. Las lecturas corrigen las marcas antiguas de mora basadas solo en la hora, y el nuevo cobro normaliza el estado de la cuota tras el trigger existente sin reemplazar funciones financieras anteriores.

Una consulta fallida no representa cero deuda ni cupo disponible: se muestra un error y se permite reintentar. La búsqueda reciente está separada por usuario y organización y no importa el historial global antiguo.
