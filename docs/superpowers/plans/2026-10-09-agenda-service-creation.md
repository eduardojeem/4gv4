# Alta segura de servicios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. El usuario eligió ejecución nativa en la rama actual.

**Goal:** Crear productos de servicio y su configuración de agenda de forma atómica, sin sobrescribir horarios ni duplicar altas al reintentar.

**Architecture:** Un POST tenant-aware recibe solo datos del servicio y una clave de idempotencia. Reutiliza la política comercial del servidor y llama una RPC exclusiva de service-role que verifica su revisión, serializa el cupo y escribe producto, duración, auditoría e idempotencia en una transacción. Alta individual y sugerencias consumen el mismo contrato.

**Tech Stack:** Next.js App Router, React, TypeScript, Zod, Supabase/PostgreSQL, Vitest y PGlite existente; sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-09-agenda-service-creation-design.md`.

## Global Constraints

- No modificar las migraciones `20261014120005` y `20261014120006`, que el usuario ya declaró aplicadas.
- Precio y duración son datos explícitos del dueño.
- Duración entera entre 5 y 600 minutos.
- La organización y el actor salen del contexto autenticado, nunca del cuerpo enviado por el navegador.
- Auditoría y escrituras quedan en la misma transacción.
- No recibe ni escribe `agenda_settings`.
- No cambiar asociaciones ni tarifas del personal en esta entrega.
- No publicar ni aplicar SQL remoto desde este trabajo; entregar el archivo exacto al usuario.
- Preservar todos los cambios locales anteriores; no cambiar de rama ni resetear el checkout.

## Review Focus

1. Respuesta perdida tras commit: reintentar devuelve el mismo ID, incluso si ese commit ocupó el último cupo (Tasks 1 y 2).
2. Cambio de plan entre validación y escritura: rechazar revisión comercial vieja sin crear filas (Tasks 1 y 2).
3. Doble envío y cierre/reapertura: preservar clave/datos ante error y generar nueva clave solo para otra alta (Task 3).
4. Precio cero, formato PYG y duración personalizada: distinguir vacío de cero y admitir 25/55/600 minutos (Task 3).
5. Lote parcialmente completado: identificar los servicios creados, conservar los pendientes y no recrearlos al reintentar (Task 3).

## Task 1: RPC transaccional e idempotencia

**Files:** Create una migración usando `npx supabase migration new agenda_service_creation_atomic`; create `src/test/agenda-service-creation-sql.test.ts`; extend `vitest.beauty.config.ts` para incluir explícitamente este test, sin excluir pruebas existentes.

**Interfaces:**

- `agenda_service_policy_revision(p_org uuid) -> text`: snapshot determinista de organización y fuentes de política usadas por `canCreateResource`/estado de suscripción, incluyendo catálogo técnico/comercial, suscripción y pruebas de módulos. Lectura solo service-role.
- `create_agenda_service(p_org uuid,p_actor uuid,p_key uuid,p_input jsonb,p_limit integer,p_policy_revision text) -> jsonb {id,replayed}`. `p_limit` nullable representa ilimitado y proviene únicamente de código servidor, nunca del body HTTP.
- Tabla `agenda_service_create_requests`: clave primaria `(organization_id,request_key)`, fingerprint de entrada y resultado. RLS habilitado, sin grants ni políticas para anon/authenticated; acceso service-role.

- [ ] Escribir tests SQL con PGlite: creación guarda producto `unit_measure='servicio'`, stock cero y fila de agenda; no modifica `agenda_settings`; fallo de agenda o auditoría revierte producto e idempotencia; mismo key/input devuelve mismo ID; key con otros datos da `IDEMPOTENCY_CONFLICT`; reintento con cupo ocupado funciona; nueva clave con cupo ocupado da `SERVICE_LIMIT_REACHED`; revisión vieja da `SERVICE_POLICY_CHANGED`; permisos EXECUTE públicos ausentes.
- [ ] Ejecutar `npx vitest run --config vitest.beauty.config.ts src/test/agenda-service-creation-sql.test.ts`; confirmar RED por función ausente.
- [ ] Crear migración mediante CLI, verificar su orden posterior a `20261014120006` y conservar el nombre final en QA. No ejecutar contra base remota. Si la fecha de CLI queda antes, renombrar solo la migración nueva no aplicada y documentarlo.
- [ ] Implementar RPC `security invoker`, `search_path=''`, permisos EXECUTE solo service-role y validación del actor mediante el contrato existente `agenda_assert_actor`. Whitelist estricta del JSON: `name,price,durationMinutes,catalogVisible,online`. Generar SKU en servidor SQL sin aceptar códigos del navegador.
- [ ] Tomar bloqueo transaccional coordinado con `agenda_lock(p_org)` y escritores ordinarios de productos; comparar política bajo bloqueo y contar servicios no archivados como `countServices`. Para serializar inserciones ordinarias, usar bloqueo corto de tabla de productos; no mantenerlo durante llamadas de red. Registrar explícitamente que escritores ajenos que validan cupo fuera de la transacción requieren revisión y no atribuirles garantías nuevas sin integrar su control.
- [ ] Verificar replay antes de aplicar cupo o revisión nuevos; permisos de actor continúan siendo obligatorios. Insertar producto, agenda, auditoría y resultado de idempotencia en la misma transacción, sin compensación mediante DELETE.
- [ ] Ejecutar tests hasta GREEN. Con PostgreSQL de prueba disponible, verificar dos conexiones al último cupo: solo una clave nueva se crea. PGlite secuencial no cuenta como prueba concurrente.
- [ ] Revisar diff y commit `feat: create agenda services atomically with idempotency`.

## Task 2: Endpoint autorizado y cliente compartido

**Files:** Create `src/app/api/agenda/services/route.ts`, `src/lib/agenda/service-creation.ts`, `src/lib/agenda/service-creation-server.ts`, `src/test/agenda-service-creation-route.test.ts`; extend config focalizada para estos tests.

**Interfaces:**

- `AgendaServiceCreateSchema` estricto: `{requestKey:uuid,name:trimmed string 1..120,price:finite number>=0,durationMinutes:integer 5..600,catalogVisible:boolean,online:boolean}`.
- POST `/api/agenda/services`: `{success:true,service:{id:string},replayed:boolean}`. Errores: 401/403 permisos/módulo, 422 validación, 409 conflicto/cupo/política, 503 RPC ausente. No confiar en organización, cupo ni actor del body.
- `createAgendaService(input:AgendaServiceCreateInput):Promise<AgendaServiceCreateResult>` cliente fetch sin guardar configuración global; devuelve ID en éxito y error tipado con `code`/mensaje en fallo.

- [ ] Escribir pruebas con el guard real y mocks solo de límites externos: sin sesión 401; sin `products.create` o `settings.manage` 403; sin módulo habilitado 403; body con organizationId/limit 422; servicio válido llama una sola RPC y jamás upsert de horarios; error SQL no informa éxito; reintento al último cupo consulta replay antes de rechazar por capacidad; política bloqueada/vencida respeta `canCreateResource`.
- [ ] Ejecutar `npx vitest run --config vitest.beauty.config.ts src/test/agenda-service-creation-route.test.ts`; confirmar RED.
- [ ] Implementar guard con ambos permisos y módulos actuales: `services` más el requisito de `inventory` que hoy exige crear productos. No ampliar accesos silenciosamente; comunicar el requisito si falta. Reutilizar `canCreateResource(org,'services')` y sus reglas de bloqueo/plan vencido; pasar solo límite derivado del servidor.
- [ ] Leer revisión comercial antes y después de resolver capacidad; una diferencia retorna conflicto sin escritura. Para replay, consultar resultado guardado con tenant/actor validado y verificar fingerprint antes de denegar una nueva creación por cupo. No exponer tabla de idempotencia al navegador.
- [ ] Regenerar argumentos confiables en servidor; mapear errores sin mostrar SQL interno; falta de migración no recurre al alta antigua. La respuesta de éxito sale de la RPC, no depende de otro GET que pueda fallar después del commit.
- [ ] Ejecutar pruebas hasta GREEN; revisar diff y commit `feat: expose guarded agenda service creation`.

## Task 3: Formulario y sugerencias con guardado único

**Files:** Modify `src/components/dashboard/agenda/NewServiceDialog.tsx`, `SuggestedServicesCard.tsx`, `AgendaSettingsPanel.tsx`, `service-entry.test.tsx`; create `src/components/dashboard/agenda/service-creation-ui.test.tsx`; extend `vitest.beauty-ui.config.ts`; update `docs/qa/beauty-services.md`.

**Interfaces:** Los componentes consumen el cliente de Task 2. El formulario deja de recibir `savedSettings` y `defaultDuration`; las sugerencias dejan de recibir `savedSettings`. Mantener `onCreated`/`onAdded` para refrescar conservando borradores.

- [ ] Tests RED: completar precio cero y 55 minutos permite alta; campos vacíos no; catálogo y online independientes; resumen refleja valores; confirmación realiza solo POST a `/api/agenda/services`, nunca PUT a settings; doble clic una solicitud; error mantiene clave/datos y reintento usa misma clave; éxito reinicia precio/duración/clave; lote con segundo fallo identifica primero creado y no lo vuelve a enviar.
- [ ] Ejecutar `npx vitest run --config vitest.beauty-ui.config.ts src/components/dashboard/agenda/service-entry.test.tsx src/components/dashboard/agenda/service-creation-ui.test.tsx`; confirmar RED.
- [ ] Reemplazar duración limitada por input de minutos 5..600 con atajos opcionales. Mostrar moneda, publicación separada y resumen; mantener sugerencias sin precios ni tiempos inventados y protección de nombres normalizados.
- [ ] Reemplazar el alta en dos pasos por el cliente único. Guardar clave de alta con el borrador; no descartarla por fallo de red o cambio de visibilidad del diálogo. Bloquear doble envío/cierre durante requests; tras éxito preparar otro borrador limpio.
- [ ] Usar una clave estable por fila sugerida; seleccionar una idea no escribe. Detener el lote en el primer fallo, refrescar lo creado e informar cuántos quedan; evitar éxito falso o pérdida de datos al fallar el refresco.
- [ ] Mostrar que profesionales con «Todos los servicios» incluyen el nuevo; vincular a `#equipo`. No crear asociaciones exclusivas ni modificar tarifas.
- [ ] Ejecutar tests focalizados hasta GREEN, `npm run typecheck`, ESLint sobre archivos tocados y `git diff --check`. Comparar fallos globales anteriores sin declararlos resueltos por esta entrega.
- [ ] Probar con sesión autorizada en navegador: alta, publicación, retry y borradores; 320/768/1024/1440 px. Si no hay sesión, registrar pendiente, no cambiar auth para el test.
- [ ] Revisión independiente final según método nativo; corregir hallazgos importantes y repetir pruebas afectadas. Actualizar QA con nombre exacto del SQL, orden de aplicación y evidencia local/remota separada. Commit `feat: guide service entry through atomic creation`.

## Handoff

Plan pendiente de revisión del usuario. Método nativo preservado. No iniciar implementación, aplicar SQL remoto ni publicar hasta aprobar este plan.
