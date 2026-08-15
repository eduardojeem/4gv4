# Edición rápida del precio de una reparación

## Objetivo

Permitir que un usuario autorizado cambie el precio de una reparación desde su modal de detalle, sin abrir el formulario completo, conservando las reglas financieras y de permisos existentes.

## Alcance

- Agregar una acción `Editar precio` en el bloque financiero de `RepairDetailDialog`.
- Abrir un modal compacto que muestre precio actual, total pagado y saldo resultante.
- Permitir seleccionar el modo de cálculo ya soportado: automático, presupuesto o manual.
- Editar precio final, mano de obra, descuento y motivo únicamente cuando correspondan al modo elegido.
- Guardar mediante el flujo `updateRepair` y el endpoint `PATCH /api/repairs/[id]`; no escribir directamente en Supabase desde el componente.
- Actualizar el detalle y su resumen financiero inmediatamente después de guardar.

Quedan fuera de este incremento la migración remota, la transacción unificada de crédito y reparación, y la incorporación de reparaciones a reportes generales de ventas.

## Experiencia de usuario

La acción se ubicará junto al resumen de costos, con el texto `Editar precio`. El modal distinguirá `Precio al cliente` de `Costo de repuestos` para evitar confundir ingreso con costo interno.

Antes de confirmar se verá:

- total pagado;
- nuevo precio al cliente;
- saldo pendiente resultante;
- una advertencia cuando ya existen pagos.

Mientras se guarda, el botón quedará deshabilitado. Los errores del endpoint se mostrarán dentro del modal y mediante la notificación usada por el módulo. Al guardar correctamente, el modal se cerrará y el detalle mostrará los valores nuevos sin requerir recargar la página.

## Arquitectura y datos

Se creará un componente enfocado, `RepairQuickPriceDialog`, sin duplicar el formulario completo. Recibirá la reparación actual, estado de apertura y una función `onSave`.

`RepairDetailDialog` solo administrará la apertura y mostrará la acción. La página de reparaciones conectará `onSave` con `updateRepair`, que ya mantiene el alcance de organización y sucursal. El servidor seguirá calculando y validando el precio con `resolveRepairPricingWrite`; el cliente será una ayuda de entrada y vista previa, no la autoridad financiera.

Después de guardar, la reparación devuelta por el servidor reemplazará el objeto activo del detalle. Así, total, pagado y pendiente permanecerán consistentes con la respuesta persistida.

## Reglas y seguridad

- Nunca aceptar un precio inferior al monto ya pagado.
- El modo manual continúa restringido a owner, admin o super_admin por el servidor.
- Presupuesto no puede quedar por debajo del precio de los repuestos.
- Un descuento exige motivo válido.
- No permitir edición rápida en reparaciones canceladas.
- Una reparación entregada podrá ajustarse solo si el endpoint existente lo autoriza; el modal no eludirá reglas de estado.
- No introducir escrituras directas con el cliente Supabase ni confiar en cálculos del navegador.

## Pruebas

Se agregarán pruebas de interacción que demuestren:

1. La acción abre el modal desde el detalle.
2. Se muestran total pagado y saldo resultante.
3. El cliente bloquea un precio inferior a lo ya pagado.
4. Guardar envía el modo y los importes correctos.
5. Un éxito actualiza el detalle y cierra el modal.
6. Un error conserva el modal y presenta el mensaje.
7. La reparación cancelada no ofrece la acción.

La verificación incluirá las pruebas enfocadas de reparaciones, TypeScript, ESLint sobre los archivos modificados y `git diff --check`. Si el entorno dev está disponible, se verificará también el recorrido real en navegador.

