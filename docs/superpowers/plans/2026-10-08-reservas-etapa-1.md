# Reservas: profesionales y disponibilidad — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Execution method awaits user selection; do not delegate automatically.

**Goal:** Entregar configuración de profesionales, tarifas y disponibilidad con reserva pública y cobro que respetan lo acordado.

**Architecture:** Ampliación aditiva de la agenda existente. Helpers puros resuelven tarifas y horarios; funciones transaccionales validan y guardan reservas/bloqueos. El cliente recibe una cotización verificable, no decide el precio.

**Tech Stack:** Next.js App Router, React, TypeScript, Zod, Supabase/PostgreSQL, Vitest y componentes UI existentes.

**Spec:** `docs/superpowers/specs/2026-10-08-reservas-servicios-design.md` (etapa 1; etapas 2 y 3 excluidas de este plan).

## Global Constraints

- Las migraciones se preparan en el repositorio; las aplica el usuario.
- No cambiar precios ni límites de los planes.
- Configuración exige `settings.manage` y `services`; operaciones mantienen sus permisos actuales.
- `professional_selection`: `disabled`, `optional`, `required`; valor inicial `optional`.
- `null` hereda el servicio; cero es un precio válido, no un fallback.
- Los turnos antiguos tienen margen cero. No recalcular reservas históricas.
- Conservar límites de solicitudes, validación y protección anti-spam existentes.
- Preservar todos los cambios locales ajenos a esta etapa; no publicar ni modificar la base remota.

## Review Focus

- Todos los profesionales ocultos no equivale a «no hay profesionales»: no crear una agenda única pública accidentalmente (tareas 2 y 4).
- Tarifa superior al catálogo debe cobrarse sin descuento negativo ni modificación del producto (tarea 6).
- Dos clientes y un bloqueo concurrente no pueden ocupar el mismo recurso (tarea 3).
- Peticiones repetidas o respuestas perdidas no deben crear dos citas; misma clave con distinto contenido debe rechazarse (tareas 3 y 4).
- Precio oculto no debe filtrarse en cotización, URL, token decodificable ni horarios (tarea 4).

## Modelo e interfaces compartidas

- `ProfessionalSelection = 'disabled' | 'optional' | 'required'` en `src/lib/agenda/booking-policy.ts`.
- `ServiceTerms = { price: number; durationMinutes: number; bufferMinutes: number }`; `resolveServiceTerms(base: ServiceTerms, override: Partial<ServiceTerms> | null): ServiceTerms` conserva cero y reemplaza solo valores no nulos.
- `ProfessionalAvailability = { id: string | null; openingHours: OpeningHours | null; online: boolean; terms: ServiceTerms }`.
- `QuotedSlot = { professionalId: string | null; startsAt: string; endsAt: string; occupiedUntil: string; terms: ServiceTerms }`; `quotedSlotsFor(input: AvailabilityInput): QuotedSlot[]`, con `AvailabilityInput` compuesto por fecha, zona, horario general, paso, anticipación, hora actual, profesionales elegibles y bloques ocupados. Deduplicar tramos superpuestos y ordenar por inicio/sort_order/id.
- Cotización persistida: `agenda_booking_quotes`, UUID aleatorio, expiración 10 minutos, organización, asignación, snapshot de términos y revisión de configuración. Solo acceso privilegiado desde servidor; ningún precio privado dentro de tokens públicos.
- RPC `reserve_agenda_quote(p_quote_id uuid, p_idempotency_key uuid, p_customer jsonb)` retorna ID/token/estado y resultado de validación. Ejecutable solo por `service_role`; comprueba oferta vigente, política, horario, referencias y locks en transacción.
- RPC `save_agenda_time_off(...)` y `reschedule_agenda_appointment(...)` comparten locks y validaciones; para operación interna el servidor verifica sesión, permiso y actor explícito antes de llamar.
- Snapshot: `appointments` conserva precio/fin de atención existentes y añade `buffer_minutes`, `occupied_until` y metadatos de cotización. No usar fin ocupado como fin de servicio visible.

## Task 1: esquema aditivo y compatibilidad

**Files:** Migración nueva generada por CLI; `src/lib/agenda/agenda-server.ts`; `src/components/dashboard/agenda/types.ts`; crear `src/test/agenda-booking-schema.test.ts` y `supabase/tests/agenda-booking-stage1.sql`.

**Interfaces:** Añadir `professional_selection`, `online_visible`, horario profesional nullable, margen del servicio, tablas `agenda_professional_service_rates`, `agenda_time_off`, `agenda_booking_quotes`. Mantener `agenda_professional_services` exclusivamente para elegibilidad.

