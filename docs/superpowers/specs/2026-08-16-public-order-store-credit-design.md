# Saldo a favor en pedidos públicos

## Objetivo

Permitir que un cliente autenticado vea su saldo a favor y lo aplique total o parcialmente al crear un pedido público, sin confundirlo con un descuento ni permitir que el mismo saldo cubra varios pedidos simultáneos.

## Conceptos contables

El saldo a favor continúa siendo un libro mayor inmutable. Los movimientos positivos acreditan dinero al cliente y los negativos representan consumo definitivo. Los pedidos agregan una reserva separada: una reserva reduce el saldo disponible, pero no crea todavía un movimiento negativo en el libro mayor.

Los importes visibles son:

- **Saldo contable:** suma completa del libro mayor.
- **Saldo reservado:** suma de reservas activas de pedidos pendientes.
- **Saldo disponible:** saldo contable menos saldo reservado.
- **Saldo aplicado al pedido:** importe reservado o consumido para ese pedido.
- **Saldo pendiente del pedido:** total del pedido menos saldo aplicado.

## Identidad y alcance

Solamente un usuario autenticado puede consultar o usar su saldo. El servidor resuelve el cliente de la organización mediante `profile_id` y las reglas existentes de vinculación de cuenta. Nunca acepta un `customer_id` enviado por el navegador para decidir de quién se toma el saldo.

Los pedidos como invitado siguen funcionando, pero no muestran ni permiten aplicar saldo a favor.

## Modelo de reserva

Se crea una tabla de reservas de saldo vinculada a organización, cliente y pedido. Cada pedido puede tener como máximo una reserva. Los estados son:

- `reserved`: apartada al crear el pedido.
- `consumed`: convertida en movimiento negativo al confirmar el pedido.
- `released`: devuelta al disponible por cancelación o vencimiento.

La creación de pedido, la reducción de stock y la reserva ocurren en una sola transacción. La fila del cliente se bloquea antes de calcular el disponible para serializar intentos simultáneos. La operación valida que el importe solicitado sea positivo, no supere el total recalculado por servidor y no supere el saldo disponible.

Confirmar un pedido convierte la reserva en un movimiento negativo de `customer_store_credits` con origen `order`. La restricción única por pedido vuelve idempotente el consumo. Cancelar o vencer cambia la reserva activa a `released` dentro de la misma transacción que libera el stock.

## Estados de pago del pedido

Al crear el pedido:

- Sin saldo aplicado: `PENDING`.
- Aplicación parcial: `PARTIAL`.
- Total cubierto por saldo: `PARTIAL` mientras la reserva no esté consumida, acompañado del indicador `Cubierto con saldo reservado`.

Al confirmar:

- Si el saldo aplicado cubre el total: `PAID`.
- Si queda un importe externo: `PARTIAL`.

Los cobros administrativos posteriores operan solamente sobre `total - store_credit_applied - otros pagos confirmados`. No se permite marcar como pagado un importe superior al pendiente.

## Perfil público

El perfil muestra una sección `Saldo a favor` con:

- saldo disponible destacado;
- saldo reservado, cuando sea mayor que cero;
- saldo contable total;
- movimientos recientes y pedidos que originaron reservas;
- textos distintos para acreditación, reserva, consumo y liberación;
- estados de carga, vacío, error y reintento.

No se muestra información de otra organización aunque el usuario tenga clientes vinculados en varias tiendas.

## Checkout público

Para un cliente autenticado con saldo disponible, el resumen incluye un control `Usar saldo a favor`:

- propone aplicar `min(saldo disponible, total del pedido)`;
- permite reducir el importe o desactivarlo;
- actualiza en vivo `Saldo aplicado` y `Resta pagar`;
- aclara que es un medio de pago y no un descuento;
- vuelve a validar en el servidor al enviar el pedido.

Si el saldo cambió, el pedido no se crea y el checkout conserva el carrito, actualiza el saldo y explica cuánto queda disponible.

## Pedidos públicos y administrativos

Las tarjetas y el detalle del pedido muestran:

- total del pedido;
- saldo a favor reservado o aplicado;
- importe pendiente de cobro;
- etiqueta `Cubierto con saldo a favor` cuando corresponda;
- etiqueta `Pago parcial` con el importe restante cuando corresponda.

En administración, el botón de cobro usa el pendiente real. Confirmar, cancelar y vencer pedidos invocan operaciones transaccionales; la interfaz no escribe directamente reservas ni movimientos.

## API y seguridad

Se amplía la creación pública de pedidos con `storeCreditAmount`, sin aceptar identidad de cliente desde el navegador. Se agrega un endpoint autenticado de resumen de saldo público y se amplían las respuestas de pedidos con campos financieros derivados.

Las funciones con privilegios verifican usuario, pertenencia del perfil al cliente y organización. Se revoca ejecución a `PUBLIC` y `anon`; solamente las rutas servidoras autorizadas pueden invocarlas. Las tablas expuestas tienen RLS por organización y propietario.

## Compatibilidad

Pedidos existentes se interpretan con saldo reservado y aplicado igual a cero. Los clientes invitados, los métodos de pago actuales y el seguimiento por número continúan funcionando. El saldo a favor no cambia subtotal, descuentos, impuestos ni costo de envío.

## Pruebas y aceptación

La implementación debe probar:

- usuario sin sesión no puede consultar ni aplicar saldo;
- una cuenta no puede usar saldo de otro cliente u organización;
- dos pedidos simultáneos no pueden reservar el mismo saldo;
- reserva parcial y total;
- confirmación consume una sola vez;
- cancelación y vencimiento liberan una sola vez;
- el pedido conserva total, aplicado y pendiente correctos;
- el checkout conserva el carrito cuando el servidor rechaza la reserva;
- perfil, seguimiento y administración muestran estados e importes correctos;
- compra sin saldo mantiene el comportamiento anterior.
