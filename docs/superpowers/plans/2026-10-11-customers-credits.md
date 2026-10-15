# Clientes y Créditos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Cobros sin duplicados y cifras completas, con una presentación clara en Clientes y Créditos.

**Architecture:** Conservar endpoints y pantallas actuales. Un contrato común delega cobros en una transacción SQL privilegiada e idempotente; resúmenes completos de servidor quedan separados de las filas paginadas. El navegador muestra resultados persistidos, no saldos proyectados.

**Tech Stack:** Next.js, React, TypeScript, Zod, Supabase PostgreSQL, Vitest y pruebas SQL locales.

**Spec:** `docs/superpowers/specs/2026-10-11-customers-credits-design.md`

## Global Constraints

- No cambiar precios, planes, permisos comerciales ni decisiones de crédito de clientes reales.
- No aplicar SQL remoto, reparar historial, publicar ni mezclar ramas en este alcance.
- No hacer cobros ni subir documentos privados reales para probar.
- Migraciones aditivas, creadas con la CLI. Entregar rutas exactas al usuario.
- SQL nuevo ejecutable solamente por service_role; actor explícito validado en servidor y base.
- Toda una solicitud de cobro se confirma o se revierte; no presentar resultados parciales como éxito.
- Los puntos de fidelidad no bloquean cobros y se deduplican por pago persistido.
- Conservar funciones anteriores hasta inventariar sus consumidores. No recurrir a ellas si falta el esquema nuevo.
- Preservar trabajo ajeno y borradores; verificar el estado Git antes de cada bloque.

## Review Focus

- Conexión perdida tras confirmar: reintentar la misma clave devuelve el mismo recibo (tareas 1–3).
- Dos usuarios cobrando el mismo saldo: bloquear, releer y rechazar reparto incompatible sin escrituras parciales (tarea 1).
- Cambio de organización con consultas pendientes: no mostrar cifras ni búsquedas de la anterior (tareas 4–5).
- Pago durante el día de vencimiento en distinta zona del navegador: clasificar por calendario de organización (tarea 5).
- Excedente y fallo al registrar caja: revertir todo, incluyendo saldo a favor (tarea 1).

## Estructura y dependencias

1 → 2 → 3: contrato SQL, integración API y consumidores de cobro.
4: resumen completo y paginación; 5: validez, fechas y búsqueda; 6: diseño y verificación final.
Ejecutar nativamente en esta sesión, sin nuevos agentes de implementación. Cada tarea
incluye regresión que falla antes de corregir, verificación después y commit focalizado.

### Task 1: Transacción y contrato de cobro

**Archivos:** crear `src/lib/credits/collection-contract.ts`, `src/lib/credits/collection-rpc.ts`, `src/lib/credits/collection-rpc.test.ts`, `supabase/tests/customer_collection_atomic.test.sql`; crear migración con `npx supabase migration new customer_collection_atomic` tras consultar `--help`. Revisar `src/lib/customers/collect-payment.ts`, `src/lib/repairs/financial-closure-rpc.ts` y las funciones correspondientes del baseline.

**Interfaces:** `CollectionRequest` extiende datos financieros de `CollectPaymentRequest` con selección de cuota/crédito; actor y organización NO son campos aceptados del navegador. `CollectionResult` contiene `receiptId`, `receiptNumber`, `appliedAmount`, `excessToStoreCredit`, `allocations` (debtId, type, paymentId, appliedAmount, remainingBalance) y `recordedAt`.
`collectCustomerPayment(admin, { organizationId, customerId, actorId, branchId, request }): Promise<CollectionResult>` llama `collect_customer_payment_atomic(p_organization_id uuid,p_customer_id uuid,p_actor_id uuid,p_branch_id uuid,p_request jsonb) returns jsonb`.

- [ ] Escribir pruebas del contrato: monto inválido rechazado; actor suministrado en payload no admitido; respuesta inválida no se utiliza como recibo.
- [ ] Ejecutar `npx vitest run src/lib/credits/collection-rpc.test.ts`; comprobar fallo por contrato ausente, no por entorno.
- [ ] Inventariar consumidores y reglas de funciones existentes. Implementar contrato y wrapper; adaptar internamente cobro de cuotas a actor explícito, sin falsificar JWT. Reutilizar cierre financiero de reparación solamente después de verificar su validación y compatibilidad con transacción envolvente.
- [ ] Crear registro de solicitudes con organización, clave única, huella canónica del contenido y resultado persistido, RLS y revocaciones. Bloquear cliente, deudas y caja en orden estable; comprobar organización, permiso y sucursal en base.
- [ ] Implementar reparto bajo bloqueo y operación única de pagos, estados, caja y excedente confirmado. Nunca confiar en saldos enviados por navegador. Conflicto antes de cualquier confirmación; rollback ante fallo posterior. No deduplicar por monto/fecha, sino por clave de solicitud.
- [ ] Escribir SQL local con fixtures aislados: dos cuotas, deuda mixta, misma clave/contenido (mismo recibo y un pago), clave/contenido distinto (conflicto), tenant equivocado, actor sin permiso, caja cerrada, concurrencia y fallo intermedio (ningún pago/excedente/caja persistido).
- [ ] Ejecutar pruebas Vitest y `npx supabase test db --local` tras comprobar ayuda y disponibilidad del entorno. Si no existe base local, registrar bloqueo: no sustituir pruebas transaccionales por mocks ni ejecutar fixtures en producción.
- [ ] Revisar diff y guardar commit focalizado del contrato, migración y pruebas.

