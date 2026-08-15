# Diseño: detalle financiero y entrega de reparaciones

## Objetivo

Hacer visible en el detalle de cada reparación si el cliente pagó, cuánto pagó y cuánto queda pendiente, y asegurar que toda entrega pase por un flujo explícito que permita cobrar o confirmar que el saldo se cobrará después.

## Estado financiero en el detalle

El modal de detalle mostrará un resumen financiero separado del estado operativo:

- `Pagado`: total, monto pagado y saldo cero.
- `Pago parcial`: total, monto pagado y saldo restante.
- `Pago pendiente`: total, pagado cero y monto completo pendiente.

El estado operativo seguirá indicando si el equipo está listo o entregado. Un equipo entregado no se presentará como pagado salvo que su saldo sea cero. Cuando existan registros en `repair_payments`, se mostrará el historial con monto, método, fecha y referencia.

## Proceso de entrega

El botón `Entregar` y la transición rápida a `Entregado` abrirán el mismo `RepairDeliveryDialog`; no se permitirá marcar el estado directamente.

El diálogo solicitará:

1. Resultado de la reparación: reparado, retirado sin reparar o no reparable.
2. Cobro opcional mediante efectivo, tarjeta o transferencia.
3. Confirmación explícita si, después del cobro, queda un saldo pendiente.

Si se cobra, el pago y la entrega se registrarán en una única operación transaccional e idempotente. Si no se cobra o el cobro es parcial, la reparación quedará `entregado` y su estado financiero permanecerá `pendiente` o `parcial`.

POS será una alternativa para agregar productos y completar una venta, no un requisito para cobrar la reparación desde su detalle.

## Cobro posterior

Una reparación entregada con saldo mostrará `Cobrar saldo`. Esta acción abrirá `RepairPaymentDialog` con el saldo vigente. El pago actualizará el resumen y agregará una entrada inmutable al historial sin cambiar nuevamente el estado operativo.

## Interfaz y accesibilidad

- El aviso amarillo actual que obliga a usar POS se reemplazará por un mensaje contextual coherente con el saldo.
- Las cifras usarán etiquetas visibles (`Total`, `Pagado`, `Pendiente`) y no dependerán únicamente del color.
- Los botones conservarán controles nativos y nombres accesibles.
- El resumen será legible en móvil y escritorio usando el sistema visual existente.

## Errores y consistencia

- La interfaz mostrará el mensaje devuelto por la API cuando falte una caja abierta o el pago sea inválido.
- No se permitirá cobrar más que el saldo.
- Una entrega con saldo no podrá confirmarse sin consentimiento explícito.
- Un reintento con la misma clave y otro monto o método será rechazado.

## Pruebas

- Detalle pagado: muestra total pagado y saldo cero.
- Detalle pendiente o parcial: muestra el monto pendiente y `Cobrar saldo` cuando corresponda.
- Reparación lista: `Entregar` abre el flujo de resultado y cobro.
- Pago parcial al entregar: exige confirmar el saldo remanente.
- La transición rápida a `Entregado` utiliza el diálogo y no la ruta genérica de estado.
