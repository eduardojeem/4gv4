# Catálogo público: precio efectivo, ofertas y variantes

## Objetivo y alcance

El cliente debe ver resultados consistentes al buscar, filtrar ofertas, ordenar por precio y abrir un producto. El usuario aprobó mostrar «Desde…» con el menor precio de las variantes disponibles cuando sus precios difieren. Se conserva el diseño de portada recuperado, la búsqueda paginada y las mejoras móviles.

Este cambio modifica la consulta del catálogo. No cambia precios guardados, inventario, ventas, planes ni condiciones comerciales de promociones. No incluye publicación en producción ni ejecución de SQL remoto.

## Evidencia actual

- `getMarketplaceProductsPageUncached` filtra stock del producto padre y pagina antes de cargar variantes y calcular promociones automáticas.
- `applyAutomaticPromotionToProduct` elige entre una oferta manual válida y promociones automáticas porcentuales activas, dirigidas a productos o categorías. No acumula descuentos.
- Una columna generada basada en `sale_price` y `offer_price` no representa promociones automáticas ni precios de variantes.
- El cálculo por variantes existe en un consumidor de tienda, pero no se aplica uniformemente al catálogo global.

## Diseño elegido

Una consulta de lectura en PostgreSQL calculará disponibilidad y precio efectivo antes del filtro de ofertas, del orden, del total y de la paginación. El servidor Next seguirá validando filtros y construyendo únicamente la respuesta pública. No se descargará el catálogo completo al navegador ni se ordenará solo la página visible.

La consulta será invocada exclusivamente desde el servidor con rol de servicio. Usará `SECURITY INVOKER`, acceso revocado a PUBLIC/anon/authenticated y concesión explícita al rol de servicio. La propia consulta limitará productos a organizaciones con tienda y marketplace públicos y suscripciones elegibles según las reglas existentes; un identificador recibido no podrá ampliar esa elegibilidad.

No se expondrá una vista privilegiada ni se trasladará la clave de servicio al cliente. Se conservarán las restricciones de producto activo, visibilidad pública y organización de cada promoción/variante.

### Disponibilidad

- Producto simple: stock positivo del producto.
- Producto con variantes: únicamente variantes activas con stock positivo; sumar esas cantidades, sin utilizar stock padre como respaldo si no hay variantes disponibles.
- Excluir variantes inactivas o agotadas del mínimo de precio.
- Un producto sin disponibilidad no aparece en los resultados disponibles.
- Estas reglas se reutilizan para productos, ofertas y los conteos/facetas del catálogo; no se arreglan únicamente las tarjetas.

### Precio y ofertas

- Para cada opción comprable, calcular su precio base y precio efectivo aplicando las mismas reglas actuales de oferta/promoción.
- El precio base de una variante es su propio `sale_price`. Conservar el contrato existente de `resolvePublicVariantPrice`: una oferta válida propia de la variante tiene precedencia; de lo contrario se aplica proporcionalmente la oferta efectiva del padre y se redondea al entero monetario, sin aceptar resultados no positivos o que no reduzcan el precio. No cambiar las reglas mayoristas del detalle o del cobro; el marketplace usa el precio minorista público.
- Elegir el mejor descuento válido, sin acumular oferta manual y promoción automática. Mantener el redondeo monetario actual y las condiciones actuales de fechas, actividad, límite de usos y alcance.
- No convertir cupones, descuentos fijos ni promociones condicionadas al total del carrito en descuentos garantizados de tarjeta.
- Precio mostrado: mínimo efectivo de las opciones disponibles. Mostrar «Desde…» solamente si esas opciones tienen precios efectivos distintos; con precio único mostrar el importe normal.
- La oferta tachada y el porcentaje corresponden a la misma variante que origina el precio mínimo. No comparar mínimos de variantes diferentes.
- En filtro «Solo ofertas», admitir el producto si alguna opción disponible tiene descuento. El resumen de ese resultado se obtiene de las opciones con descuento; el modal sigue permitiendo consultar todas las variantes y su precio propio.
- Precio oculto: mantener «Consultar precio». No enviar el mínimo oculto como campo público adicional. Colocar estos productos al final de los órdenes por precio, con desempate independiente del importe oculto.

### Contrato de lectura

Entradas: búsqueda, categoría/subcategoría resueltas, marca, solo ofertas, orden, límite y desplazamiento validados. Salida: identificadores ordenados de productos, total del conjunto filtrado y resumen público de disponibilidad/precio/oferta. La hidratación posterior no puede volver a cambiar el precio utilizado para ordenar.

Orden estable con identificador como último desempate para evitar saltos entre páginas. El total y las filas se calculan sobre el mismo conjunto y momento de referencia para promociones. Las facetas de marca corresponden a todo el conjunto aplicable, no solo a la página visible.

`/marketplace/productos` y `/marketplace/buscar` leerán `ofertas=1`, conservarán filtros en la URL y usarán la misma consulta. Portada/ofertas y tarjetas/modal consumirán el mismo resumen y distinguirán precio de resumen de precio de variante seleccionada.

Un error de consulta o una migración ausente produce estado de error recuperable, no «sin productos» ni una sustitución silenciosa por el orden incorrecto anterior.

## Alternativas descartadas

1. Ordenar en JavaScript después de paginar: deja resultados globalmente incorrectos.
2. Descargar todas las filas y calcularlas en Next: aumenta transferencia y memoria, y depende de límites de respuesta.
3. Columna generada de precio manual: útil para ofertas simples, insuficiente para variantes y promociones con vigencia dinámica.

## Verificación y aceptación

Pruebas de equivalencia SQL/TypeScript para ofertas manuales, promociones porcentuales, redondeo, empates, fechas y límites de usos. Fixtures con más resultados que una página.

Casos obligatorios: padre agotado con variante disponible; padre con stock pero variantes agotadas; variantes inactivas; precios iguales/distintos; promoción vencida; oferta en una variante no mínima; precio oculto; mezcla de organizaciones privadas/públicas; error de consulta; página fuera de rango.

Pruebas de rutas para filtros, total, orden y navegación atrás. Pruebas de tarjetas/modal para «Desde…» y selección. Revisión móvil/escritorio, lint, TypeScript y build. Validación local del SQL y permisos antes de entregar migración; migración remota y despliegue se confirman por separado.

## Entrega

Generar la migración con la CLI, conservando cualquier SQL previo del usuario. Entregar la lista exacta de archivos SQL necesarios y su orden. No pedir ejecutar una migración incompleta ni marcarla aplicada mediante repair sin comprobar su contenido. Mantener separado el cambio visual existente y no modificar trabajo ajeno.
