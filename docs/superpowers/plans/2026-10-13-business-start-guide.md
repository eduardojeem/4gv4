# Preparar mi negocio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if explicitly selected. Steps use checkbox syntax for tracking.

**Goal:** Guiar al administrador por preparación y primera operación según rubro y forma de trabajo, sin crear transacciones de prueba.

**Architecture:** Un evaluador puro transforma evidencia autenticada en tareas. Un lector servidor acotado obtiene datos de la organización; un componente de dashboard y ayudas contextuales consumen el mismo contrato. Preferencias se guardan mediante actualización atómica de una clave propia de configuración.

**Tech Stack:** Next.js, React, TypeScript, Supabase/PostgreSQL, Zod, Vitest; sin dependencias nuevas ni proveedor de IA.

**Spec:** `docs/superpowers/specs/2026-10-13-business-start-guide-design.md`

## Global Constraints

- Sin operaciones financieras de prueba, publicación remota ni ampliación de permisos o plan.
- Rubro sugiere; forma de trabajo determina. Mixto no exige completar todos los canales.
- No completar tareas por una visita ni por la bandera general de onboarding.
- No confundir reserva, servicio realizado, venta completada y cobro.
- No obligar a logo, web, promociones o comisiones para comenzar.
- Preservar todos los cambios pendientes, especialmente Finanzas, agenda y reparaciones. No incluirlos en commits del asistente.
- No generar un sandbox transaccional: demo explicativa con datos ilustrativos en memoria.

## Review Focus

1. Cambio de organización mientras responde la API: nunca mostrar evidencia ajena (tarea 3).
2. Plan o permisos limitados: no sugerir acciones inaccesibles ni activarlas (tareas 1–3).
3. Error de consulta: mostrar desconocido/error, no completar ni falsear ausencia (tarea 2).
4. Venta a crédito o reserva sin cobro: no declarar dinero recibido (tareas 1–2).
5. Posponer o cambiar de rubro: conservar ajustes existentes y permitir reabrir (tareas 2–3).

## Archivos y contratos

- `src/lib/onboarding/start-guide.ts`: tipos y evaluador puro.
- `src/lib/onboarding/start-guide-server.ts`: lector agregado y preferencias autenticadas.
- `src/app/api/onboarding/start-guide/route.ts`: GET y PATCH de preferencias.
- `src/hooks/use-business-start-guide.ts`: solicitudes ligadas al contexto.
- `src/components/dashboard/onboarding/BusinessStartGuide.tsx`: resumen de tareas y próxima acción.
- `src/components/dashboard/onboarding/FirstOperationGuide.tsx`: instrucciones y demo no transaccional.
- `src/app/dashboard/page.tsx`, `src/components/dashboard/onboarding/OnboardingClient.tsx`: integrar sin sustituir sus responsabilidades.

Tipos de tarea: `{ id: string; label: string; description: string; href: string; required: boolean; state: 'ready' | 'pending' | 'unknown' }`.

`StartGuideEvidence`: perfil normalizado, `effectiveModules: string[]`, permisos, `basics`, `activeBranch`, `sellableProduct`, `activeService`, `serviceAvailability`, `teamConfigured`, `firstSale`, `firstReservation`, `firstService`, `firstRepair`, `firstCollection`. Cada evidencia es boolean o null; null significa no comprobable.

`StartGuidePreferences`: `{ version: 1; teamMode: 'solo' | 'team' | null; postponed: boolean }`.

`StartGuideResult`: `{ tasks: StartGuideTask[]; completed: number; total: number; nextTaskId: string | null; operationMilestones: Record<string, boolean | null> }`.

### Task 1: Evaluador por forma de trabajo

**Files:** crear `start-guide.ts` y `src/test/business-start-guide.test.ts`.

**Interfaces:** producir `evaluateStartGuide(evidence: StartGuideEvidence, preferences: StartGuidePreferences): StartGuideResult`.

- [ ] Escribir pruebas: retail sin producto → tarea catálogo pendiente; service con servicio y horario → no exige stock; repair → recepción separada de entrega/cobro; mixed → tareas de módulos efectivos; reserva true y cobro false → primer cobro false; evidencia null → unknown; logo ausente no afecta básicos; equipo solo no exige personal.
- [ ] Ejecutar `node node_modules/vitest/vitest.mjs run src/test/business-start-guide.test.ts --pool=threads --maxWorkers=1`; observar fallo antes de implementación.
- [ ] Implementar evaluador con rutas existentes verificadas y acciones permitidas. Calcular progreso de requisitos aplicables; opcionales fuera del denominador.
- [ ] Repetir pruebas y comprobar PASS.
- [ ] Commit solo evaluador y pruebas.

### Task 2: Evidencia servidor y preferencias seguras

**Files:** crear `start-guide-server.ts`, ruta API, `src/test/business-start-guide-api.test.ts`; crear migración local con CLI si se necesita RPC de preferencias.

