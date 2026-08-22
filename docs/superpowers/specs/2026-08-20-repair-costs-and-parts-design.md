# Costos y repuestos en el detalle de reparación

## Objetivo

La sección `Costos y piezas` debe separar claramente el importe fijo de mano
de obra, los repuestos cobrados al cliente y los ajustes comerciales. La
interfaz puede calcular una vista previa en tiempo real, pero el servidor es la
autoridad final para precios, impuestos, permisos, inventario y total.

El cambio conserva estas reglas existentes:

- `unit_price` es el precio cobrado al cliente y `unit_cost` el costo interno.
- El inventario se consume al guardar o modificar los repuestos, no al entregar.
- El estado `entregado` es independiente de `payment_status`.
- Los importes ingresados ya incluyen IVA; el impuesto se discrimina y no se
  vuelve a sumar.

## Modelo de cálculo

La mano de obra usa un monto fijo. No se registran horas ni tarifa horaria.

Por cada repuesto:

`subtotal = cantidad * precio unitario cobrado - descuento del repuesto`

Para la reparación:

`subtotal repuestos = suma de subtotales de repuestos`

`subtotal antes de descuento = mano de obra + subtotal repuestos + cargos adicionales`

`total final = subtotal antes de descuento - descuento general - deducciones`

`saldo pendiente = max(total final - monto pagado, 0)`

Los cálculos monetarios deben realizarse con precisión decimal y aplicar la
política de redondeo existente en el sistema. El navegador nunca envía un total
que el servidor acepte como autoridad: envía los componentes y el servidor los
recalcula.

## IVA incluido

Cada repuesto toma la tasa de IVA vigente de su producto en el inventario. La
mano de obra toma la tasa predeterminada de la organización. Al confirmar, las
tasas se copian a la revisión financiera para que cambios futuros de
configuración no alteren registros anteriores.

Para un importe con IVA incluido:

`base imponible = importe / (1 + tasa)`

`IVA incluido = importe - base imponible`

El resumen discrimina operaciones exentas, al 5% y al 10% cuando correspondan.
El IVA es informativo dentro del total ya cobrado; nunca se adiciona por segunda
vez.

## Reglas de descuentos y margen

- El descuento máximo inicial es 20% y se configura por organización.
- Un usuario normal no puede confirmar un descuento superior al límite.
- Un administrador puede autorizar la excepción, pero debe escribir un motivo.
- Un precio cobrado inferior al costo interno bloquea a usuarios normales.
- Un administrador puede autorizarlo con un motivo obligatorio.
- La autorización, motivo, usuario y valores involucrados quedan auditados.
- No se permiten cantidades, importes, descuentos ni totales negativos.
- Un descuento de repuesto no puede superar su importe bruto.
- Los descuentos y deducciones acumulados no pueden producir un total negativo.

Las alertas del navegador ayudan al usuario, pero estas mismas reglas se
repiten en la API o función transaccional para impedir manipulaciones.

## Interfaz del modal

### Jerarquía

La sección se divide en:

1. **Mano de obra:** monto fijo, tasa y desglose de IVA incluido.
2. **Repuestos:** tabla editable vinculada al inventario centralizado.
3. **Ajustes:** descuento general, cargos adicionales y deducciones.
4. **Resumen:** subtotales, IVA incluido, total final, pagado y saldo pendiente.

El total final usa mayor tamaño tipográfico y una superficie contrastante. Los
estados pagado, parcial y pendiente usan colores semánticos, sin depender solo
del color para comunicar el estado.

### Tabla de repuestos

En escritorio muestra producto, existencia, cantidad, costo interno, precio
cobrado, descuento, tasa de IVA, subtotal y acciones. El buscador consulta el
inventario de la sucursal y completa código, descripción, costo, precio, tasa y
existencia; los valores sensibles se vuelven a consultar al confirmar.

