# Diseño de Finanzas para administración del negocio

Fecha: 2026-08-11
Estado: aprobado en conversación; pendiente de revisión final del documento

## Objetivo

Crear `/admin/finances` como centro financiero multiempresa y multisucursal. Debe permitir administrar gastos, obligaciones recurrentes, nómina de todo el personal, comisiones y pagos, y producir resultados financieros explicables. `/admin/reports` conservará el análisis operativo y consumirá las cifras financieras oficiales.

El sistema distinguirá utilidad devengada de flujo de caja. Nunca presentará como ganancia neta una cifra que omita obligaciones conocidas. Cuando falten costos o asignaciones, mostrará el resultado como incompleto e identificará los datos faltantes.

## Alcance funcional

### Resumen ejecutivo

- Filtros globales por período y sucursal, incluida la vista consolidada de la organización.
- Indicadores de ingresos, costo directo, ganancia bruta, gastos operativos, nómina, ganancia neta devengada, flujo de caja, obligaciones pendientes y vencidas.
- Comparación contra el período anterior.
- Próximos vencimientos y alertas de margen negativo, obligaciones vencidas y nóminas pendientes.
- Desglose explicable de cada total hasta sus movimientos de origen.

### Gastos y obligaciones

- Gastos únicos y recurrentes.
- Categorías iniciales: alquiler, electricidad/ANDE, agua/ESSAP, internet, telefonía, impuestos y tasas, proveedores y compras, marketing, mantenimiento, transporte, software y suscripciones, comisiones bancarias y otros.
- Categorías personalizables por organización.
- Campos: organización, sucursal, categoría, concepto, importe, proveedor opcional, fecha contable, vencimiento, estado, recurrencia, medio de pago, comprobante y notas.
- Estados: borrador, pendiente, parcialmente pagado, pagado, vencido y anulado.
- Pagos completos o parciales mediante Caja de sucursal, Banco/transferencia u Otro.
- Los registros pagados no se eliminan. Una anulación requiere motivo y genera la compensación correspondiente.

### Recurrencias y avisos

- Frecuencias configurables, al menos mensual, semanal, trimestral y anual.
- Cada recurrencia genera automáticamente una obligación pendiente para su período.
- Una clave única de organización, recurrencia y período impide duplicados.
- Se puede pausar, reanudar, modificar hacia adelante o finalizar una recurrencia sin alterar obligaciones históricas.
- La anticipación del aviso es configurable. Los avisos distinguen próximo a vencer y vencido.

### Nómina para todo el personal

- Incluye administradores, vendedores, cajeros, técnicos y otros roles.
- Configuración por empleado: sueldo base mensual, vigencia, sucursal principal, asignaciones adicionales y estado laboral.
- Conceptos: sueldo base, comisiones, bonificaciones, descuentos, adelantos y ajustes.
- Liquidación preliminar por empleado y período, revisión administrativa, aprobación y pago completo o parcial.
- Una liquidación aprobada queda bloqueada. Las correcciones posteriores se registran como ajustes auditables.
- Los adelantos pendientes se descuentan automáticamente de la liquidación aplicable.

### Comisiones

- Reglas generales por rol, sucursal y tipo de operación.
- Excepciones individuales con prioridad sobre las reglas generales.
- Vigencia por fechas para preservar cálculos históricos.
- Modalidades de porcentaje o monto fijo.
- Orígenes admitidos: venta completada, producto o categoría, reparación cobrada, mano de obra de reparación y meta alcanzada.
- Cada comisión conserva el vínculo con la venta, reparación o meta de origen.
- Una operación cancelada, anulada o reembolsada no genera comisión definitiva; si ya fue liquidada, produce un ajuste compensatorio.

### Rentabilidad

- Rentabilidad por venta, reparación, producto, categoría, empleado, técnico y sucursal.
- Comparación entre sucursales sin perder la vista consolidada.
- Separación explícita entre ingresos, costos directos, gastos operativos y nómina.

## Definiciones financieras

