# Diseño: productos con financiación en el POS

## Objetivo

Permitir que el personal de ventas encuentre productos con planes de cuotas precargados, compare sus condiciones, consulte información financiera precisa y use un plan como configuración inicial de una venta a crédito, sin modificar la operación atómica existente para venta, stock, caja y financiación.

## Alcance

La mejora se integra en el POS actual. No crea una ruta ni un catálogo paralelo y no requiere una migración de base de datos. Reutiliza los campos existentes de `products`:

- `installments_enabled`
- `installments_public`
- `installments_plans`, con opciones `{ count, rate }`

`installments_public` seguirá controlando la tienda pública. En el POS interno, un producto será financiable cuando `installments_enabled` sea verdadero y tenga al menos un plan válido, independientemente de la visibilidad pública del plan.

## Contrato de datos

El endpoint de productos ya entrega la configuración de cuotas. Se ampliarán `PosProductRow`, el mapeador del POS y el tipo unificado para conservarla durante todo el flujo.

Un plan válido tendrá:

- cantidad entera entre 1 y 60 cuotas;
- tasa numérica entre 0 y 100;
- frecuencia mensual, porque la configuración actual del producto no guarda otra frecuencia.

Los registros inválidos serán ignorados para visualización y ordenamiento. No se corregirán silenciosamente ni se enviarán al checkout.

Se incorporará una utilidad pura de financiación de productos que:

- normalice planes;
- calcule cuota, interés y total mediante `buildCreditInstallmentPlan`;
- determine el plan destacado, usando primero la mayor cantidad de cuotas y luego la menor tasa;
- exponga valores consistentes para tarjetas, filtros y ficha detallada.

## Catálogo, filtros y ordenamiento

La barra actual conservará búsqueda, categoría, destacados, precio y stock. Se agregará un filtro rápido `Con cuotas`, acompañado por la cantidad de productos financiables.

Los filtros avanzados incorporarán:

- cantidad mínima de cuotas;
- orden por cuota mensual más baja;
- orden por menor tasa;
- orden por mayor cantidad de cuotas;
- orden por menor total financiado.

Los nuevos criterios se combinarán con los existentes. Cambiar cualquier filtro restablecerá la paginación a la primera página. Los filtros activos tendrán chips removibles y formarán parte del contador y del restablecimiento general.

Las preferencias persistidas aceptarán los valores nuevos sin invalidar preferencias anteriores.

## Tarjeta de producto

Los productos financiables mostrarán una señal compacta sin desplazar precio, stock ni acción de agregar:

- insignia `Hasta N cuotas`;
- monto `Desde Gs. X/mes`;
- etiqueta `Sin interés` o `Tasa Y%`.

El monto se calculará con el precio efectivo mostrado en el POS, respetando el modo minorista o mayorista. El cálculo es informativo hasta que el vendedor elija un plan.

La tarjeta seguirá agregando el producto al carrito con su interacción actual. La selección de un plan se hará desde la ficha detallada para evitar activar crédito accidentalmente.

## Ficha detallada

La ficha mostrará una sección destacada `Opciones de financiación` debajo de precios y antes de la cantidad. Cada plan mostrará:

- cantidad de cuotas mensuales;
- monto por cuota;
- tasa;
- interés total;
- total financiado.

Un resumen de requisitos se calculará en tiempo real:

- cliente seleccionado;
- línea de crédito activa;
- crédito disponible suficiente para el total financiado;
- stock suficiente para la cantidad seleccionada;
- caja abierta.

La ficha diferenciará requisitos cumplidos y pendientes con icono y texto, no solamente con color. La información seguirá siendo visible aunque el cliente todavía no cumpla los requisitos.

Cada plan tendrá la acción `Usar este plan`. Esta acción agregará la cantidad elegida al carrito y precargará en el contexto del checkout:

- cantidad de cuotas;
- tasa de interés;
- frecuencia mensual;
- referencia informativa al producto que originó la sugerencia.

La acción no procesará la venta ni seleccionará crédito de manera irreversible. El vendedor deberá abrir el checkout, elegir crédito y confirmar.