**Interfaces:** producir `loadStartGuide(userId: string, branchId?: string): Promise<{ organizationId: string; guide: StartGuideResult; preferences: StartGuidePreferences }>` y `saveStartGuidePreferences(userId: string, preferences: StartGuidePreferences): Promise<void>`.

- [ ] Escribir pruebas: sin sesión 401; cuenta sin organización no recibe guía administrativa; miembro no administrador 403; sucursal ajena 403; módulo no contratado no consultado; consulta fallida no se transforma en evidencia false; solicitud con organización anterior rechazada.
- [ ] Ejecutar pruebas y observar fallo.
- [ ] Resolver organización y permisos con helpers existentes; consultar exists/limit 1 y agregados por organización/sucursal. Verificar estados canónicos en ventas, agenda, reparaciones y sus lectores de cobro antes de codificar cada evidencia. Si no existe un evento real integrado, devolver null con explicación visible; no inventar completitud.
- [ ] Zod valida PATCH únicamente `{ version: 1, teamMode, postponed }`. Mantener `/api/onboarding/status` y su contrato intactos.
- [ ] Guardar bajo `organization_settings.modules.business_start_guide` con RPC service-only, actor activo owner/admin de esa organización, search_path fijo y `jsonb_set` sobre el valor actual: nunca leer y reemplazar todo modules desde cliente. Prueba SQL asegura preservación de Finanzas, onboarding y web. Crear archivo mediante CLI, no ejecutar remoto.
- [ ] Ejecutar pruebas API y SQL local, comprobar PASS, documentar migración y commit de archivos propios.

### Task 3: Dashboard y configuración inicial

**Files:** hook, `BusinessStartGuide.tsx`, integración dashboard/onboarding; `src/test/business-start-guide-ui.test.tsx`.

**Interfaces:** hook `useBusinessStartGuide()` expone `{ guide, preferences, loading, error, refresh, savePreferences }`; componente no hace escrituras fuera de preferencias.

- [ ] Escribir pruebas de próxima tarea y progreso, continuar después/reabrir, equipo solo/equipo, cambio de rubro, error visible y respuesta tardía de organización anterior ignorada.
- [ ] Ejecutar y observar fallo.
- [ ] Añadir tarjeta mobile-first «Preparar mi negocio» y enlaces a formularios existentes. Al posponer, dejar acceso «Continuar preparación»; mostrar datos recién guardados al volver a enfocar o refrescar, sin marcar por navegación. No duplicar el aviso de web: aclarar que publicar web es opcional.
- [ ] Integrar selección de equipo en onboarding sin crear personas. La API autoriza preferencias; ocultar tareas administrativas a quien no tenga permiso.
- [ ] Repetir pruebas, comprobar PASS y commit propio.

### Task 4: Primera operación guiada y demo explicativa

**Files:** `FirstOperationGuide.tsx`, integración en entradas POS/agenda/reparaciones existentes; `src/test/first-operation-guide.test.tsx`.

**Interfaces:** `FirstOperationGuide({ kind: 'sale' | 'reservation' | 'repair', onClose: () => void })`; únicamente presentación, sin callback de guardar o pagar.

- [ ] Pruebas: pasos del flujo adecuado, cliente opcional cuando POS lo permite, reserva no equivale a cobro, demo muestra «Demostración: no registra operaciones» y abrir/cerrar no llama fetch de endpoints mutantes.
- [ ] Ejecutar y observar fallo.
- [ ] Crear ayudas no bloqueantes con ejemplos en memoria. Enlazar desde checklist y encabezar flujos reales sin duplicar formularios ni modificar sus validaciones. Si hay requisitos de caja, remitir al flujo existente; jamás abrirla automáticamente.
- [ ] Mostrar primera operación solo tras evidencia persistida y próxima sugerencia contextual; no declarar éxito por pulsar un botón.
- [ ] Repetir pruebas, comprobar PASS y commit propio.

### Task 5: Integración y cierre

**Files:** documentación de funcionamiento; pruebas y correcciones estrictamente relacionadas.

- [ ] Ejecutar tests nuevos y existentes de onboarding, perfil de negocio y dashboard.
- [ ] Ejecutar TypeScript, lint focalizado y `git diff --check`; después suite global/build con recursos suficientes, sin matar procesos ajenos.
- [ ] Validar navegación autenticada a 320/390/768/1024 px. No ejecutar ventas, reservas, reparaciones ni cobros reales para comprobar el asistente.
- [ ] Revisión final de permisos, tenant, planes y demo sin persistencia. Verificar propiedad de todos los diffs antes de commit.
- [ ] Entregar cambios, pruebas, limitaciones de cobertura y SQL local necesario. No migrar ni desplegar sin autorización específica.

## Auto-revisión del plan

Los cinco riesgos tienen pruebas asignadas. Preparación, preferencias, evidencias y demostración mantienen contratos separados. Los hitos sin fuente comprobable se muestran como desconocidos. No se reutiliza finalización de onboarding como primera operación. Las dependencias se ejecutan en orden 1 → 2 → 3 → 4 → 5.