### Task 2: APIs consistentes y puntos deduplicados

**Archivos:** `src/app/api/credits/route.ts`, `src/app/api/customers/[id]/collect-payment/route.ts`, `src/test/customer-collect-payment-route.test.ts`, `src/app/api/credits/tenant-isolation.test.ts`, `src/lib/loyalty/credit-points.ts` y sus pruebas.

**Interfaces:** consumir `collectCustomerPayment` y `CollectionResult` de tarea 1. Los endpoints conservan formato compatible de éxito, añaden resultado persistido y aceptan clave de solicitud. Conflicto → 409; esquema ausente → 503 con mensaje de migración; permisos → 403. GET actual no se altera en esta tarea.

- [ ] Añadir regresiones: API no efectúa escrituras independientes ni bucles RPC por deuda; devuelve importe aplicado real; rechaza clave alterada; no acepta actor ajeno ni cliente de otra organización.
- [ ] Ejecutar `npx vitest run src/test/customer-collect-payment-route.test.ts src/app/api/credits/tenant-isolation.test.ts`; comprobar los fallos nuevos.
- [ ] Sustituir mutaciones por una llamada transaccional con actor de sesión y sucursal validada. Eliminar compensación de excedente y respuesta 207 del nuevo camino. Conservar comprobaciones de módulo existentes, sin ampliar permisos.
- [ ] Acreditar puntos usando identificadores de pagos persistidos y fuente estable. Mismo resultado repetido no duplica puntos; fallo de fidelidad no cambia éxito del pago. Agregar prueba de reintento tras fallo de fidelidad.
- [ ] Ejecutar pruebas focalizadas, revisar contrato/error seguro y guardar commit.

### Task 3: Modales y comprobantes de resultado real

**Archivos:** `src/hooks/use-credits.ts`, `src/app/dashboard/credits/page.tsx`, `src/components/dashboard/credits/CreditPaymentDialog.tsx`, `src/components/dashboard/customers/CustomerGlobalPaymentModal.tsx`, `src/lib/credits/payment-receipt.ts`; crear `src/test/customer-collection-ui.test.tsx`.

**Interfaces:** un intento guarda payload inmutable y clave hasta obtener `CollectionResult`; nuevo intento solo tras resolución. Los callbacks devuelven resultado persistido en vez de sumar importes en navegador.

- [ ] Escribir pruebas de pérdida de respuesta: reintento manda misma clave/payload; no habilita un cobro diferente con clave incierta. Cuotas múltiples generan una sola petición; recibo usa `appliedAmount` y saldos del resultado, nunca monto solicitado o proyección.
- [ ] Ejecutar `npx vitest run src/test/customer-collection-ui.test.tsx src/lib/credits/payment-receipt.test.ts` y comprobar fallos de regresión.
- [ ] Eliminar bucle de cobros del navegador. Mostrar reparto antes de confirmar, bloquear cambios durante resultado incierto y permitir reintentar/consultar el mismo intento. Un cierre y reapertura no debe perder un intento incierto: mantener registro temporal de intento, sin almacenar documentos privados ni credenciales.
- [ ] Unificar mensajes de fallo/reintento y generación de recibos. Mantener impresión y compartir, ahora con identificador y cifras persistidas. No emitir comprobante de una solicitud no confirmada.
- [ ] Verificar pruebas y guardar commit.

### Task 4: Resumen completo separado de filas

**Archivos:** `src/app/api/credits/route.ts`, `src/app/api/credits/batch/route.ts`, `src/hooks/use-credits.ts`, `src/app/dashboard/credits/page.tsx`, `src/components/dashboard/credits/CreditOverview.tsx`, `src/components/dashboard/credits/CreditExportModal.tsx`; crear `src/lib/credits/portfolio-contract.ts` y `src/test/credit-portfolio-completeness.test.ts`; crear migración con CLI para lectura agregada/paginada.

**Interfaces:** `CreditPortfolioResponse` separa `globalSummary`, `filteredSummary`, `pagination` y `rows`. Resumen: outstanding, overdue, paid, distinctCustomers, installmentCounts. Filtros se validan en servidor y nunca eliminan tenant scope. Mantener adaptador para consumidores actuales hasta migrarlos.