- [ ] Escribir tests que exijan defaults compatibles, claves/referencias compuestas por organización, RLS/grants, `occupied_until >= ends_at` y límites de precio/duración/margen.
- [ ] Ejecutar `npx vitest run src/test/agenda-booking-schema.test.ts`; confirmar fallo por contrato ausente.
- [ ] Revisar docs/changelog de Supabase y `npx supabase migration new --help`; generar archivo por CLI sin inventar versión. Verificar orden frente a migraciones existentes con fechas futuras antes de crear dependencias.
- [ ] Implementar migración: backfill `occupied_until=ends_at`, margen cero; tarifas null heredadas; horario null heredado y `{}` cerrado; visible online true. RLS por tenant y permiso, más validación de pertenencia incluso con service role.
- [ ] Implementar lectura compatible: `capabilities.professionalBooking` indica disponibilidad del esquema. Falta de tablas/columnas nuevas permite lectura antigua; otros errores no se confunden con migración faltante. Escrituras de opciones nuevas devuelven error explícito.
- [ ] Ejecutar test y pruebas SQL en Supabase local aislado; no resetear datos del usuario. Si no hay entorno local, reportar verificación de DB pendiente, no simular éxito.
- [ ] Revisar diff y guardar commit limitado a esta tarea.

## Task 2: tarifas y disponibilidad puras

**Files:** Crear `src/lib/agenda/booking-policy.ts`, `src/lib/agenda/service-terms.ts`, `src/lib/agenda/availability.ts`; modificar `slots.ts`, `public-agenda-server.ts`; crear `src/test/agenda-service-terms.test.ts`, `src/test/agenda-availability.test.ts`.

**Interfaces:** Produce las interfaces compartidas anteriores; mantiene compatibilidad de `availableSlots()` para consumidores antiguos hasta migrarlos.

- [ ] Escribir tests: precio base 30000, override 40000/45 minutos, override cero, duración heredada; requerir profesional en modo obligatorio; ocultos no asignables.
- [ ] Escribir tests: negocio 08–18 y profesional 09–12/14–17; corte 30 + margen 5 impide siguiente turno a los 30; ausencia bloquea solo recurso afectado; `{}` cierra y null hereda; intervalos duplicados no duplican ofertas; probar cruce de día y zona con DST.
- [ ] Ejecutar `npx vitest run src/test/agenda-service-terms.test.ts src/test/agenda-availability.test.ts`; confirmar rojo.
- [ ] Implementar helpers y generación por profesional usando sus términos. Intersectar horarios, excluir ausencias y todo intervalo ocupado; respetar anticipación y ventana de reserva. No crear recurso null cuando existen profesionales pero ninguno es elegible online.
- [ ] Ejecutar esos tests junto con `src/test/agenda-slots.test.ts`; confirmar verde y guardar commit acotado.

## Task 3: escrituras atómicas, snapshots y concurrencia

**Files:** Migración nueva por CLI; crear `src/lib/agenda/booking-writes.ts`; modificar `src/app/api/agenda/route.ts`, `src/app/api/agenda/[id]/route.ts`; ampliar pruebas SQL y crear `src/test/agenda-booking-writes.test.ts`.

**Interfaces:** Produce RPCs y wrappers de servidor del contrato compartido. Errores estables: `QUOTE_EXPIRED`, `QUOTE_CHANGED`, `APPOINTMENT_OVERLAP`, `TIME_OFF_CONFLICT`, `IDEMPOTENCY_CONFLICT`.

- [ ] Escribir tests que rechacen precio manipulado, IDs de otro tenant, horario obsoleto y reintentos con misma clave/cuerpo diferente; preserven snapshots al mover la cita sin cambiar servicio/profesional.
- [ ] Ejecutar `npx vitest run src/test/agenda-booking-writes.test.ts`; confirmar rojo.
- [ ] Implementar validación transaccional y locks: lock por organización compartido para reservas/cambios y exclusivo para cambios de horario/bloqueos; lock exclusivo por profesional con orden estable al mover entre profesionales. El trigger protege también escrituras directas, usa intervalo ocupado y comprueba bloqueos.
- [ ] Crear/configurar revisiones que invaliden ofertas al cambiar tarifa, horario, margen, elegibilidad o visibilidad. Cotización consumida con misma clave devuelve la misma cita; contenido diferente rechaza.
- [ ] Cambios internos fuera del horario solo con advertencia explícita/permiso; nunca sobre bloqueo ni solapamiento. Citas cobradas no pueden cambiar importe silenciosamente.
- [ ] Ejecutar tests y dos sesiones SQL concurrentes para reserva/reserva y reserva/bloqueo; probar actualizaciones y referencias cruzadas con roles reales. Registrar resultados y commit.

## Task 4: endpoints públicos y cotización verificable

**Files:** Modificar `src/app/api/public/agenda/[slug]/route.ts`, `src/app/api/public/appointment/[token]/route.ts`, `src/lib/agenda/public-agenda-server.ts`; crear `src/app/api/public/agenda/[slug]/quote/route.ts`; ampliar `src/test/public-agenda-route.test.ts` y crear `src/test/public-agenda-quote.test.ts`.

**Interfaces:** GET info añade modo y tarifas públicas por profesional cuando corresponda; GET slots retorna profesional propuesto, fin atención, precio público nullable y duración. POST quote toma servicio/inicio/elección y retorna `quoteId`, `expiresAt` y resumen público. POST reserva toma quoteId, clave idempotente y datos cliente; el servidor resuelve los términos privados.

