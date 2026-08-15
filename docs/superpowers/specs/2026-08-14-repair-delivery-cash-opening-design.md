# Apertura de caja durante la entrega de una reparación

## Problema

El paso de cobro de `RepairDeliveryDialog` permite confirmar pagos en efectivo,
tarjeta o transferencia sin comprobar primero que exista una sesión de caja
abierta en la sucursal seleccionada. La API protege correctamente la operación,
pero el usuario descubre el requisito recién después de intentar entregar el
equipo y recibe `REPAIR_CASH_REGISTER_NOT_OPEN`.

## Comportamiento aprobado

- Al entrar al paso **Cobrar reparación**, el modal consulta la caja de la
  sucursal actual y muestra `Consultando caja`, `Caja abierta` o `Caja cerrada`.
- Efectivo, tarjeta y transferencia requieren caja abierta. Mientras la caja
  esté cerrada, `Cobrar y Entregar` permanece deshabilitado.
- Cuando la caja está cerrada se muestra el botón **Abrir caja**. Este abre el
  `OpenCashRegisterDialog` compartido sobre el flujo de entrega.
- Al completar la apertura se vuelve a consultar la sesión y se reanuda el
  cobro sin perder resultado de reparación, método, monto, referencia, nota ni
  consentimiento de saldo pendiente.
- Crédito no requiere caja porque crea la deuda del cliente sin movimiento de
  efectivo. **Entregar y cobrar después** tampoco requiere caja.
- Si la apertura falla, el diálogo de apertura permanece disponible y el cobro
  continúa bloqueado.
- Si la caja se cierra en otra sesión entre la consulta y la confirmación, la
  API conserva la autoridad final: el modal de entrega permanece abierto y
  muestra el error para que el usuario pueda volver a abrir caja.

## Arquitectura

`RepairDeliveryDialog` reutiliza `useCashRegister` para consultar y abrir la
caja `principal`, siguiendo el patrón ya utilizado por
`RepairPaymentDialog` y `repair-form-dialog-v2`. También reutiliza
`OpenCashRegisterDialog`; no se crea una segunda implementación de apertura.

El estado de caja es una protección de experiencia de usuario. La validación
del servidor no se elimina ni se debilita.

## Pruebas

Las pruebas de interacción deben demostrar que:

1. Un cobro en efectivo queda bloqueado con caja cerrada y ofrece **Abrir caja**.
2. Abrir la caja preserva el borrador y habilita **Cobrar y Entregar**.
3. Crédito puede confirmarse con caja cerrada.
4. Entregar con saldo pendiente y consentimiento explícito no requiere caja.
5. Una promesa de confirmación rechazada conserva abierto el modal y los datos.

La verificación incluye las pruebas enfocadas del modal de entrega, pago,
rutas API y cierre financiero, además de TypeScript, ESLint y `git diff --check`
limitado a los archivos de esta mejora.