- **Ingresos devengados:** ventas completadas más reparaciones cobradas o reconocidas según su estado financiero válido.
- **Costos directos:** costo de adquisición de unidades vendidas más repuestos efectivamente utilizados.
- **Ganancia bruta:** ingresos devengados menos costos directos.
- **Gastos operativos:** obligaciones de gasto atribuibles al período, estén pagadas o pendientes.
- **Costo de nómina:** sueldo base, comisiones, bonificaciones y ajustes, menos descuentos, atribuibles al período.
- **Ganancia neta devengada:** ganancia bruta menos gastos operativos y costo de nómina.
- **Flujo de caja:** cobros efectivamente recibidos menos pagos efectivamente realizados durante el período.

Las cifras monetarias usarán la moneda configurada por la organización y conservarán precisión decimal en almacenamiento. El redondeo se aplicará solamente en presentación o según la regla explícita del pago.

## Arquitectura y límites

La solución se divide en unidades con responsabilidades independientes:

1. **Catálogo financiero:** categorías, medios y reglas configurables.
2. **Obligaciones:** gastos, recurrencias, vencimientos y estados.
3. **Pagos:** aplicación completa o parcial y vínculo atómico con caja.
4. **Nómina:** compensación, liquidaciones, conceptos y adelantos.
5. **Comisiones:** resolución de reglas y materialización auditable por operación.
6. **Libro analítico:** proyecciones de rentabilidad y flujo de caja a partir de fuentes canónicas.
7. **Presentación:** las cinco áreas Resumen, Gastos, Nómina, Rentabilidad y Configuración.

La interfaz no calculará cifras contables a partir de consultas dispersas. Consumirá contratos de servicio tipados que devuelvan importes, cobertura de datos y desglose de origen.

## Modelo de datos conceptual

- `finance_categories`: categorías personalizables y su tipo.
- `finance_expense_templates`: definición de gastos recurrentes.
- `finance_obligations`: gastos generados o cargados manualmente.
- `finance_payments`: pagos parciales o completos y su medio.
- `employee_compensation`: sueldo y condiciones vigentes por empleado.
- `commission_rules`: reglas generales y excepciones individuales.
- `earned_commissions`: comisiones calculadas con referencia al origen.
- `payroll_runs`: cabecera de liquidación por período y sucursal.
- `payroll_entries`: liquidación por empleado.
- `payroll_adjustments`: bonos, descuentos, adelantos y correcciones.
- `finance_audit_events`: historial inmutable de acciones financieras.

Todas las entidades pertenecen a una organización. Las que afectan operación pertenecen además a una sucursal o declaran explícitamente que son compartidas y usan una regla documentada de distribución. Las claves foráneas y restricciones impedirán aplicar pagos entre organizaciones o sucursales incompatibles.

## Flujo de pago

1. El administrador abre una obligación o liquidación aprobada.
2. Indica importe, fecha, medio de pago y referencia.
3. Si elige Caja, selecciona una sesión o caja válida de la sucursal.
4. El servidor valida permisos, saldo/estado de caja y saldo pendiente.
5. En una única transacción registra el pago, crea el movimiento de caja y actualiza el saldo de la obligación.
6. Si cualquier paso falla, no se marca el registro como pagado.

Banco/transferencia y Otro registran el pago sin movimiento de caja, conservando referencia y comprobante.

## Permisos, aislamiento y auditoría

- El acceso exige pertenencia activa a la organización y un permiso financiero explícito.
- Lectura de cifras, edición, aprobación de nómina, pagos, anulaciones y configuración son permisos separados.
- La base de datos aplica aislamiento por organización y, cuando corresponda, por sucursal.
- Las operaciones sensibles se ejecutan en servidor y vuelven a validar el contexto; no confían en identificadores enviados por el cliente.
- Cada creación, modificación, aprobación, pago y anulación registra actor, fecha, entidad, valores anteriores y nuevos.
- Los comprobantes se guardan en almacenamiento privado con tipo, tamaño y autorización validados.

## Automatización

