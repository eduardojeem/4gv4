# Técnicos y pagos: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir saldos y desembolsos y centralizar su gestión, conservando la liquidación básica de talleres sin Finanzas.

**Architecture:** Mantener el historial legado e identificar su origen. Incorporar transacciones privilegiadas e idempotentes para sus mutaciones; conectar la navegación a Nómina cuando el plan y los permisos lo permiten. Unificar condiciones de remuneración con vigencias, sin convertir automáticamente pagos históricos en nuevos desembolsos.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Supabase/PostgreSQL.

**Spec:** `docs/technician-payments-integration-design.md`

## Global Constraints

- Preservar los cambios locales existentes en PayrollPanel, PayrollRunDialog y finance/server.
- Mantener el historial de technician_payments como registro legado identificable; no convertirlo automáticamente en nuevos pagos de nómina.
- No bloquear a talleres sin el módulo Finanzas por el solo hecho de cambiar la ubicación de la interfaz.
- No realizar pagos, migraciones remotas ni despliegues durante la implementación local.
- La aprobación de este plan no autoriza operaciones financieras reales.

## Review Focus

- Respuesta perdida: repetir una solicitud no crea un segundo desembolso (tarea 2).
- Cambio de organización durante una carga: no mostrar datos de la anterior (tarea 4).
- Entrega en otro mes: atribuir la comisión al evento configurado (tarea 1).
- Caja cerrada o de otra sucursal: rechazar el pago sin persistir cambios parciales (tarea 2).
- Historial legado sin sucursal determinable: no atribuirlo arbitrariamente ni ofrecer reversión automática (tareas 2 y 4).

## Tarea 1: lecturas monetarias y períodos correctos

**Files:** Modificar `src/lib/technician/earnings-server.ts` y `src/app/api/repairs/technicians/[id]/payments/route.ts`. Crear `src/lib/technician/payment-summary.ts` y `src/test/technician-earnings-payments.test.ts`.

**Interfaces:** `sumDisbursedPayments(payments: ReadonlyArray<{ status: string; amount: number | string }>): number`; conservar la firma de `qualifiesForAccrual` y la respuesta GET existente.

- [ ] Escribir pruebas: pendiente/anulado no reducen saldo; pagado/confirmado sí; terminado en septiembre y entregado en octubre devenga en octubre con modo entregado; fechas inválidas se rechazan.
- [ ] Ejecutar `npx vitest run src/test/technician-earnings-payments.test.ts` y comprobar fallos del comportamiento actual.
- [ ] Implementar suma por estados explícitos, selección de fecha por modo, error de configuración visible y validación de rango. Paginar reparaciones con orden estable, sin ocultar errores de páginas intermedias.
- [ ] Verificar las pruebas y guardar únicamente los archivos de esta tarea en un commit.

## Tarea 2: pagos básicos seguros y reversos

**Files:** Crear `supabase/migrations/20261017120000_technician_payments_atomic.sql`, `src/lib/technician/payments-server.ts` y `src/test/technician-payments-api.test.ts`; modificar las rutas POST y PATCH de pagos.

**Interfaces:** RPC `server_create_technician_payment(p_organization_id uuid, p_branch_id uuid, p_actor_user_id uuid, p_technician_id uuid, p_request_key text, p_input jsonb) returns jsonb`; RPC `server_transition_technician_payment(p_organization_id uuid, p_branch_id uuid, p_actor_user_id uuid, p_technician_id uuid, p_payment_id uuid, p_request_key text, p_action text) returns jsonb`. Ejecución exclusiva service_role, validación de actor y permisos dentro de SQL, search_path fijo y objetos cualificados.

- [ ] Escribir pruebas de repetición, clave reutilizada con otro contenido, confirmación de efectivo, dos anulaciones concurrentes, técnico incorrecto en URL, falta de permisos y caja de otra sucursal.
- [ ] Ejecutar `npx vitest run src/test/technician-payments-api.test.ts` y comprobar fallos.
- [ ] Agregar sucursal y metadatos de solicitud de forma aditiva. Inferir sucursal histórica solamente cuando existe evidencia inequívoca del movimiento de caja; conservar nulos desconocidos. Usar bloqueo de fila y claves únicas por organización; persistir pago y egreso/reverso en una sola transacción. Acuse de recibo no mueve efectivo.
- [ ] Reemplazar escrituras directas por RPC; exigir `x-idempotency-key`, validar sucursal/miembro/actor y devolver errores claros. No habilitar una ruta de nómina completa a planes sin Finanzas.
- [ ] Verificar pruebas, revisar SQL y privilegios, y preparar instrucciones de aplicación y reversión sin ejecutar en remoto. Guardar el incremento.