- [ ] Escribir tests de tres modos, UUIDs inválidos, un profesional, todos ocultos, precio oculto, elección automática con tarifas distintas y cotización caducada. Ante tarifa/asignación diferente devolver 409 sin crear reserva.
- [ ] Ejecutar `npx vitest run src/test/public-agenda-route.test.ts src/test/public-agenda-quote.test.ts`; confirmar rojo de nuevos casos.
- [ ] Implementar contratos y rate limit del endpoint de cotización (30 solicitudes/10 minutos/IP y organización), además de protecciones actuales de reserva. No registrar tokens/datos privados en logs ni caches públicas.
- [ ] Reprogramación usa precio/duración/margen snapshot para misma combinación, no configuración actual. Cambios de combinación requieren nueva cotización aceptada y autorización interna; no añadir cambio público de servicio en esta etapa.
- [ ] Ejecutar tests, revisar ausencia de fuga de precio y confirmar reserva→evento negocio sigue funcionando. Guardar commit.

## Task 5: configuración y reserva pública utilizables

**Files:** Modificar `AgendaSettingsPanel.tsx`, `ProfessionalServicesPicker.tsx`, `AppointmentDialog.tsx`, `PublicBooking.tsx` y APIs settings/professionals; crear componentes `ProfessionalScheduleEditor.tsx`, `ProfessionalRatesEditor.tsx`, `TimeOffEditor.tsx`, `BookingQuoteSummary.tsx` y `src/app/api/agenda/time-off/route.ts`.

**Interfaces:** UI utiliza capabilities, helpers y endpoints de tareas anteriores. Separar elegibilidad de tarifas; un override no altera automáticamente qué servicios realiza el profesional.

- [ ] Escribir `src/test/agenda-professional-settings.test.tsx` y ampliar `src/test/public-booking-professionals.test.tsx`: modo requerido con uno, ocultos, heredar vs cerrado, cero vs heredar, conflictos de bloqueos y guardado fallido sin toast de éxito.
- [ ] Ejecutar ambos tests; confirmar rojo.
- [ ] Implementar editores pequeños con validación y controles de 44px/font-size 16px en móvil. Mostrar reservas afectadas antes de crear bloqueos y rechazar conflictos en vez de cancelarlas.
- [ ] Reserva: selector según modo, tarifa/duración visibles por profesional, «Precio a consultar» si oculto; resumen y aceptación antes del POST. Cambiar servicio/profesional/hora invalida cotización; 409 refresca disponibilidad efectivamente y conserva datos personales.
- [ ] Panel usa los mismos términos al seleccionar profesional; cambiar fecha de una reserva conserva snapshot. Mostrar duración de atención y ocupación adicional separadas.
- [ ] Ejecutar tests y revisar navegador público/autenticado a 320/768/1024/1440, teclado, carga/error y falta de migración. Guardar commit.

## Task 6: POS y aceptación end-to-end

**Files:** Modificar `src/app/dashboard/pos/hooks/useQuoteToCart.ts` y `src/app/api/pos/process-sale/route.ts` junto con sus validadores/RPC de venta si el precio actual impide honrar el snapshot; crear `src/test/agenda-pos-snapshot.test.ts` y documentación `docs/qa/agenda-professionals-stage1.md`.

**Interfaces:** El vínculo de cita en la venta identifica el snapshot autorizado; una tarifa profesional no autoriza sobrescribir arbitrariamente precios de otros productos o ventas sin cita.

- [ ] Escribir casos: catálogo 30000/cita 40000 cobra 40000; catálogo cambiado a 50000 conserva 40000; tarifa cero; cita ajena/cancelada/cobrada rechazada; dos cobros concurrentes crean como máximo una venta vinculada. Afirmar importe persistido, no solo texto del carrito.
- [ ] Ejecutar `npx vitest run src/test/agenda-pos-snapshot.test.ts`; confirmar rojo de divergencia.
- [ ] Implementar precio autorizado por snapshot desde servidor con persistencia atómica del vínculo de venta. Mantener descuentos explícitos autorizados y bloquear manipulaciones del payload; no usar descuentos negativos como solución.
- [ ] Ejecutar todos los tests de agenda/booking/POS afectados; `npx tsc --noEmit --pretty false`, ESLint enfocado y `git diff --check`. Verificar base local, reserva pública, reprogramación, configuración y cobro real en entorno de pruebas.
- [ ] Documentar migraciones exactas, orden de aplicación por usuario, rollback operativo sin borrar historial y verificaciones pendientes. Revisar alcance y commit; no push/despliegue ni aplicación remota.

## Handoff

Plan pendiente de revisión y elección de ejecución. Recomendada ejecución nativa en esta sesión por la dependencia entre snapshots, disponibilidad y POS. Las etapas 2 y 3 mantienen el alcance aprobado pero requieren sus propios planes antes de implementarse; no se consideran entregadas por completar esta etapa.
