# Cobro de reparación con apertura de caja y vuelto

## Objetivo

Mejorar el modal de pago de reparaciones para que el usuario conozca el estado de caja antes de confirmar, pueda abrirla sin abandonar el cobro y procese efectivo recibido y vuelto sin alterar el importe contable aplicado a la reparación.

## Alcance

- Cambiar el título del modal a `Procesar pago de reparación`.
- Consultar la caja activa de la sucursal al abrir el modal.
- Mostrar estados `Consultando caja`, `Caja abierta` y `Caja cerrada`.
- Cuando la caja esté cerrada, ofrecer `Abrir caja` mediante `OpenCashRegisterDialog`.
- Conservar reparación, método, monto, referencia y nota mientras se abre la caja.
- Al completar la apertura, volver automáticamente al pago y actualizar el estado de caja.
- Para efectivo, separar `Monto aplicado a la reparación` y `Efectivo recibido del cliente`.
- Calcular y mostrar el vuelto en tiempo real.
- Mantener pagos parciales y el botón para usar el saldo completo.

No se modificará el RPC financiero, el esquema de base de datos, la lógica de créditos ni la entrega del equipo.

## Reglas financieras

- Efectivo, tarjeta y transferencia requieren caja abierta porque producen movimientos asociados al turno.
- Crédito no requiere caja abierta y puede confirmarse aunque la caja esté cerrada.
- El monto aplicado debe ser mayor a cero y no superar el saldo pendiente.
- Para crédito, el monto aplicado debe cubrir todo el saldo pendiente.
- Para efectivo, el efectivo recibido debe ser igual o mayor al monto aplicado.
- El vuelto es `efectivo recibido - monto aplicado` y nunca se registra como ingreso.
- El endpoint recibe únicamente el monto aplicado. El efectivo recibido es una ayuda operativa del cliente y no cambia `repair_payments`, `paid_amount` ni `cash_movements`.
- El servidor conserva la autoridad final. Si la caja se cierra después de la consulta, el error mantiene abierto el modal y conserva sus campos.

## Experiencia de usuario

El encabezado identificará reparación, cliente y equipo. El resumen mostrará total, pagado y saldo pendiente con jerarquía compacta.

Junto al selector de método aparecerá el estado de caja:

- `Caja abierta`: confirmación visual discreta.
- `Consultando caja`: estado ocupado sin habilitar cobros que requieran turno.
- `Caja cerrada`: aviso amarillo con explicación y acción `Abrir caja`.

`Abrir caja` mostrará el diálogo compartido encima del cobro. Al confirmar la apertura, el diálogo de caja se cerrará y el de pago recuperará el foco con todos sus valores intactos.

Al seleccionar efectivo:

- `Monto aplicado a la reparación` controla cuánto se descuenta del saldo.
- `Efectivo recibido del cliente` registra cuánto entregó físicamente para el cálculo visual.
- `Usar saldo completo` completa el monto aplicado y, si todavía no se indicó efectivo recibido, lo iguala al saldo.
- El resumen de vuelto se destaca cuando es positivo.
- Un importe recibido insuficiente presenta un error y deshabilita `Confirmar cobro`.

Tarjeta y transferencia conservan su referencia obligatoria. Crédito conserva cuotas, frecuencia e interés.

## Arquitectura y datos

`RepairPaymentDialog` usará `useCashRegister` para `checkOpenSession` y `openRegister`, igual que el adelanto del formulario de reparaciones. Reutilizará `OpenCashRegisterDialog`; no duplicará formularios ni llamadas de apertura.

El estado de apertura (`openingAmount`, `openingNote`, `isOpeningRegister`) vivirá junto al modal de pago. Abrir el segundo diálogo no desmontará ni reinicializará los campos del pago.

Después de `openRegister('principal', amount, undefined, note)`, el flujo volverá a consultar la sesión. Solo mostrará `Caja abierta` si existe una sesión activa en la sucursal actual.

`RepairPaymentResult` conservará el contrato que se envía al endpoint. El efectivo recibido no se añadirá al payload financiero.

## Errores y recuperación

- Si falla la consulta de caja, se tratará como no disponible para métodos que requieren turno y se permitirá reintentar.
- Si falla la apertura, el diálogo de apertura permanece disponible y el cobro conserva sus datos.
- Si el servidor devuelve `REPAIR_CASH_REGISTER_NOT_OPEN` al confirmar, el modal no se cierra y el usuario puede abrir caja y reintentar con la misma información.
- Durante apertura o cobro se deshabilitan acciones incompatibles para evitar envíos duplicados.

## Pruebas

Se cubrirán con pruebas de interacción:

1. Caja cerrada muestra el aviso y deshabilita efectivo, tarjeta y transferencia.
2. Crédito permanece disponible con caja cerrada.
3. `Abrir caja` presenta el diálogo compartido.
4. Una apertura exitosa actualiza a `Caja abierta` y conserva monto, método y nota.
5. Efectivo recibido calcula el vuelto correcto.
6. Efectivo insuficiente bloquea el cobro.
7. El payload contiene el monto aplicado y no el efectivo recibido.
8. El saldo completo completa los campos de efectivo de forma segura.
9. Un error de confirmación conserva el modal y sus valores.

La validación incluirá pruebas enfocadas de reparaciones y caja, TypeScript, ESLint sobre archivos modificados y revisión del diff. La prueba real en navegador requerirá una sesión autenticada y datos seguros de desarrollo.