## Tarea 3: remuneración con vigencias y puente con Nómina

**Files:** Modificar `src/app/api/repairs/technicians/[id]/compensation/route.ts`, `src/lib/technician/earnings-server.ts`; crear `supabase/migrations/20261017130000_technician_compensation_versions.sql` y `src/test/technician-compensation-integration.test.ts`. Revisar cambios puntuales en `src/lib/finance/server.ts` sin sobrescribir su trabajo previo.

**Interfaces:** RPC `server_save_technician_compensation(p_organization_id uuid, p_actor_user_id uuid, p_technician_id uuid, p_request_key text, p_input jsonb) returns jsonb`. Configuración actual compatible; versiones con vigencia y origen técnico identificable para reglas financieras.

- [ ] Probar sueldo + porcentaje + fijo simultáneos, desactivación en cero, fallo de sincronización que revierte todo, vigencias históricas y liquidación cerrada inalterada.
- [ ] Ejecutar `npx vitest run src/test/technician-compensation-integration.test.ts` y comprobar fallos.
- [ ] Sustituir sincronización best effort por transacción. No modificar reglas manuales no relacionadas. Separar componentes porcentaje/fijo, cerrar vigencia anterior y conservar instantáneas de liquidaciones cerradas.
- [ ] Identificar desembolsos legado al reconciliar el período: conservar sus referencias y descontarlos del saldo correspondiente sin volver a pagarlos ni duplicarlos en el resumen financiero. Rechazar reconciliación ambigua en lugar de estimarla.
- [ ] Verificar pruebas de integración y pruebas existentes de nómina; documentar y guardar el incremento.

## Tarea 4: interfaz, permisos y datos confiables

**Files:** Modificar `src/components/dashboard/technicians/detail/TechnicianPaymentsTab.tsx`, `TechnicianCompensationCard.tsx`, `OptimizedTechnicianHeader.tsx`, `src/app/dashboard/repairs/technicians/[id]/page.tsx`, `src/hooks/use-technician-compensation.ts` y `src/hooks/use-technician-stats.ts`. Crear `src/test/technician-payments-ui.test.tsx`; revisar `src/app/admin/finances/page.tsx` y PayrollPanel para usar una navegación existente o agregar un selector explícito de empleado.

**Interfaces:** Conservar props existentes de TechnicianPaymentsTab; añadir capacidad de navegación a Nómina validada por módulo y permisos. Claves de carga incluyen organización, técnico, sucursal y período; petición y clave idempotente permanecen unidas hasta resolver su resultado.

- [ ] Probar plan sin Finanzas con liquidación básica disponible, plan con Finanzas con acceso a Nómina, permisos insuficientes, errores sin ceros falsos y cambio de organización con respuesta antigua.
- [ ] Ejecutar `npx vitest run src/test/technician-payments-ui.test.tsx src/test/technician-panel-views.test.tsx` y comprobar fallos nuevos.
- [ ] Implementar selector de período, Generado/Pagado/Pendiente, estados de error y reintento, tarjetas móviles y botones accesibles. Mantener historial legado identificado. Mostrar información incompleta y no prometer edición cuando el botón solo abre el listado.
- [ ] Verificar pruebas, TypeScript, lint y `git diff --check`; probar navegador autenticado en escritorio/móvil sin operaciones reales. Guardar el incremento.

## Cierre

- [ ] Revisar invariantes financieras y permisos; ejecutar pruebas relacionadas de Nómina, Caja y técnicos, y build cuando los recursos locales lo permitan.
- [ ] Entregar SQL nuevos con orden de aplicación y aclarar qué quedó verificado localmente y qué requiere entorno autenticado/SQL aplicado.
- [ ] No publicar ni registrar migraciones automáticamente.