## Integración con el checkout

El sistema actual admite una sola configuración de crédito por venta. Por eso el plan elegido se aplicará al saldo financiado de todo el ticket.

Cuando exista una sugerencia de producto, el panel de crédito mostrará su origen y una advertencia clara: `Estas condiciones se aplican al total financiado del ticket`.

El vendedor podrá modificar cuotas o tasa antes de confirmar. Una modificación manual dejará de presentarse como el plan exacto del producto, pero conservará los valores elegidos.

Agregar productos adicionales no generará créditos separados. Quitar del carrito el producto que originó la sugerencia limpiará solamente la referencia de origen; los términos quedarán disponibles como edición manual para no borrar trabajo del vendedor de forma sorpresiva.

## Reglas financieras y de seguridad

- Todos los cálculos visuales usarán `buildCreditInstallmentPlan`.
- La API seguirá validando tasa, cantidad y frecuencia.
- La capacidad de crédito se comprobará contra el total financiado, no solo contra el precio de contado.
- La venta seguirá enviándose por `/api/pos/process-sale` y su RPC atómico.
- El stock se descontará una sola vez después de validar la operación completa.
- La idempotencia existente se conservará.
- El catálogo y las configuraciones se mantendrán bajo el alcance de organización y sucursal existente.
- No se confiará en importes calculados únicamente en el navegador para persistencia.

## Estados y errores

- Sin productos financiables: estado vacío específico y opción de limpiar filtros.
- Plan inválido: no se muestra ni se puede seleccionar.
- Cliente sin crédito: se muestra el plan, pero el requisito queda pendiente y el checkout ofrece el flujo existente para habilitar crédito.
- Crédito insuficiente: se informa disponible y requerido; no se confirma la venta.
- Sin stock o caja cerrada: se conserva la visualización, pero se bloquea la acción correspondiente.
- Error al cargar productos: se mantiene el tratamiento de error actual del POS.

## Accesibilidad y responsive

- El filtro rápido será un botón con `aria-pressed`.
- Todos los criterios tendrán etiquetas accesibles.
- Las tarjetas anunciarán cuota y tasa en su nombre accesible.
- La ficha permitirá recorrer planes y requisitos con teclado.
- En móvil, filtros financieros estarán dentro del panel desplegable existente.
- La ficha usará una sola columna en móvil y limitará su altura con desplazamiento interno.
- Se verificarán 320, 768, 1024 y 1440 píxeles.

## Pruebas

### Unitarias

- normalización de planes válidos e inválidos;
- cálculo de cuota, interés y total;
- elección del plan destacado;
- filtros combinados y ordenamientos financieros;
- precio minorista y mayorista.

### Componentes

- tarjeta con y sin financiación;
- ficha con todos los planes;
- requisitos cumplidos y pendientes;
- acción `Usar este plan` y precarga del contexto;
- chips, contador y limpieza de filtros.

### Integración y regresión

- el mapper conserva la configuración recibida por la API;
- una venta de contado continúa sin `p_credit`;
- una venta a crédito usa los términos elegidos;
- los cálculos coinciden entre ficha, checkout y comprobante;
- stock, idempotencia, pago mixto y saldo a favor no cambian.

### Navegador

- búsqueda y filtro `Con cuotas`;
- ordenamientos;
- apertura de ficha y selección de plan;
- checkout con plan precargado;
- navegación por teclado, consola limpia y comportamiento responsive.

## Documentación operativa

Se actualizará la guía contextual del POS con:

- cómo identificar productos financiables;
- cómo comparar planes;
- cómo usar un plan;
- por qué el plan se aplica al ticket completo;
- requisitos para autorizar crédito;
- qué revisar antes de confirmar.

## Fuera de alcance

- múltiples créditos con términos distintos dentro de una misma venta;
- financiación por unidad o por línea de ticket;
- nuevas frecuencias configurables por producto;
- nuevos campos manuales de requisitos;
- cambios en cobranza de cuotas ya emitidas;
- migraciones SQL o despliegue remoto.
