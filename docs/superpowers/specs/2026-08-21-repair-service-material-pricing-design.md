# Diseño: servicios, materiales incluidos y precios mayoristas en reparaciones

## Objetivo

Corregir la presentación y el cálculo de servicios que incluyen materiales. El sistema no debe convertir automáticamente la diferencia entre el precio total de un servicio y su costo interno en una mano de obra declarada. Debe distinguir de forma persistente entre servicios, materiales incluidos y repuestos cobrados por separado, aplicando la tarifa mayorista verificada cuando corresponda.

## Alcance

Este cambio cubre el modal de nueva reparación, la revisión previa, el contrato de creación, la persistencia de piezas y el cálculo presentado al operador. No incorpora todavía una lista de materiales o BOM configurable con varios productos por servicio; esa ampliación queda fuera de alcance.

## Modelo conceptual

Cada línea relacionada con costos tendrá una clasificación explícita:

- `service`: servicio elegido del catálogo. Su precio es el precio total cobrado por ese servicio.
- `included_material`: material cuyo costo interno está contenido en un servicio. Su precio adicional al cliente es cero.
- `charged_part`: repuesto cobrado por separado. Aporta su precio de venta al subtotal de repuestos.

Las reparaciones existentes y las líneas sin clasificación se interpretarán como `charged_part` para conservar el comportamiento histórico.

Una línea `included_material` guardará costo interno, cantidad y referencia descriptiva. No se contará como precio de repuesto, no disparará la validación ordinaria de venta bajo costo y no se presentará como descuento. Si está vinculada a un producto físico, seguirá estando sujeta a stock, sucursal y costo verificados por el servidor.

## Regla de precios

Al seleccionar un servicio:

1. El servidor o el catálogo sincronizado entrega precio normal, precio mayorista y costo interno.
2. Si el cliente fue verificado como mayorista y existe un `wholesale_price` positivo, se aplica esa tarifa al total del servicio.
3. Si el cliente es mayorista pero no existe tarifa mayorista, se usa el precio normal y la interfaz informa `Sin tarifa mayorista configurada`.
4. El costo interno nunca cambia por la condición mayorista.
5. El precio total del servicio no se reparte artificialmente entre repuesto y mano de obra.

Ejemplo minorista:

- Servicio: Gs. 250.000.
- Material incluido: Gs. 0 adicionales.
- Costo interno del material: Gs. 100.000.
- Total de referencia: Gs. 250.000.
- Margen estimado antes de otros costos: Gs. 150.000.

Ejemplo mayorista con tarifa configurada:

- Precio normal del servicio: Gs. 250.000.
- Tarifa mayorista aplicada: Gs. 220.000.
- Material incluido: Gs. 0 adicionales.
- Costo interno: Gs. 100.000.
- Margen estimado antes de otros costos: Gs. 120.000.

## Persistencia y migración

`repair_parts` incorporará una columna cerrada `line_type`, con valor histórico predeterminado `charged_part`. La migración será compatible con filas existentes y añadirá una restricción que acepte únicamente `service`, `included_material` o `charged_part`.

Una línea `service` podrá conservar el `product_id` del servicio del catálogo para trazabilidad y precio, pero no consumirá inventario. Las operaciones de stock procesarán únicamente productos clasificados como físicos; una línea `included_material` vinculada a un producto físico sí consumirá su cantidad.

El contrato de creación admitirá la clasificación, pero el servidor volverá a resolver para líneas vinculadas al catálogo:

- organización y sucursal;
- tipo de artículo;
- precio normal o mayorista vigente;
- costo interno vigente;
- stock disponible cuando sea físico.

El cliente no podrá convertir libremente un producto físico en material incluido para omitir su precio. Una línea física incluida deberá proceder de una composición reconocida por el servidor. En esta primera versión, la selección actual de un servicio con costo interno generará un material sintético no vinculado a inventario: quedará claramente identificado, conservará el costo para margen y no consumirá stock. Asociar productos físicos reales como componentes del servicio requerirá el futuro editor BOM.

