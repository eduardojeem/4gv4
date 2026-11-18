# Detalle de productos según rubro

Alcance autorizado: detalle del producto en POS y ficha `/dashboard/products/[id]`. Bloque compartido de lectura; sin cambios en tienda pública ni aplicación nativa.

## Comportamiento

- Rubro desde `SubscriptionStatusContext.businessVertical`, como el formulario. Los rubros desconocidos conservan la presentación general.
- Características guardadas en variantes con etiquetas por rubro y personalizadas. Excluye variantes inactivas; la selección del POS muestra sus propios atributos.
- Marca, compatibilidad, garantía y políticas solo si están cargadas. No completa valores con ejemplos.
- Consulta el GET existente de lotes: autenticación, permiso `products.read` y módulo `inventory`, sin ampliar acceso ni escribir datos.
- Fecha y estado por lote, código y cantidad restante estimada. Excluye descartados y agotados. Al elegir una variante mantiene los lotes sin asignación con una aclaración.
- Información de toda la empresa, no saldo exacto de una sucursal. No afirma trazabilidad por unidad vendida ni bloquea ventas por estimaciones; solicita verificar el lote físico.
- Servicios (`unit_measure=servicio`) no consultan lotes. Distingue datos no cargados, función no disponible y error; permite reintentar y actualizar.
- Solicitudes cancelables vinculadas al usuario/empresa/producto evitan respuestas obsoletas. Fechas de calendario sin conversión de zona horaria.

## Verificación

Pruebas enfocadas: atributos, variantes, errores, fechas inválidas, cambio de ámbito y lotes. Chrome con fixtures: seis rubros en la sección compartida y cosmética en el modal POS, 375/1280 px y temas claro/oscuro (28 escenarios). No se probó la página completa con sesión real ni datos de producción.

No requiere migración nueva. Si la funcionalidad existente de lotes no está disponible, se informa expresamente. No se aplicaron migraciones, seeds ni cambios remotos.
