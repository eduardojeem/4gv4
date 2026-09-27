# POS, cobro de reparaciones y comprobantes: diseño integral

**Fecha:** 2026-09-24  
**Estado:** Diseño aprobado; pendiente de plan de implementación  
**Alcance:** `/dashboard/pos`, cobro de reparaciones, modal `Cobrar venta`, comprobante interno y transacción asociada.

## Objetivo

Unificar y simplificar el cobro de ventas normales, a crédito, mixtas y con reparaciones, preservando atomicidad, idempotencia, trazabilidad y aislamiento por organización/sucursal.

## Decisiones aprobadas

- Una reparación con saldo puede cobrarse aunque no esté lista, pero no entregarse.
- `Cobrar y entregar` exige que todas las reparaciones estén listas y con control técnico aprobado.
- En crédito o mixto, la reparación queda pagada y la deuda financiada pasa a la cuenta corriente del cliente.
- El historial financiero de la reparación registra el cobro y queda vinculado a la venta.
- IVA y desglose fiscal se ocultan en el POS y comprobante interno mientras no exista un modo fiscal explícito.
- La implementación se hará por etapas verificables.

## Reglas financieras

- El servidor recalcula siempre costo, pagos previos y saldo.
- Una reparación con saldo cero se muestra como `Sin saldo pendiente` y no puede agregarse.
- Agregar una reparación significa cobrarla, no entregarla automáticamente; la entrega empieza desactivada.
- UI y servidor aplican la misma elegibilidad. Un control deshabilitado nunca conserva un `true` oculto.
- La operación atómica valida usuario, organización, sucursal, caja, cliente, reparaciones y control técnico; crea venta/líneas, pagos, crédito, caja e historial de reparación; actualiza estados; y confirma o revierte todo junto.
- Venta y registros derivados comparten idempotencia.
- En mixto se conserva el desglose inmediato/financiado. Para varias líneas, la asignación será determinista y nunca superará pagos ni saldos.
- Antes de migrar se inventariarán `repair_payments`, `process_pos_sale_atomic_*`, restricciones, RLS y consumidores para extender el contrato canónico, no crear contabilidad paralela.

## Reparaciones en el POS

- Búsqueda paginada del servidor por ticket, identificador, cliente, teléfono, marca, modelo o equipo.
- Todas las consultas usan API autenticada y contexto explícito de organización/sucursal; se elimina el fallback directo a Supabase desde el navegador.
- Carga, vacío y error son estados distintos; el error permite reintentar sin perder carrito ni filtros.
- Cada resultado muestra ticket/equipo, cliente, estado, saldo y si puede cobrarse/entregarse.
- Las pagadas pueden verse, pero quedan deshabilitadas; saldo cero nunca se reemplaza por costo total.
- Al seleccionar una reparación se selecciona su cliente. Un carrito de otro cliente exige resolver el conflicto.
- Toda reparación seleccionada usa un modelo normalizado visible en carrito, checkout y comprobante.

## Experiencia general del POS

- Escritorio tiene un solo CTA de cobro en el carrito; móvil una sola barra inferior; F4 permanece.
- Todas las entradas comparten `canCheckout` y explican el bloqueo.
- El encabezado enfoca/expande el carrito canónico en escritorio; en móvil abre una hoja editable.
- Con caja cerrada se puede preparar el carrito, pero no confirmar. Un aviso persistente ofrece abrir caja.
- Antes del checkout se ve cliente, crédito relevante, descuento y acciones cambiar/quitar.
- Búsqueda, categoría y cuotas quedan visibles; filtros avanzados van a panel compacto con chips activos.
- En móvil: texto secundario 11–12 px, principal 13–14 px, objetivos táctiles 40–44 px y menos columnas cuando corresponda.
- Productos sin stock no son accionables. La carga usa esqueletos y el reintento no reinicia estado.
- Interacciones usan elementos semánticos, nombres accesibles, foco correcto y anuncios de cambios/errores.

## Modal `Cobrar venta`

Jerarquía: resumen compacto de cliente y total; modalidad; campos necesarios; resumen final y confirmación. No se usan pasos numerados artificiales.

- Validación inmediata de importes.
- Vuelto solo si el efectivo supera el importe exigible inmediato; nunca en crédito total.
- No mostrar porcentaje financiado en el comprobante.
- Eliminar valores sueltos, incluido el `0` debajo de `Crédito registrado`.
- Con reparaciones, el CTA distingue `Cobrar sin entregar` de `Cobrar y entregar`.
- Todo bloqueo incluye una explicación textual.

## Comprobante

- El comprobante actual es interno: no muestra IVA, base imponible ni desglose tributario. Una futura modalidad fiscal requerirá una bandera/contrato explícito.
- Normal: total, medios abonados y vuelto solo si corresponde.
- Crédito: entrega inicial si existe, monto financiado, cuotas y primer vencimiento; sin vuelto ni porcentaje financiado.
- Mixto: pagos inmediatos y saldo financiado, sin repetir totales.
- `Detalle de productos` usa tipografía menor pero legible y filas compactas.
- `Total con financiación` es compacto, adaptable y no desborda el papel ni supera visualmente al total de venta.
- Datos técnicos de reparación solo cuando ayudan a identificarla.

## Arquitectura

Extracción progresiva, sin reescritura total, hacia `POSWorkspace`, `POSSearchToolbar`, `POSCatalog`, `POSCustomerSummary`, `POSCartPanel`, `POSMobileCartSheet`, `POSMobileCheckoutBar` y hooks de elegibilidad/reparaciones/normalización. Cada extracción mantiene o aumenta cobertura y separa cambios visuales de cambios financieros.

## Etapas

1. **Contratos y seguridad:** pruebas de regresión, inventario de esquema/RPC, asignaciones, migración y validaciones tenant/sucursal/cliente/QC.
2. **Reparaciones:** búsqueda paginada, eliminación del fallback, modelo normalizado, cliente y separación cobro/entrega.
3. **Modal y comprobante:** jerarquía compacta, vuelto/crédito, valor `0`, regla fiscal y densidad visual.
4. **POS y estructura:** CTA, caja, cliente, filtros, móvil, accesibilidad y extracción de componentes.

## Criterios de aceptación

1. Una reparación no lista se cobra sin entregarse.
2. Una reparación no lista o sin QC no puede cobrarse y entregarse.
3. Una pagada muestra saldo cero y no puede agregarse.
4. Normal, crédito y mixto dejan venta, caja/crédito e historial coherentes.
5. Reintentar con igual clave no duplica registros.
6. No se consultan ni cobran reparaciones de otra organización/sucursal.
7. Modal y comprobante omiten valores, vuelto y porcentaje cuando no corresponden.
8. IVA no aparece en POS ni comprobante interno.
9. Productos y financiación no desbordan anchos de impresión soportados.
10. Desaparecen CTAs duplicados y todos usan el mismo `canCheckout`.
11. Se documentan por separado pruebas enfocadas, lint, TypeScript, `git diff --check` y navegador real.
12. Validación local, migración remota y prueba autenticada se reportan sin confundirlas.

## Fuera de alcance

- Facturación electrónica o afirmar validez fiscal del comprobante interno.
- Rediseñar contabilidad ajena al POS/reparaciones.
- Cambiar tasas, cuotas, intereses o límites de crédito no relacionados.
- Limpiar errores globales o cambios ajenos existentes.
