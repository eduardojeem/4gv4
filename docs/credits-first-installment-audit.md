# Auditoría de créditos: primer vencimiento y confirmación

## Alcance y comportamiento implementado

Se revisó el código del circuito POS, planes precargados de productos, creación manual de créditos, cuotas, consultas de saldo y comprobante. La revisión no certifica los datos ni las políticas actualmente desplegadas en producción.

- En nuevas ventas, `at_start` es el valor predeterminado: la primera cuota vence el día de inicio; no queda pagada automáticamente.
- `next_cycle` desplaza el calendario 7 días, 15 días o un mes calendario. No cambia capital, interés ni cantidad de cuotas.
- La fecha de negocio es la de `America/Asuncion`. Si cambia mientras el cobro está abierto, el servidor exige reabrirlo y revisar fechas.
- Los planes de producto precargan cantidad, interés y frecuencia. No reemplazan la modalidad de inicio elegida para el ticket. En un carrito mixto sigue existiendo un único crédito por ticket.
- La elección se puede cambiar tanto en condiciones del crédito como en la confirmación. Se muestran las fechas y los importes de todas las cuotas, incluyendo la última ajustada por redondeo.
- La confirmación tiene contenido desplazable y acciones fuera del área de desplazamiento. Los selectores son radios nativos con etiquetas y explicaciones.
- El comprobante prioriza el calendario devuelto por la transacción, no uno recalculado después de vender.
- Las fechas explícitas del endpoint manual se conservan como modalidad personalizada; no se aceptan simultáneamente con una modalidad nueva.
- No se actualiza ningún crédito histórico.

## Hallazgos corregidos

| Hallazgo | Corrección |
| --- | --- |
| Sin fecha explícita, TypeScript y SQL comenzaban en el próximo ciclo | Inicio explícito con predeterminado `at_start` |
| La modalidad no viajaba con el pago simple/mixto | Se transmite, valida y guarda en metadata |
| Reaplicar un plan podía borrar condiciones adicionales | Se conserva el inicio acordado |
| El comprobante recalculaba fechas en lugar de usar las guardadas | Se devuelve y reutiliza el calendario persistido |
| Cuota con vencimiento hoy podía aparecer en mora por la hora | Comparación por día de negocio; queda pendiente hoy |
| Resumen POS sumaba cuotas completas pese a abonos parciales | Usa saldo pendiente y considera abonos en total pagado |
| SQL dividía en centavos mientras PYG se mostraba en enteros | Reparto de capital/interés con decimales de moneda configurada y resto en última cuota |

## Persistencia y seguridad revisadas

POS: `CheckoutContext` → `usePOSSaleProcessor` → `usePOSProducts` → `/api/pos/process-sale` → `process_pos_sale_atomic_v4/v3` → `process_pos_sale_atomic_v2`.

Se conservan autenticación, organización, sucursal, permiso POS, validaciones de cliente, stock y wrappers de idempotencia/transacción existentes. La migración modifica únicamente el bloque de calendario/metadata/redondeo/respuesta del crédito en la función vigente; aborta si no encuentra el código esperado, sin reemplazar ciegamente toda la función.

El endpoint comprueba la disponibilidad del nuevo cálculo SQL antes de vender a crédito. Sin migración o con error de conexión, responde con un error seguro antes de ejecutar la venta. La nueva función de fechas no accede a datos; su ejecución está restringida a `service_role`.

## Riesgos preexistentes pendientes (no equivalen a una auditoría aprobada de todo el sistema)

1. `/api/credits/sale` y `createCreditAccount` insertan cabecera/cuotas en llamadas separadas, con borrado compensatorio. La comprobación de duplicados/cupo no sustituye una transacción con bloqueo y restricción única; revisar concurrencia del crédito manual.
2. `/api/credits` limita cuotas a 1.000 y pagos a 300; los reportes o resúmenes consumidores pueden omitir datos en carteras grandes. Hace falta paginación o agregación de servidor.
3. El cálculo de cupo de `createCreditAccount` incluye deuda de reparaciones; la definición SQL POS revisada calcula deuda por cuotas. Unificar esta regla requiere revisar la función realmente desplegada y acordar el tratamiento de la reparación que se financia para no contarla dos veces.
4. El flujo dedicado de financiación de reparaciones usa su propia RPC. No se modificó ese contrato ni se reprogramaron sus créditos existentes en este cambio de POS.
5. La moneda de redondeo del endpoint POS usa la configuración de servidor (`config.currency`). Si se permiten monedas distintas por organización, debe verificarse su resolución regional antes de ofrecer contratos en varias monedas.

