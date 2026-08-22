# Reconciliacion de saldos historicos de reparaciones

## Problema

Algunas reparaciones historicas guardaron el precio acordado en `estimated_cost`, pero quedaron en modo `automatic` con mano de obra y repuestos en cero. La interfaz muestra ese precio como saldo pendiente, mientras que el servidor recalcula el modo automatico en cero y rechaza el pago con `REPAIR_HAS_NO_BALANCE`.

## Diseno aprobado

- Mantener el calculo automatico estricto para reparaciones nuevas.
- Al cobrar, reconocer como legado solamente el caso conservador: modo automatico, total derivado cero, precio persistido positivo y mayor que lo ya pagado.
- Interpretar ese precio historico como presupuesto acordado para que interfaz y API compartan el mismo saldo cobrable.
- Reconciliar los registros existentes mediante una migracion idempotente: pasar a `budget`, fijar `final_cost` desde `estimated_cost` y crear una nota interna de auditoria.
- Conservar las validaciones de sobrepago, credito por saldo completo, caja abierta e idempotencia.
- Cuando el backend informe que el saldo cambio, mantener abierto el modal, actualizar monto y explicar el cambio sin registrar un error de consola esperado.

## Seguridad

La reconciliacion no aplica si hay mano de obra, repuestos cobrables, costo final explicito, precio estimado no positivo, saldo ya cubierto o reparacion cancelada. La migracion deja trazabilidad interna y no crea pagos ni movimientos de caja.