Un proceso programado seguro genera obligaciones recurrentes y avisos. Debe ser idempotente, tolerar reintentos y registrar cada ejecución. La interfaz también podrá solicitar una generación controlada para recuperar períodos omitidos sin duplicarlos.

## Integración con el sistema existente

- Reutilizar ventas completadas, items de venta y costos de producto como fuentes canónicas.
- Reutilizar reparaciones válidas, repuestos y cobros como fuentes canónicas del taller.
- Integrar pagos de nómina técnica existentes mediante migración o adaptador, sin contabilizarlos dos veces.
- Vincular pagos desde Caja con `cash_movements` mediante una operación atómica e identificador único de origen.
- Incorporar Finanzas a la navegación administrativa.
- Sustituir en `/admin/reports` la ganancia estimada por resultados del servicio financiero; inventario, clientes y métricas operativas permanecen allí.

## Estados vacíos y errores

- Sin datos: explicar qué debe registrarse y ofrecer la acción correspondiente.
- Cobertura incompleta: mostrar el porcentaje o lista de operaciones sin costo, sucursal o empleado asignado.
- Error parcial: conservar los datos válidos, identificar la sección afectada y permitir reintento.
- Conflicto de concurrencia: rechazar el segundo pago o aprobación y refrescar el saldo vigente.
- No se mostrarán ceros engañosos cuando la fuente requerida no esté disponible.

## Interfaz y accesibilidad

- Diseño seleccionado: tablero ejecutivo primero.
- Navegación secundaria: Resumen, Gastos, Nómina, Rentabilidad y Configuración.
- Filtros globales persistentes por período y sucursal.
- Tablas adaptables con vistas compactas en móvil y detalles accesibles.
- Estados, alertas y tendencias no dependerán exclusivamente del color.
- Formularios con etiquetas, errores asociados, orden de foco y operación por teclado.

## Exportaciones

- Exportación por período y sucursal de gastos, pagos, liquidaciones, comisiones y estado de resultados.
- Los archivos incluyen filtros, fecha de generación y moneda.
- Los totales exportados deben coincidir con la vista y conservar el desglose suficiente para auditoría.

## Estrategia de validación

- Pruebas unitarias de fórmulas, prorrateos, precedencia de comisiones, recurrencias y redondeo.
- Pruebas de integración para pagos parciales, pago desde Caja, reintentos idempotentes, anulaciones y concurrencia.
- Pruebas de permisos y aislamiento entre organizaciones y sucursales.
- Pruebas de migración para nómina técnica existente y prevención de doble contabilización.
- Pruebas de componentes para filtros, formularios, estados vacíos y cobertura incompleta.
- Validación en navegador de escritorio y móvil, accesibilidad, consola y red.

## Secuencia de implementación

1. Base financiera, permisos y migraciones.
2. Gastos, recurrencias, vencimientos, avisos y pagos.
3. Nómina completa, reglas de comisión, excepciones y liquidaciones.
4. Servicio de resultados devengados y flujo de caja.
5. Interfaz `/admin/finances` con sus cinco áreas.
6. Integración con `/admin/reports`, navegación, exportaciones y alertas.
7. Validación integral y corrección de hallazgos.

## Criterios de aceptación

- Un administrador autorizado puede registrar y pagar un gasto único o recurrente por cualquier medio permitido.
- Una ejecución repetida de recurrencias no crea obligaciones duplicadas.
- El sistema avisa antes del vencimiento y distingue obligaciones vencidas.
- Se puede liquidar a cualquier empleado con sueldo, comisión y ajustes trazables.
- Las reglas generales admiten excepciones individuales sin alterar períodos cerrados.
- Un pago desde Caja es atómico y aparece una sola vez en el flujo de caja.
- La ganancia neta devengada y el flujo de caja muestran valores distintos cuando existen obligaciones pendientes.
- Se puede explicar cada cifra hasta sus fuentes.
- Los filtros por sucursal no exponen ni mezclan datos de otra organización.
- `/admin/reports` deja de presentar la estimación incompleta como ganancia neta.
- La interfaz es utilizable en móvil y escritorio sin errores críticos de consola o red.