Agregar, editar o eliminar una fila actualiza inmediatamente todos los
subtotales. Las acciones tienen etiquetas accesibles y confirmación cuando una
eliminación afecta inventario ya consumido.

En móvil cada repuesto se presenta como una tarjeta editable. El resumen final
permanece visible en una barra inferior sin ocultar los controles ni el teclado.

### Vista previa

Antes de guardar se abre un paso de confirmación con:

- mano de obra;
- repuestos, cantidades y subtotales;
- descuentos, cargos y deducciones;
- bases imponibles e IVA incluido por tasa;
- total final, monto pagado y saldo pendiente;
- advertencias y excepciones administrativas;
- impacto previsto sobre inventario.

La acción final indica la operación concreta, por ejemplo `Confirmar costos` o
`Autorizar y confirmar`.

## Persistencia y auditoría

La reparación conserva sus campos operativos actuales y referencia una revisión
financiera vigente. Cada confirmación crea una revisión inmutable con:

- componentes y resultado del cálculo;
- instantánea de tasas tributarias;
- instantánea de costos y precios de repuestos;
- usuario, organización, sucursal y fecha;
- motivo del cambio;
- excepciones y autorización administrativa;
- valores anteriores y posteriores.

El historial registra piezas agregadas, editadas y eliminadas. No almacena solo
el total: debe permitir reconstruir por qué cambió. Las reparaciones anteriores
no se recalculan cuando cambia un producto o la configuración de la organización.

La escritura de revisión, actualización de la reparación, movimientos de
inventario y auditoría debe ser atómica e idempotente. Un fallo revierte toda la
operación.

## API y concurrencia

El servidor debe:

1. autenticar al usuario y resolver organización y sucursal;
2. cargar la reparación, pagos, configuración e inventario actuales;
3. validar permisos y estado editable;
4. bloquear o detectar modificaciones concurrentes;
5. recalcular componentes, impuestos incluidos y total;
6. aplicar las mutaciones de inventario exactamente una vez;
7. guardar revisión, auditoría y total vigente en una transacción;
8. devolver la reparación y el resumen financiero actualizados.

Si cambió el costo, precio, tasa o existencia desde que se abrió el modal, la
confirmación se rechaza con un error recuperable y se presenta una comparación
para que el usuario revise los nuevos valores.

## Alcance contable

El modelo conserva por ítem precio, descuento, tasa, base imponible e IVA, y
separa cargos y deducciones. Esto permite conciliar la reparación con el flujo
de facturación, pero la implementación no se declara certificada fiscalmente:
la emisión de comprobantes debe continuar usando la integración fiscal oficial
del sistema y validarse con el contador o responsable tributario del negocio.

## Pruebas requeridas

1. Cálculo de mano de obra fija y múltiples repuestos.
2. Recalculo al agregar, editar y eliminar una pieza.
3. IVA incluido al 5%, 10%, exento y combinación de tasas.
4. Descuento exactamente en el límite y superior al límite.
5. Excepción administrativa con motivo y rechazo sin motivo.
6. Precio inferior al costo para usuario normal y administrador.
7. Cargos, deducciones y prevención de totales negativos.
8. Rechazo de totales manipulados desde el navegador.
9. Actualización concurrente de precio, costo, tasa y existencia.
10. Consumo y reversión de inventario exactamente una vez.
11. Registro completo del historial y sus valores anterior/posterior.
12. Conservación de instantáneas después de cambiar la configuración.
13. Separación entre entrega y estado de pago.
14. Vista previa y comportamiento responsivo en móvil y escritorio.
15. Aislamiento entre organizaciones y sucursales.
16. Reversión completa ante cualquier error transaccional.

## Fuera de alcance

- Cálculo por horas o tarifa horaria.
- Sustitución del sistema de facturación electrónica.
- Recalcular automáticamente reparaciones históricas.
- Cambiar la semántica de entrega, adelantos o cobros ya acordada.
