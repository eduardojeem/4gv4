# Cierre financiero de equipos retirados sin reparación

## Problema

Cuando una reparación termina como `Retirado sin reparar` o `No fue posible
reparar`, el costo presupuestado no representa necesariamente el trabajo
realmente realizado. Mantener ese importe completo puede crear una deuda
incorrecta; eliminarlo sin conciliación también puede ignorar diagnóstico,
mano de obra, repuestos consumidos o adelantos recibidos.

El cierre debe determinar el cargo real, conciliarlo con lo pagado, devolver
los repuestos reutilizables al inventario y resolver cualquier diferencia antes
de completar la entrega.

## Alcance

Este flujo aplica únicamente a los resultados:

- `withdrawn`: Retirado sin reparar.
- `unrepairable`: No fue posible reparar.

El resultado `repaired` conserva su flujo actual de cobro y entrega.

## Flujo de usuario

### 1. Definir el cargo final

Después de elegir uno de los resultados sin reparación, el modal muestra un
paso de cierre con estas opciones:

- **Sin cargo:** costo final igual a cero.
- **Solo diagnóstico o trabajo realizado:** el usuario ingresa la mano de obra
  efectivamente cobrable.
- **Diagnóstico más repuestos consumidos:** suma mano de obra y repuestos que no
  pueden reintegrarse.
- **Importe excepcional:** permite acordar otro total y exige un motivo visible
  y auditable.

El modal presenta siempre costo anterior, pagos recibidos, cargo final y
diferencia resultante.

### 2. Resolver los repuestos

Cada repuesto vinculado se clasifica como:

- **Consumido o no recuperable:** permanece descontado del inventario y puede
  formar parte del cargo final.
- **Reutilizable:** vuelve al inventario de la sucursal mediante un movimiento
  auditable de reversión.

El valor de un repuesto reutilizable no forma parte del cargo final. La entrega
no puede confirmarse mientras exista un repuesto sin clasificación.

### 3. Conciliar el adelanto

El sistema calcula en el servidor:

`diferencia = cargo final - total pagado`

- Si la diferencia es positiva, el usuario puede cobrarla en el momento o
  entregar con saldo pendiente mediante confirmación explícita.
- Si es cero, la reparación queda saldada.
- Si es negativa, existe un importe a favor del cliente que debe resolverse
  como devolución inmediata o saldo a favor.

### 4. Resolver dinero a favor

Cuando el cliente pagó más que el cargo final, el usuario elige:

- **Devolver ahora:** registra una salida asociada a la reparación. Una
  devolución en efectivo requiere caja abierta y ofrece **Abrir caja** dentro
  del modal. Una devolución por transferencia exige referencia.
- **Dejar como saldo a favor:** crea un crédito disponible en la cuenta del
  cliente, visible desde créditos y desde el detalle de la reparación.

No se permite completar la entrega dejando un excedente sin destino.

## Resumen antes de confirmar

El paso final muestra:

- Resultado de la reparación.
- Cargo final y su composición.
- Total adelantado.
- Importe adicional a cobrar, saldo pendiente, devolución o saldo a favor.
- Repuestos consumidos y reintegrados.
- Método y referencia de cobro o devolución.
- Motivo, cuando corresponda.

La acción principal usa una etiqueta específica, por ejemplo `Cerrar y
entregar`, `Devolver y entregar` o `Crear saldo a favor y entregar`.

## Contrato y persistencia

El cliente envía una intención de cierre con:

- Resultado `withdrawn` o `unrepairable`.
- Modo de cargo y valores de trabajo acordados.
- Resolución individual de los repuestos.
- Cobro adicional o tratamiento del excedente.
- Motivo y nota.
- Clave de idempotencia.

El servidor vuelve a consultar la reparación, pagos, repuestos, inventario,
sucursal y caja. Recalcula el cargo final y todas las diferencias; no acepta
totales financieros ni cantidades de inventario controladas por el navegador.

Una función transaccional atómica debe:

1. Bloquear y validar la reparación dentro de la organización y sucursal.
2. Validar que todavía no fue entregada y que el cierre no fue procesado.
3. Recalcular el cargo final permitido.
4. Reintegrar los repuestos reutilizables al inventario exactamente una vez.
5. Mantener como consumidos únicamente los repuestos clasificados así.
6. Registrar cobro adicional, devolución o saldo a favor.
7. Actualizar el estado financiero y entregar el equipo.
8. Guardar auditoría e idempotencia.

Si cualquier validación o movimiento falla, toda la transacción se revierte.
La validación existente de organización, sucursal y caja permanece como
autoridad final.

## Errores y recuperación

- Si no hay caja para un cobro o devolución en efectivo, el modal conserva el
  borrador y ofrece abrirla.
- Si cambia el stock o los pagos de forma concurrente, el servidor rechaza el
  cierre y el modal vuelve a cargar el resumen real.
- Un reintento con la misma clave de idempotencia devuelve el resultado previo
  sin duplicar caja, saldo a favor ni inventario.
- Los errores del servidor se muestran dentro del modal; no se convierten en
  errores de ejecución de Next.js.

## Detalle posterior

El detalle de reparación muestra una sección de cierre con:

- Resultado y fecha de entrega.
- Cargo final.
- Pagos aplicados.
- Devolución realizada o saldo a favor creado.
- Repuestos reintegrados y consumidos.
- Motivo y usuario responsable.

## Pruebas

La implementación debe cubrir:

1. Retiro sin cargo y sin adelanto.
2. Diagnóstico menor, igual y mayor que el adelanto.
3. Imposible reparar con repuestos consumidos y reutilizables.
4. Reintegro de stock una sola vez, incluso ante reintentos.
5. Cobro adicional con caja abierta y cerrada.
6. Devolución en efectivo con caja abierta y cerrada.
7. Devolución por transferencia con referencia obligatoria.
8. Creación de saldo a favor sincronizado con la cuenta del cliente.
9. Bloqueo de cierre cuando un repuesto no tiene resolución.
10. Rechazo de totales manipulados y de cierres entre organizaciones o
    sucursales.
11. Reversión completa cuando falla cualquier parte de la transacción.
12. Presentación del cierre en el detalle de reparación.
