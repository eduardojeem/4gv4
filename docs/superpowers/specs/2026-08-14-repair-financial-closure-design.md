# Cierre operativo y financiero de reparaciones

## Objetivo

Unificar la entrega y el cobro de reparaciones para que el equipo pueda entregarse con saldo pendiente de forma explícita, el precio quede congelado al entregar y cada pago posterior tenga trazabilidad individual. El estado operativo (`entregado`) y el estado financiero (`pendiente`, `parcial`, `pagado`) deben seguir siendo independientes.

## Alcance

Este cambio cubre:

- cierre operativo de una reparación;
- congelamiento del precio al entregar;
- cobro simultáneo con la entrega o cobro posterior;
- pagos parciales, efectivo, tarjeta, transferencia y crédito;
- conciliación con caja y cobros desde POS;
- historial inmutable de pagos de reparación;
- fechas de entrega, resultado y garantía;
- autorización por organización y sucursal;
- pruebas de cálculo, transición, concurrencia y errores parciales.

No incluye devoluciones de pagos, notas de crédito, reembolsos ni cambios generales al módulo de finanzas. Esos casos requieren un diseño separado.

## Reglas de negocio

### Precio y cierre

1. Antes de entregar, el servidor recalcula el precio con el motor canónico existente y los repuestos persistidos.
2. El precio congelado usa `final_cost`; si todavía no existe, se deriva conforme a `pricing_mode`.
3. Una entrega se rechaza si el precio es inválido, si no cubre las reglas de costo o si la reparación no está en `listo`.
4. Después de entregar, el formulario ordinario no puede modificar mano de obra, repuestos, descuento ni costo final.
5. La entrega no exige pago completo. Si queda saldo, debe recibirse una confirmación explícita `allowOutstandingBalance: true`.

### Estados independientes

- `status = entregado` significa que el cliente retiró el equipo.
- `payment_status = pendiente` significa que no se registraron pagos.
- `payment_status = parcial` significa que `0 < paid_amount < final_cost`.
- `payment_status = pagado` significa que `paid_amount = final_cost`.
- Un equipo entregado puede permanecer pendiente o parcial y debe seguir apareciendo en la cola de cobros pendientes.

### Pagos posteriores

1. Una reparación entregada con saldo muestra la acción `Cobrar saldo`.
2. Se aceptan pagos parciales por efectivo, tarjeta y transferencia, siempre que no superen el saldo.
3. El crédito debe financiar el saldo completo; la deuda pasa al módulo de créditos y la reparación queda pagada.
4. Cada pago crea una fila en `repair_payments` con reparación, organización, sucursal, usuario, monto, método, referencia, origen, caja y fecha.
5. `repairs.paid_amount` y `repairs.payment_status` se mantienen como resumen derivado y compatible con las pantallas actuales.
6. El POS debe registrar el cobro de reparación mediante la misma operación canónica o insertar el mismo ledger dentro de su transacción atómica.

## Arquitectura

### Base de datos

Una migración crea `public.repair_payments` con:

- `id uuid primary key`;
- `repair_id`, `organization_id`, `branch_id`;
- `amount numeric(12,2)` positivo;
- `payment_method` restringido a `cash`, `card`, `transfer`, `credit`;
- `reference`, `notes`, `source`;
- `cash_session_id`, `credit_id`, `sale_id` opcionales;
- `created_by`, `created_at`;
- clave de idempotencia única por organización.

La tabla usa RLS y políticas de lectura alineadas con permisos de reparaciones. Las escrituras ordinarias se realizan mediante RPC de servidor; no se concederá escritura directa a clientes autenticados.

Se añade un RPC transaccional `close_repair_and_register_payment` que:

1. valida actor, organización, sucursal y permisos;
2. bloquea la reparación con `FOR UPDATE`;
3. exige transición válida desde `listo` para una primera entrega;
4. valida el precio congelado y calcula el saldo;
5. valida idempotencia y monto;
6. inserta el pago, el movimiento de caja y el historial cuando corresponda;
7. actualiza los acumulados financieros;
8. registra entrega, resultado, garantía e historial de estado;
9. devuelve la reparación actualizada y el pago creado.

El mismo RPC admite `deliver = false` para cobrar posteriormente una reparación ya entregada. El cobro a crédito conserva la creación actual de la cuenta de crédito, pero la actualización final de reparación y ledger debe quedar protegida contra concurrencia e idempotencia. Si no puede integrarse la creación del crédito en la misma transacción por dependencias existentes, la API compensará la cuenta creada y devolverá un error sin duplicar el cobro.

### API

