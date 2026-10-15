# Técnicos: integración de liquidaciones y pagos

## Objetivo

Conservar el perfil operativo del técnico y centralizar los desembolsos en Finanzas/Nómina, sin perder pagos históricos ni registrar dos veces una misma remuneración. No realizar pagos, migraciones remotas ni despliegues durante la implementación local.

## Alcance y preservación

- Preservar los cambios locales existentes en PayrollPanel, PayrollRunDialog y finance/server.
- Mantener el historial de technician_payments como registro legado identificable; no convertirlo automáticamente en nuevos pagos de nómina.
- No bloquear a talleres sin el módulo Finanzas por el solo hecho de cambiar la ubicación de la interfaz.
- Respetar organización, sucursal, permisos financieros y acceso del técnico únicamente a su información.

## Primera etapa: corrección de lecturas

- Contar como desembolsados solamente pagos realizados o confirmados, nunca pendientes o anulados.
- Separar generado, pagado y pendiente; identificar el período y la fuente de cada importe.
- Usar delivered_at para devengo al entregar. Para devengo al terminar, usar completed_at; definir compatibilidad explícita para registros históricos sin esa fecha.
- Mostrar errores y datos incompletos, sin representarlos como cero ni como historial vacío.
- Aislar cargas y cachés por organización, sucursal, técnico y período; ignorar respuestas obsoletas.

## Segunda etapa: un único circuito financiero

- El perfil muestra resumen y acceso a la liquidación; Finanzas concentra aprobación, anticipos, pagos parciales, comprobantes y reversos.
- Las mutaciones deben validar permisos y sucursal y ejecutarse transaccionalmente con el movimiento de caja correspondiente.
- Exigir claves de idempotencia; proteger transiciones de estado frente a solicitudes concurrentes.
- Un pago en efectivo requiere la caja válida de la sucursal, o debe rechazarse con explicación. No marcarlo pagado si falla su egreso.
- Conservar el origen legado y reconciliarlo antes de incorporarlo a una liquidación nueva. No sumar un mismo desembolso como pago legado y como pago de nómina.
- El acuse del técnico se distingue de la aprobación administrativa y no mueve dinero.

## Configuración de remuneración

- Soportar sueldo, porcentaje e importe fijo simultáneamente con una definición compartida.
- Poner un componente en cero debe desactivarlo explícitamente en el circuito correspondiente.
- Conservar vigencias de reglas y condiciones históricas; no sobrescribir condiciones anteriores ni recalcular liquidaciones cerradas con reglas nuevas.
- Los fallos de sincronización deben ser visibles y no devolver un éxito engañoso.

## Diseño

- Perfil: trabajos activos, historial, análisis identificado como estimado y resumen de remuneración.
- Selector de período y tarjetas Generado / Pagado / Pendiente.
- En móvil, historial financiero en tarjetas legibles y acciones con tamaño táctil adecuado.
- Corregir la navegación de Editar perfil para no prometer una edición que solo abre el listado.

## Decisión necesaria antes de integrar

Para planes sin Finanzas, la recomendación es conservar una liquidación básica de técnicos con los mismos permisos, validaciones e invariantes transaccionales, sin habilitar el módulo financiero completo. La ubicación del botón no determina los permisos. La alternativa es exigir Finanzas para pagar, lo cual cambia una funcionalidad existente y requiere aceptación explícita.

## Verificación y entrega

- Pruebas de regresión previas a las correcciones: pendientes, fechas entre meses, sucursales, errores, concurrencia e idempotencia.
- Pruebas de remuneración combinada, desactivación en cero y conservación histórica.
- Verificar acceso por organización y plan, navegación y diseño móvil; no efectuar cobros o pagos reales para probar.
- Entregar los SQL nuevos para ejecución del usuario, si la integración requiere cambios de esquema.
- Informar separadamente pruebas locales, validación autenticada, migraciones y publicación.
