# Diseño: productos y variantes adaptados al rubro

Fecha: 2026-08-29

## Objetivo

Adaptar el alta y edición de productos al rubro de cada organización y completar el soporte de variantes vendibles con precios, códigos y stock independientes. La solución debe reutilizar el sistema existente, conservar la compatibilidad con productos simples e integrar variantes con POS, sucursales, movimientos, devoluciones y auditoría.

## Alcance

La primera entrega funcional incluirá:

- campos recomendados según `organizations.business_vertical`;
- atributos personalizados por producto;
- productos simples y productos con variantes;
- generación y edición de combinaciones;
- SKU, código de barras, costo, precio minorista, precio mayorista y stock por variante;
- stock de variantes por sucursal;
- selección obligatoria de variante en POS;
- descuento y restitución atómica de stock;
- presentación de la variante en carrito, venta y comprobante;
- validaciones, auditoría y compatibilidad con productos existentes.

La trazabilidad por lote, vencimiento, número de serie e IMEI se diseñará como una capa independiente. No se modelará como un atributo comercial común ni se incluirá en la primera entrega funcional.

## Principios

1. `business_vertical` recomienda la interfaz, pero no restringe los atributos que una organización puede utilizar.
2. Un producto sin variantes conserva el flujo actual y su stock general.
3. Una variante representa una combinación vendible y tiene identidad, precio y stock propios.
4. Los datos históricos nunca se eliminan al desactivar una variante o un módulo.
5. Organización, plan, módulo, permisos de usuario y sucursal continúan siendo controles independientes.
6. El stock se modifica únicamente mediante operaciones atómicas y auditables.

## Perfiles de atributos por rubro

El cliente resolverá un perfil de presentación a partir de `business_vertical`:

| Rubro | Atributos sugeridos |
| --- | --- |
| Cosméticos | Línea, tono, volumen, tipo de piel, presentación |
| Ropa y moda | Talle, color, género, material, temporada |
| Electrónica | Modelo, capacidad, color, garantía, compatibilidad |
| Ferretería | Medida, material, calibre, unidad de venta |
| Alimentos | Presentación, contenido neto, conservación |
| Comercio general u otro | Atributos personalizados |

Los perfiles definen etiquetas, ejemplos, orden y tipo de control. Los atributos finalmente seleccionados se guardan con el producto para que un cambio posterior de rubro no altere productos existentes.

## Modelo de datos

### Producto principal

`products` seguirá siendo la entidad de catálogo. Se agregará una marca explícita `has_variants` y una configuración de atributos seleccionados. Los productos simples continuarán utilizando sus columnas actuales de precios y stock.

Cuando `has_variants = true`:

- el producto principal agrupa las variantes;
- sus precios funcionan como referencia o valor predeterminado;
- su stock visible se deriva de las variantes de la sucursal consultada;
- no se permitirá vender el producto sin indicar una variante activa.

### Definiciones de atributos

Se incorporará una estructura tenant-aware para definir atributos reutilizables. Cada definición tendrá:

- organización propietaria;
- clave estable y nombre visible;
- tipo de control (`text`, `number`, `select`, `color`);
- opciones configurables y ordenadas;
- estado activo;
- indicación de atributo estándar o personalizado.

Las opciones pueden incluir texto de presentación y color hexadecimal, sin depender de estos valores para la identidad interna.

### Variantes

Se ampliará la tabla existente `product_variants` en vez de crear un sistema paralelo. Cada variante tendrá:

- organización y producto;
- nombre descriptivo;
- valores estructurados de atributos;
- SKU y código de barras;
- costo, precio minorista y precio mayorista;
- mínimo de stock;
- estado activo;
- timestamps y datos de auditoría.

Las restricciones garantizarán unicidad de SKU y código dentro de la organización, no globalmente entre tenants. Las filas antiguas se normalizarán sin perder `variant_name`, `price_adjustment` ni `stock_quantity`.

### Stock por sucursal

Una tabla de inventario de variantes relacionará `branch_id`, `product_id` y `variant_id`, con cantidad disponible y mínimos configurables. La suma de variantes activas será el stock agregado mostrado para el producto.

El stock global heredado del producto no se distribuirá automáticamente entre variantes. Al activar variantes por primera vez, el usuario deberá asignarlo o confirmar que las variantes comienzan en cero para evitar inventar existencias.

### Auditoría

Las altas, ediciones, desactivaciones y cambios de precio o stock registrarán organización, usuario, sucursal, entidad, valores anteriores, valores nuevos y fecha. Se reutilizará el mecanismo de auditoría tenant-aware existente cuando sea compatible.

## Formulario de producto

El modal conservará sus secciones actuales e incorporará una sección visible denominada "Características y variantes".

### Producto simple

Será la opción predeterminada para compatibilidad. Mostrará los campos comunes actuales y los atributos descriptivos sugeridos por rubro. Mantendrá un precio y stock general.

### Producto con variantes

Al activar variantes, el usuario podrá:

1. seleccionar atributos sugeridos o crear atributos personalizados;
2. agregar opciones, por ejemplo Negro/Blanco y S/M/L;
3. generar el producto cartesiano de combinaciones;
4. excluir combinaciones que no comercializa;
5. editar SKU, código, costo, precios, mínimo y stock de cada combinación;
6. revisar un resumen antes de guardar.

La tabla de combinaciones será responsiva: tabla editable en escritorio y tarjetas compactas por variante en móvil. Las acciones de generación nunca reemplazarán silenciosamente valores ya editados.

### Validaciones

Se validará en tiempo real:

- al menos un atributo y una combinación para productos con variantes;
- opciones no vacías ni duplicadas dentro de un atributo;
- combinaciones únicas;
- SKU y códigos sin duplicados dentro de la organización;
- precios y costos no negativos;
- precio mayorista coherente;
- stock entero no negativo;
- existencia de una variante activa;
- confirmación explícita al convertir un producto simple con stock o historial en producto con variantes.

Una variante con ventas o movimientos no podrá eliminarse físicamente desde la interfaz; se desactivará.

## API y transacciones

Los contratos de productos aceptarán una colección opcional de variantes. La creación o edición del producto, sus atributos, variantes y stock inicial se realizará en una operación transaccional del servidor. Si falla una parte, no se conservará un producto parcialmente configurado.

Los endpoints de variantes existentes se normalizarán para utilizar:

- autenticación tenant-aware;
- filtro obligatorio por organización;
- permisos de productos/inventario;
- alcance de sucursal validado;
- esquemas Zod compartidos;
- errores estables y contextualizados.

Las operaciones de stock usarán funciones SQL atómicas. Una actualización condicionada impedirá que dos cajas vendan simultáneamente la última unidad.

## Integración con POS

Al seleccionar un producto con variantes, el POS abrirá un selector antes de agregarlo al carrito. El selector mostrará únicamente variantes activas y su disponibilidad en la sucursal actual.

Cada línea del carrito conservará:

- `product_id`;
- `variant_id` cuando corresponda;
- nombre del producto y descripción de variante;
- precio aplicado;
- tipo de precio minorista o mayorista;
- cantidad.

La confirmación de venta volverá a validar estado, precio permitido y stock. El servidor descontará la variante concreta. Devoluciones y anulaciones restaurarán esa misma variante y sucursal. El comprobante incluirá nombre, atributos, SKU o código y cantidad.

Los productos simples continuarán por el flujo actual sin selector adicional.

## Inventario, búsqueda y reportes

El inventario permitirá expandir un producto para consultar sus variantes, filtrar por atributo, buscar por SKU/código de variante y realizar ajustes sobre una combinación específica.

Las alertas podrán señalar una variante concreta con stock bajo. Los reportes mantendrán totales por producto y permitirán desglose por variante. Las exportaciones tendrán una fila por combinación; las importaciones validarán producto, atributos y variante antes de modificar datos.

## Trazabilidad posterior

Lotes, vencimientos, números de serie e IMEI requieren identidad y ciclo de vida propios. Una fase posterior incorporará unidades o lotes asociados a producto, variante, sucursal y movimientos. Esto permitirá reservas, venta individual, garantía y alertas de vencimiento sin sobrecargar los atributos comerciales.

## Migración y compatibilidad

La migración será aditiva y seguirá estos pasos:

1. ampliar el esquema existente sin eliminar columnas antiguas;
2. agregar organización y restricciones tenant-aware;
3. convertir filas antiguas a la nueva representación conservando sus valores;
4. mantener vistas o compatibilidad temporal para consumidores antiguos;
5. activar el nuevo flujo detrás de contratos verificados;
6. retirar compatibilidad antigua únicamente después de comprobar que no existen consumidores.

`has_variants` será falso para productos existentes. No se modificarán precios ni stock actuales. La activación de variantes será explícita.

## Seguridad

- RLS validará pertenencia mediante el producto y la organización.
- Las APIs no confiarán en `organization_id`, `branch_id`, precios ni stock enviados por el cliente.
- Los permisos de lectura de costos se aplicarán también a variantes.
- Los códigos y atributos se validarán y normalizarán antes de persistir.
- Las operaciones de inventario serán idempotentes cuando provengan de ventas, devoluciones o anulaciones.
- Ninguna interfaz sustituirá los controles del servidor.

## Manejo de errores

Los errores distinguirán validación, duplicados, falta de permiso, módulo inactivo, sucursal inválida, stock insuficiente, conflicto concurrente y fallo inesperado. El modal conservará los datos ingresados cuando el servidor rechace el guardado y enfocará la primera sección con error.

Si una venta pierde disponibilidad entre selección y confirmación, el POS mantendrá el carrito, marcará la variante afectada y solicitará elegir otra combinación o ajustar cantidad.

## Pruebas y criterios de aceptación

### Datos y API

- aislamiento entre organizaciones;
- aislamiento y stock por sucursal;
- unicidad tenant-aware de SKU y código;
- creación y edición transaccional;
- migración de variantes antiguas;
- rechazo de stock negativo y concurrencia sobre la última unidad;
- preservación de variantes con historial.

### Formulario

- campos recomendados para cada rubro;
- atributos personalizados;
- generación de combinaciones sin duplicados;
- conservación de ediciones al regenerar;
- producto simple sin regresiones;
- resumen y errores contextuales;
- uso a 320, 768, 1024 y 1440 píxeles.

### POS e inventario

- selección obligatoria de variante;
- precio minorista y mayorista correctos;
- venta, devolución y anulación sobre la misma combinación;
- comprobante con atributos;
- búsqueda por SKU y código de variante;
- alertas y reportes agregados y desglosados.

La funcionalidad se considerará completa cuando los flujos de producto simple y con variantes funcionen de extremo a extremo, las pruebas focalizadas y TypeScript pasen, la migración sea reversible mediante una estrategia documentada y las limitaciones de validación manual estén explícitas.

## Despliegue y reversión

El despliegue se realizará en etapas: esquema aditivo, APIs compatibles, formulario, inventario, POS y finalmente reportes/importación. Antes de habilitar cada consumidor se comprobará compatibilidad con datos anteriores.

La reversión deshabilitará la interfaz nueva y devolverá los consumidores al producto simple sin borrar tablas ni variantes creadas. Las migraciones no eliminarán datos como mecanismo de rollback.