- `POST /api/repairs/[id]/delivery` será la única ruta para entregar.
- `POST /api/repairs/[id]/payment` seguirá siendo la única ruta HTTP para cobrar sin entregar.
- `PATCH /api/repairs/[id]/status` rechazará `entregado` e indicará que debe usarse la ruta de entrega.
- Ambas rutas validarán el cuerpo con Zod, resolverán permisos de organización/sucursal y generarán una clave de idempotencia si el cliente no la envía.
- Los errores de dominio tendrán códigos estables: estado inválido, precio inválido, saldo excedido, sin caja, reparación ya entregada y conflicto concurrente.

### Interfaz

El diálogo de entrega mostrará:

- costo final congelado;
- monto pagado y saldo;
- opción de cobrar ahora;
- confirmación explícita para entregar con saldo;
- resultado de entrega y nota.

Después de entregar, las tarjetas, filas y detalle conservarán `Cobrar saldo` mientras el saldo sea mayor que cero. La etiqueta debe decir `Entregado · pago pendiente` o `Entregado · pago parcial`, sin presentar la entrega como cobro completado.

El historial de detalle mostrará los pagos individuales con fecha, método, monto y referencia. No se expondrá el costo interno de repuestos a usuarios sin permiso financiero.

## Compatibilidad y migración de datos

- Las columnas actuales `paid_amount` y `payment_status` permanecen para no romper contratos existentes.
- No se inventarán pagos históricos para filas con `paid_amount > 0`; se insertará como máximo un registro de apertura `source = migration` claramente identificado, porque no existe información fiable para reconstruir métodos o fechas individuales.
- Reparaciones entregadas con `final_cost` nulo reciben como precio congelado `estimated_cost`, dejando rastro de migración.
- La migración debe ser idempotente y no modificar costos finales ya acordados.

## Manejo de fallos y concurrencia

- Dos cobros simultáneos bloquean la misma reparación; el segundo recalcula el saldo y no puede excederlo.
- Reintentar la misma clave de idempotencia devuelve el resultado anterior sin duplicar pago ni caja.
- Un fallo al insertar caja, pago, estado o garantía revierte toda la operación de base de datos.
- La API nunca devolverá error después de haber confirmado parcialmente un pago sin indicar un código de reconciliación; el diseño normal evita ese estado mediante el RPC.
- Una reparación cancelada, recibida, diagnosticada, en reparación o pausada no puede entregarse.

## Seguridad

- Toda mutación exige `repairs.orders.update` y contexto activo de organización/sucursal.
- El actor, organización, sucursal, costo interno, costo final y acumulado pagado se resuelven del lado servidor/base de datos.
- No se aceptan desde el cliente `paid_amount`, `payment_status`, `delivered_at` ni identificadores de caja arbitrarios.
- Las funciones privilegiadas revocan ejecución a `PUBLIC`, `anon` y `authenticated`; solo `service_role` puede ejecutarlas desde las rutas protegidas.
- Se registran usuario, organización, sucursal e idempotencia para auditoría.

## Pruebas y criterios de aceptación

### Pruebas de dominio/API

- entregar desde `listo` con pago total deja `entregado` y `pagado`;
- entregar desde `listo` sin pago requiere confirmación y deja `pendiente`;
- entregar con pago parcial deja `parcial`;
- cobrar después de entregar reduce el saldo y finalmente deja `pagado`;
- no se puede entregar desde otro estado ni mediante la ruta genérica de estado;
- no se puede cobrar más que el saldo;
- un crédito debe cubrir todo el saldo;
- un reintento idempotente no duplica pago ni movimiento de caja;
- dos cobros concurrentes no superan el total;
- garantía, resultado, fechas e historial se escriben por la única ruta de entrega;
- un fallo de caja revierte el pago completo.

### Pruebas de interfaz

- el diálogo informa costo, pagado y saldo;
- entregar con saldo exige confirmación explícita;
- una reparación entregada con saldo conserva `Cobrar saldo`;
- una reparación pagada no ofrece un nuevo cobro;
- el historial muestra los pagos individuales;
- los estados operativo y financiero tienen textos distintos y accesibles.

### Verificación

- tests enfocados de precios, repuestos, entrega, pagos, estado y componentes;
- TypeScript;
- ESLint de archivos tocados;
- `git diff --check`;
- aplicación y prueba remota de la migración antes de afirmar despliegue completo;
- prueba autenticada del flujo `listo -> entregar con saldo -> cobrar saldo -> pagado`.

## Despliegue

1. Aplicar la migración y confirmar tabla, RLS, funciones y backfill.
2. Publicar las rutas compatibles con el RPC nuevo.
3. Publicar la interfaz y observar errores de dominio y conciliación de caja.
4. Mantener las columnas resumen para rollback de interfaz; el rollback de base no elimina el ledger creado.