## Despliegue

1. Aplicar `supabase/migrations/20260902010235_credit_first_installment_timing.sql` antes de publicar la aplicación.
2. Si SQL informa que no encuentra un bloque, no eliminar las validaciones: inspeccionar `pg_get_functiondef` de la función desplegada y adaptar la migración.
3. Probar en staging venta simple/mixta, plan precargado, ambas modalidades, reintento, primer día y fin de mes, verificando stock y sumas de cuotas.
4. Los contratos históricos conservan su calendario; no revertir fechas históricas al revertir el código. Para volver al comportamiento anterior en contratos nuevos se debe elegir `next_cycle`.

## Ampliación: cobrar la primera cuota al generar el crédito

- En **Cobrar venta → 3. Revisar y confirmar** aparece **Cobrar primera cuota ahora**, desactivado inicialmente y sincronizado con la confirmación final. Requiere modalidad `at_start`; pasar a `next_cycle` desactiva el cobro.
- La revisión distingue total de venta, entrega inicial, cuota cobrada hoy y saldo del crédito posterior. El cobro incompleto muestra un error y bloquea continuar. En pagos mixtos se ofrece solo después de agregar una parte a crédito. Esta ampliación de interfaz no requiere una migración adicional.
- Se puede pagar por efectivo (recibido y vuelto separados de la entrega inicial) o transferencia (banco/cuenta y referencia obligatorios).
- El monto lo obtiene SQL de la cuota 1 creada; nunca usa un monto de cuota enviado por el navegador. No reduce la base financiada, no modifica las cuotas restantes y no se agrega a `sale_payments` como otra venta.
- Se inserta en `credit_payments`; el trigger existente marca la cuota pagada y completa el crédito si era la única. Si el trigger no confirma el estado esperado se revierte toda la venta.
- Efectivo genera un `cash_in` en la misma caja/sucursal del POS. Transferencia queda en el libro de pagos con banco y referencia; no genera efectivo ni implica conciliación automática con una entidad bancaria.
- La venta y el cobro ocurren en la misma transacción POS. Reintentos no cobran dos veces y el comprobante usa el pago persistido.
- Aplicar después de la migración de fechas: `supabase/migrations/20260902014150_pos_collect_first_installment.sql`. El servidor bloquea esta opción si falta la migración; no se aplicó remotamente.
- Verificación SQL reproducible: `scripts/verify-pos-first-installment.mjs`, con `PGLITE_MODULE` apuntando al `dist/index.js` de una instalación de PGlite en un entorno de pruebas aislado. Prueba efectivo, transferencia, vuelto, importes manipulados, aislamiento, reintento, crédito de una sola cuota y rollback por fallo de caja. No conecta a producción.

## Evidencia y límites

- Pruebas unitarias y de componentes: calendarios, bisiestos, importes, cambio de modalidad, conservación de plan y estado pendiente durante el día.
- Validación final: 10 archivos / 49 pruebas aprobadas, TypeScript global sin errores y ESLint focal sin errores.
- La migración compiló en PostgreSQL embebido (PGlite), se ejecutó dos veces y se probaron cinco calendarios y rechazo de modalidad inválida. Esto no es una prueba de la venta completa con stock/caja real ni una migración de Supabase remoto.
- No se ejecutaron ventas reales ni se aplicó la migración remota. Se requiere validación autenticada en navegador y staging antes del despliegue.
- El navegador disponible redirigió `/dashboard/pos` a `/saas` sin sesión; no se pudo certificar el diseño móvil/escritorio en una sesión real.
