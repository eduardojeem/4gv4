# Sincronización del precio de servicio con la reparación

## Objetivo

Al seleccionar un servicio en el modal de nueva reparación, su precio debe alimentar inmediatamente la calculadora y mostrar un total cobrable coherente. El importe no debe quedar aislado en el campo estimado del equipo ni perderse al guardar.

## Alcance

- Aplica al modal de nueva reparación con un solo equipo.
- Mantiene los tres modos existentes: automático, presupuesto y manual avanzado.
- No cambia las reglas del servidor, permisos administrativos, descuentos, adelantos ni inventario.
- No habilita costos compartidos para formularios con varios equipos.

## Comportamiento aprobado

### Servicio que no incluye repuestos

Al elegirlo con un solo equipo:

1. Se conserva el precio como referencia estimada del equipo.
2. El precio se carga como mano de obra.
3. El modo queda en `automatic`.
4. La calculadora muestra inmediatamente `mano de obra + repuestos - descuento`.
5. Los repuestos agregados después incrementan el total.

### Servicio que incluye repuestos

Al elegirlo con un solo equipo:

1. Se conserva el precio como referencia estimada del equipo.
2. El precio se carga como total acordado.
3. El modo cambia a `budget`.
4. La mano de obra se deriva del total acordado menos los repuestos.
5. Los repuestos agregados después no cambian el total acordado.

### Varios equipos

El servicio solo actualiza el estimado del equipo seleccionado. No alimenta la calculadora compartida porque no existe una asignación inequívoca entre costos y equipos. Las restricciones actuales al guardar permanecen sin cambios.

## Interfaz

- El mensaje posterior a seleccionar un servicio debe explicar si el precio se cargó como mano de obra o como total acordado.
- El total visible de la calculadora debe actualizarse en la misma interacción.
- La entrada de costo final continúa bloqueada en modo automático.
- Para ingresar directamente un total, el usuario utiliza `Usar presupuesto`.
- La etiqueta del costo por equipo debe aclarar que es una referencia del servicio y no una segunda fuente independiente del total.

## Flujo de datos

1. El selector obtiene el precio normal o mayorista del servicio.
2. Actualiza `devices[index].estimatedCost`.
3. Si existe un solo equipo, actualiza además `laborCost` o `finalCost` según `serviceIncludesParts` y sincroniza `pricingMode`.
4. `RepairCostCalculator` deriva y presenta el total.
5. Al enviar, el formulario normaliza los importes con `calculateRepairPricing`.
6. La API vuelve a resolver el precio y persiste `estimated_cost`, `labor_cost`, `final_cost` y `pricing_mode`.

## Validación y pruebas

- Prueba de interacción: un servicio sin repuestos, seleccionado en el modo automático predeterminado, carga la mano de obra y muestra su precio como total.
- Prueba de interacción: un servicio que incluye repuestos cambia a presupuesto y mantiene el precio como total acordado.
- Prueba de seguridad: con varios equipos, seleccionar un servicio no carga costos en la calculadora compartida.
- Verificación enfocada del formulario y de `RepairCostCalculator`, seguida de TypeScript, ESLint y revisión del diff.

## Criterios de aceptación

- El caso reportado ya no deja el total en cero.
- El total visible coincide con los valores enviados al servidor.
- Seleccionar un servicio nunca requiere cambiar previamente a modo manual.
- No se mezclan costos entre equipos.
- Las reglas de autorización y auditoría existentes siguen vigentes.
