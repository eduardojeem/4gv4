# Validaciones del modal de pago de reparaciones

## Objetivo

Evitar que el usuario intente cobrar una reparación sin precio o sin saldo pendiente. El modal debe explicar qué falta y ofrecer la siguiente acción correcta antes de enviar una solicitud a la API.

## Estados del modal

### Reparación sin precio

Se considera sin precio cuando el total de la reparación es igual o menor que cero. El modal reemplaza el formulario de pago por un estado informativo con:

- Título: `Primero definí el precio de la reparación`.
- Explicación breve: el cobro necesita mano de obra, repuestos o un total acordado mayor que cero.
- Contexto visible de ticket, cliente y equipo.
- Acción principal `Definir precio`, que cierra el modal de pago y abre la edición de esa reparación.
- Acción secundaria `Cancelar`.

No se consulta ni se exige una caja abierta mientras la reparación no tenga precio.

### Reparación totalmente pagada

Se considera pagada cuando el total es mayor que cero y el saldo pendiente es igual a cero. El modal reemplaza el formulario por un estado de confirmación con:

- Título: `Reparación totalmente pagada`.
- Total, monto pagado y saldo cero.
- Acción única `Cerrar`.

No se muestran métodos, importes, apertura de caja ni botón de cobro.

### Reparación con saldo pendiente

Se conserva el formulario actual. Antes de confirmar debe validar:

- Saldo mayor que cero.
- Monto positivo y no superior al saldo.
- Crédito por el saldo completo.
- Referencia obligatoria para tarjeta o transferencia.
- Efectivo recibido igual o superior al monto aplicado.
- Caja abierta para efectivo, tarjeta o transferencia.

La API continúa siendo la fuente autoritativa. Si informa que el saldo cambió, el modal actualiza su estado sin cerrarse ni producir una promesa no controlada.

## Integración

`RepairPaymentDialog` recibirá una acción opcional `onDefinePrice(repair)`. La página de reparaciones la conectará con el flujo de edición existente: cerrará el pago, seleccionará la reparación, establecerá el modo `edit` y abrirá `RepairFormDialog`.

Si el consumidor no proporciona `onDefinePrice`, el estado sin precio conservará `Cancelar` y no mostrará una acción que no pueda ejecutar.

## Accesibilidad y presentación

- Los estados bloqueados usarán encabezado, texto y un icono; el color no será el único indicador.
- Las acciones serán botones nativos del sistema de diseño.
- El mensaje dinámico de saldo tendrá semántica `role="status"`.
- No se renderizarán controles inutilizables detrás del estado bloqueado.

## Pruebas de aceptación

1. Con total cero, no aparecen métodos ni campos de pago y `Definir precio` ejecuta la acción configurada.
2. Con total positivo y saldo cero, aparece `Reparación totalmente pagada` y no existe `Confirmar cobro`.
3. Con saldo positivo, el formulario y sus validaciones actuales siguen funcionando.
4. Un saldo autoritativo actualizado a cero cambia el modal al estado pagado sin error no controlado.
5. La página conecta `Definir precio` con el diálogo de edición de la misma reparación.

## Fuera de alcance

- Cambiar las reglas de cálculo de precios.
- Relajar las validaciones financieras de la API o de Supabase.
- Modificar el flujo de entrega de equipos.