## Cálculo

El resumen utilizará magnitudes separadas:

- `servicesSubtotal`: suma de servicios con la tarifa aplicable.
- `chargedPartsSubtotal`: suma de repuestos cobrados por separado.
- `includedMaterialsInternalCost`: costo interno de materiales incluidos.
- `partsInternalCost`: costo interno de todos los repuestos físicos.
- `referenceSubtotal`: servicios más repuestos cobrados, antes de descuentos.
- `customerTotal`: total confirmado según el modo de precio.
- `estimatedMargin`: total del cliente menos costos internos verificados.

Los materiales incluidos no aumentarán `chargedPartsSubtotal` ni `referenceSubtotal`. Los descuentos continuarán aplicándose según las reglas actuales y nunca modificarán el costo interno.

## Interfaz de Repuestos y Materiales

La sección se dividirá en tres grupos visibles cuando tengan contenido:

1. **Servicios seleccionados**
   - Nombre del servicio.
   - Precio aplicado.
   - Para mayoristas: precio normal tachado y badge `Tarifa mayorista`.
   - Si no hay tarifa especial: aviso `Sin tarifa mayorista configurada`.

2. **Materiales incluidos en servicios**
   - Etiqueta `Incluido en el servicio`.
   - Precio adicional al cliente: `Gs. 0`.
   - Costo interno visible únicamente para roles con permiso financiero o de costos.
   - No se mostrará como mano de obra ni como descuento.

3. **Repuestos cobrados por separado**
   - Precio unitario al cliente, cantidad, subtotal y stock.
   - Costo interno solo para usuarios autorizados.

El encabezado mostrará:

- Servicios.
- Repuestos adicionales.
- Costos internos, solo con permiso.
- Margen estimado, solo con permiso.
- Precio de referencia.

En móvil los indicadores se apilarán, los nombres no se truncarán de manera destructiva y las acciones permanecerán visibles. El total definitivo seguirá en la sección Costos.

## Revisión final

La revisión previa repetirá la misma clasificación y tarifa aplicada. Nunca mostrará un material incluido como un cargo adicional. Si el precio o stock cambió desde la selección, la confirmación se detendrá con un mensaje específico y ofrecerá actualizar la línea.

## Seguridad y permisos

- La condición mayorista se resolverá dentro de la organización activa.
- Los precios y costos de líneas vinculadas al catálogo serán autoritativos del servidor.
- El costo interno y el margen no se mostrarán a roles sin permiso para consultar costos.
- La sucursal se validará antes de consumir inventario.
- La creación seguirá usando la clave idempotente y solo se reproducirán reparaciones completamente guardadas.

## Errores y recuperación

- Precio mayorista modificado: mostrar la tarifa nueva y pedir una nueva confirmación.
- Stock modificado: conservar el formulario, marcar la línea afectada y permitir reintentar.
- Servicio sin tarifa mayorista: usar precio normal con aviso informativo, sin bloquear.
- Artículo fuera de la sucursal: impedir confirmación y solicitar volver a seleccionarlo.
- Migración ausente: responder con error controlado; no degradar silenciosamente a un desglose incorrecto.

## Pruebas

- Cálculo unitario de servicios, incluidos y repuestos cobrados.
- Precio minorista, mayorista configurado y fallback mayorista.
- Material incluido que aporta costo interno pero cero precio adicional.
- Validación de permisos para costo y margen.
- Revalidación del servidor ante precio o stock obsoleto.
- Persistencia y reapertura conservando la clasificación.
- Revisión final sin doble cobro.
- Accesibilidad con `jest-axe` y comportamiento responsive de los tres grupos.
- Regresión de idempotencia en creación concurrente.

## Fuera de alcance

- Editor completo de composiciones o BOM con múltiples productos por servicio.
- Reparto fiscal o contable del ingreso de un servicio entre varias cuentas contables.
- Modificación automática de reparaciones históricas más allá del valor compatible `charged_part`.