- [ ] Pruebas con más de 1.000 cuotas y clientes homónimos: importe completo e identidades únicas; cambiar filtro no cambia total global; página no cambia resumen filtrado; anulado no aparece como deuda activa.
- [ ] Ejecutar `npx vitest run src/test/credit-portfolio-completeness.test.ts`, comprobar fallo antes de corrección.
- [ ] Implementar agregación SQL sobre todo el universo autorizado y paginación de filas. Saldo pendiente de cartera activa excluye cancelados/completados; totales de histórico se presentan aparte. Batch devuelve resúmenes completos por cliente en lugar de inferirlos de pagos recientes.
- [ ] Sustituir reducers globales sobre muestra. Exportaciones recorren páginas autorizadas bajo alcance/filtros declarados; no exportar últimos 300 pagos como historial completo. Si cambian datos durante exportación, indicar instante de extracción y evitar duplicados por ID.
- [ ] Verificar pruebas y aislamiento; guardar commit.

### Task 5: Datos válidos, calendario y búsqueda privada

**Archivos:** `src/hooks/use-customer-credits.ts`, `src/components/dashboard/customers/CustomerCreditInfo.tsx`, `src/components/dashboard/customers/ImprovedSearchBar.tsx`, `src/lib/date-only.ts`; crear `src/lib/credits/calendar.ts`, `src/lib/credits/calendar.test.ts`, `src/lib/customers/search-history.ts`, `src/lib/customers/search-history.test.ts`, `src/test/customer-credit-data-validity.test.tsx`.

**Interfaces:** `paymentCalendarStatus(paidAt:string,dueDate:string,timeZone:string): 'on_time'|'late'`; `creditSummary` es null mientras falta deuda válida; sin historial `payment_score` es null. Próximo pago admite `due_date: null`. `searchHistoryKey(organizationId:string,userId:string):string` y validación de array de términos.

- [ ] Pruebas: GET fallido oculta cupo y evaluación; respuesta vieja no repone datos al cambiar tenant; sin historial no muestra 100/100; deuda sin fecha no muestra hoy.
- [ ] Calendario: pago el mismo día en zona de organización es a tiempo aunque navegador esté en otra zona; siguiente día es tarde. Resolver zona desde configuración real de organización y documentar fallback existente, no inventar un nuevo ajuste global.
- [ ] Historial: distintas organizaciones/usuarios nunca comparten términos; JSON inválido y almacenamiento no disponible no rompen búsqueda; no importar clave global antigua.
- [ ] Ejecutar `npx vitest run src/lib/credits/calendar.test.ts src/lib/customers/search-history.test.ts src/test/customer-credit-data-validity.test.tsx`; comprobar fallos.
- [ ] Implementar interfaces y migrar sus consumidores. Mostrar «Sin vencimiento definido» y «Sin historial suficiente». Evaluación muestra Bajo/Medio/Alto/Crítico con aviso orientativo, sin Confiable/Restringir/Bloqueado. Alinear ayudas de búsqueda con nombre, teléfono, documento y campos realmente consultados.
- [ ] Verificar pruebas y guardar commit.

### Task 6: Jerarquía visual y entrega

**Archivos:** `src/components/dashboard/customers/CustomerDetail.tsx`, `src/components/dashboard/customers/CustomerCreditInfo.tsx`, `src/components/dashboard/credits/CreditList.tsx`, `src/app/dashboard/credits/page.tsx` y ambos modales. Actualizar `docs/customer-credit-file.md` sin afirmar migración remota aplicada; crear `docs/customer-credit-collection.md` para SQL y funcionamiento.

- [ ] Regresiones de interfaz: cuatro conceptos distintos (deuda total, vencida, cupo y saldo a favor), identidad de homónimos, etiquetas de alcance, estados vacíos/errores; acceso a historial y ficha documental permanece.
- [ ] Ejecutar tests UI nuevos antes de cambiar layout; implementar Vencidas/Vencen hoy/Próximas como accesos principales y conservar navegación completa. Acciones Cobrar/Editar/Ficha según permisos existentes, sin restar saldo a favor automáticamente.
- [ ] Ajustar modales con altura dinámica, scroll interior y acciones legibles; inputs móviles ≥16px y blancos táctiles ≥44px. Preservar borradores al cambiar pestaña.
- [ ] Ejecutar pruebas afectadas, `npx tsc --noEmit`, ESLint sobre archivos cambiados y `git diff --check`. No repetir suite global sin cambios que lo justifiquen.
- [ ] Validar lectura y diseño autenticado a 320/768/1024/1440 px sin mutaciones reales; registrar si no hay sesión. Revisión final del diff financiero, permisos, límites de datos y pruebas SQL.
- [ ] Entregar SQL exactos en orden, requisitos y resultados comprobados. No publicar. Solo afirmar transacciones verificadas si pasaron pruebas de base local.
- [ ] Guardar commit final focalizado; informar pendientes y guía de uso.
