# System Health Operational Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `/superadmin/system-health` en un panel operativo que explique el estado actual, los cambios desde la ejecución anterior, el impacto y las acciones seguras basadas en evidencia.

**Architecture:** Ampliar el reporte en el servidor, usando funciones puras para estadísticas, comparación y priorización. Leer una ejecución anterior completa desde el historial existente, sin migración inicial, y mantener React como capa de presentación. Las integraciones y tareas que no tengan una fuente comprobable deben conservar `unknown` o `not_configured`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase JS, Vitest, Testing Library, Tailwind y componentes UI existentes.

**Spec:** `docs/plans/2026-10-02-system-health-operational-dashboard-design.md`

## Global Constraints

- Esta fase es de diagnóstico y lectura: no envía alertas ni ejecuta correcciones automáticas.
- `unknown` y `not_configured` nunca cuentan como correctos ni aprobados.
- No devolver valores de secretos, URLs firmadas ni errores externos sin sanitizar.
- No agregar una migración salvo que una prueba demuestre que el historial actual es insuficiente.
- Los fallos y timeouts de una fuente no cancelan el resto del diagnóstico.
- El consumo monetario de Vercel queda `unknown` sin una fuente oficial configurada.
- Mantener intactos los cambios locales ajenos a System Health.

## Review Focus

- Historial con filas intercaladas de varios `runId`: seleccionar la ejecución anterior completa, no las últimas filas globales (Task 2).
- Estado actual `unknown` después de un error anterior: no presentarlo falsamente como resuelto (Task 1).
- Muestras de rendimiento vacías, únicas y con valores repetidos: producir estadísticas deterministas sin `NaN` (Task 3).
- Integración configurada que excede el timeout: mostrar `unknown` y continuar las demás comprobaciones (Task 4).
- Recomendaciones que contienen nombres de variables: mostrar solo nombres permitidos y nunca valores (Task 5).

---

## Mapa de archivos

- Crear `src/lib/health/comparison.ts`: comparación, prioridad y resumen ejecutivo puros.
- Crear `src/lib/health/comparison.test.ts`: matriz de cambios y orden de prioridad.
- Modificar `src/lib/health/history.ts`: obtener la ejecución anterior completa y resúmenes por ejecución.
- Crear `src/lib/health/history.test.ts`: consultas y degradación segura del historial.
- Crear `src/lib/health/statistics.ts`: mediana y p95.
- Crear `src/lib/health/statistics.test.ts`: casos límite de estadísticas.
- Modificar `src/lib/health/checks/web.ts`: métricas de tiempo e imágenes.
- Modificar `src/lib/health/checks/integrations.ts`: estado verificable de servicios y tareas.
- Crear `src/lib/health/checks/integrations.test.ts`: configuración, timeout y sanitización.
- Modificar `src/lib/health/types.ts`: contratos del reporte operacional.
- Modificar `src/lib/health/run.ts`: composición del reporte y comparación anterior.
- Crear `src/lib/health/run.test.ts`: reporte completo y fallos parciales.
- Crear `src/components/superadmin/system-health/ExecutiveHealthSummary.tsx`: cabecera ejecutiva.
- Crear `src/components/superadmin/system-health/OperationalHealthPanels.tsx`: despliegue, servicios, tareas, rendimiento e imágenes.
- Modificar `src/components/superadmin/system-health/SystemHealthDashboard.tsx`: integrar resumen, cambios y paneles.
- Modificar `src/components/superadmin/system-health/CheckDetailSheet.tsx`: impacto y acciones guiadas.
- Modificar `src/components/superadmin/system-health/HealthHistoryPanel.tsx`: resumen por ejecución.
- Modificar `src/components/superadmin/system-health/SystemHealthDashboard.test.tsx`: comportamiento accesible del panel.

### Task 1: Contratos, comparación y prioridad

**Files:**
- Create: `src/lib/health/comparison.ts`
- Create: `src/lib/health/comparison.test.ts`
- Modify: `src/lib/health/types.ts`

**Interfaces:**
- Consumes: `HealthCheckResult`, `HealthHistoryEntry`, `HealthStatus`, `HealthSeverity`.
- Produces: `HealthChangeKind`, `HealthCheckChange`, `HealthComparison`, `ExecutiveHealthSummary`; `compareHealthChecks(current, previous, previousRunId, previousCheckedAt)` y `prioritizeHealthChecks(checks, changes)`.

- [ ] **Step 1: Escribir pruebas fallidas de la matriz de cambios**

Probar `healthy -> error = new_issue`, `warning -> error = worsened`, `error -> warning = improved`, `error -> healthy = resolved`, mismo estado = `unchanged`, sin anterior = `not_comparable`, y `error -> unknown` no es `resolved`.

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo**

Run: `npx vitest run src/lib/health/comparison.test.ts`
Expected: FAIL porque los contratos y funciones todavía no existen.

- [ ] **Step 3: Definir contratos y funciones puras**

Implementar:

```ts
compareHealthChecks(
  current: HealthCheckResult[],
  previous: HealthHistoryEntry[],
  previousRunId: string | null,
  previousCheckedAt: string | null,
): HealthComparison

prioritizeHealthChecks(
  checks: HealthCheckResult[],
  changes: HealthCheckChange[],
): HealthCheckResult[]
```

La precedencia debe distinguir confiabilidad (`unknown`, `not_configured`) de éxito (`healthy`) y usar severidad solo después del estado.

- [ ] **Step 4: Ejecutar pruebas enfocadas**

Run: `npx vitest run src/lib/health/comparison.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit atómico**

```bash
git add src/lib/health/types.ts src/lib/health/comparison.ts src/lib/health/comparison.test.ts
git commit -m "feat(health): classify changes between diagnostic runs"
```

### Task 2: Lectura de ejecuciones completas del historial

**Files:**
- Modify: `src/lib/health/history.ts`
- Create: `src/lib/health/history.test.ts`

**Interfaces:**
- Consumes: tabla `system_health_checks` y tipos de Task 1.
- Produces: `readPreviousRun(admin, currentRunId?) -> Promise<HealthPreviousRunResult>` y `summarizeHistoryRuns(entries) -> HealthRunSummary[]`.

- [ ] **Step 1: Escribir pruebas fallidas**

Cubrir filas intercaladas, exclusión del `currentRunId`, ejecución más reciente completa, tabla ausente y consulta fallida. Afirmar que los fallos regresan `available: false` sin lanzar excepción.

- [ ] **Step 2: Confirmar el fallo**

Run: `npx vitest run src/lib/health/history.test.ts`
Expected: FAIL por funciones ausentes.

- [ ] **Step 3: Implementar lectura en dos pasos**

Primero resolver el `run_id` anterior por `checked_at`; después leer todas sus filas ordenadas. Limitar y sanear fechas/campos igual que `readHistory()`.

- [ ] **Step 4: Añadir agrupación de historial**

Implementar `summarizeHistoryRuns()` con conteos por estado, inicio/fin y duración agregada segura para la vista por ejecución.

- [ ] **Step 5: Verificar y guardar**

Run: `npx vitest run src/lib/health/history.test.ts src/lib/health/comparison.test.ts`
Expected: PASS.

```bash
git add src/lib/health/history.ts src/lib/health/history.test.ts
git commit -m "feat(health): read complete previous diagnostic runs"
```

### Task 3: Estadísticas de rendimiento e imágenes

**Files:**
- Create: `src/lib/health/statistics.ts`
- Create: `src/lib/health/statistics.test.ts`
- Modify: `src/lib/health/checks/web.ts`
- Modify: `src/lib/health/health-utils.test.ts`

**Interfaces:**
- Produces: `median(values: number[]): number | null`, `percentile(values: number[], percentile: number): number | null` y métricas con IDs estables `performance` e `images`.

- [ ] **Step 1: Escribir pruebas fallidas de estadísticas**

Afirmar: vacío devuelve `null`; `[120]` devuelve 120; mediana par promedia los dos centrales; p95 usa nearest-rank y no muta la entrada.

- [ ] **Step 2: Confirmar el fallo**

Run: `npx vitest run src/lib/health/statistics.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar estadísticas puras**

Agregar las dos funciones, rechazando valores no finitos antes de ordenar una copia.

- [ ] **Step 4: Ampliar `performance.response_time`**

Agregar a metadata/métricas: cantidad, mediana, p95 y máximo; conservar promedio solo como dato secundario y el detalle por ruta existente.

- [ ] **Step 5: Ampliar `performance.images`**

Clasificar las URLs observadas en `optimized`, `direct`, `heavy` y `unverifiable`; reportar el optimizador por separado. No estimar costo de Vercel.

- [ ] **Step 6: Verificar y guardar**

Run: `npx vitest run src/lib/health/statistics.test.ts src/lib/health/health-utils.test.ts`
Expected: PASS.

```bash
git add src/lib/health/statistics.ts src/lib/health/statistics.test.ts src/lib/health/checks/web.ts src/lib/health/health-utils.test.ts
git commit -m "feat(health): report response percentiles and image delivery"
```

### Task 4: Servicios externos y tareas programadas

**Files:**
- Modify: `src/lib/health/types.ts`
- Modify: `src/lib/health/checks/integrations.ts`
- Modify: `src/lib/health/checks/integrity.ts`
- Create: `src/lib/health/checks/integrations.test.ts`

**Interfaces:**
- Produces: `ServiceHealthEntry[]` y `ScheduledTaskHealth[]` desde los resultados existentes, variables presentes y fuentes de datos comprobables.

- [ ] **Step 1: Escribir pruebas fallidas de servicios**

Cubrir Supabase accesible, Upstash no configurado, Telegram configurado pero con timeout, Turnstile parcialmente configurado, Cloudflare verificado y pagos sin implementación. Verificar que nunca aparecen valores de variables.

- [ ] **Step 2: Escribir pruebas fallidas de tareas**

Cubrir ciclo de suscripciones reciente, ejecución vencida, fuente ausente y próxima ejecución no consultable (`null`, no inventada).

- [ ] **Step 3: Confirmar los fallos**

Run: `npx vitest run src/lib/health/checks/integrations.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implementar resultados aislados**

Reutilizar checks existentes cuando ya prueban el servicio. Para verificaciones nuevas, usar timeout máximo de 8 segundos, destinos fijos y `Promise.allSettled` o `runCheck()` para que un fallo no cancele el conjunto.

- [ ] **Step 5: Implementar tareas con evidencia disponible**

Derivar última ejecución y duración solo desde fuentes actuales. Usar `unknown` y explicar la fuente faltante cuando no exista bitácora consultable.

- [ ] **Step 6: Verificar y guardar**

Run: `npx vitest run src/lib/health/checks/integrations.test.ts`
Expected: PASS.

```bash
git add src/lib/health/types.ts src/lib/health/checks/integrations.ts src/lib/health/checks/integrity.ts src/lib/health/checks/integrations.test.ts
git commit -m "feat(health): expose service and scheduled task health"
```

### Task 5: Acciones guiadas y composición del reporte

**Files:**
- Modify: `src/lib/health/types.ts`
- Modify: `src/lib/health/run.ts`
- Create: `src/lib/health/run.test.ts`
- Modify: `src/lib/health/core.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: `HealthGuidedAction`, `sanitizeGuidedActions(actions)`, y un `HealthReport` con `comparison`, `executiveSummary`, `deployment`, `serviceHealth`, `scheduledTasks` y `scope`.

- [ ] **Step 1: Escribir pruebas fallidas del reporte**

Afirmar que hay comparación cuando existe ejecución anterior, `not_comparable` cuando falta, resumen parcial si existe cualquier fuente `unknown`, y que un fallo de historial no impide devolver el reporte actual.

- [ ] **Step 2: Escribir prueba de sanitización**

Afirmar que permite nombres de variables, rutas relativas y comandos de la lista admitida, pero elimina valores, encabezados de autorización y URLs firmadas.

- [ ] **Step 3: Confirmar los fallos**

Run: `npx vitest run src/lib/health/run.test.ts`
Expected: FAIL.

- [ ] **Step 4: Componer el reporte antes de persistir**

Leer la ejecución anterior en paralelo con checks que no dependan de ella; calcular comparación, prioridad y resumen; persistir después sin incluir material sensible.

- [ ] **Step 5: Añadir acciones estructuradas**

Usar tipos `file | env | command | dashboard | documentation`; mantener `recommendation` para compatibilidad y generar acciones solo cuando el check tenga evidencia suficiente.

- [ ] **Step 6: Verificar y guardar**

Run: `npx vitest run src/lib/health/run.test.ts src/lib/health/comparison.test.ts src/lib/health/history.test.ts`
Expected: PASS.

```bash
git add src/lib/health/types.ts src/lib/health/core.ts src/lib/health/run.ts src/lib/health/run.test.ts
git commit -m "feat(health): compose operational diagnostic reports"
```

### Task 6: Cabecera y paneles operativos

**Files:**
- Create: `src/components/superadmin/system-health/ExecutiveHealthSummary.tsx`
- Create: `src/components/superadmin/system-health/OperationalHealthPanels.tsx`
- Modify: `src/components/superadmin/system-health/SystemHealthDashboard.tsx`
- Modify: `src/components/superadmin/system-health/CheckDetailSheet.tsx`
- Modify: `src/components/superadmin/system-health/SystemHealthDashboard.test.tsx`

**Interfaces:**
- Consumes: `HealthReport` ampliado por Task 5.
- Produces: resumen ejecutivo accesible, indicadores de cambio, paneles técnicos y acciones guiadas copiables sin ejecución.

- [ ] **Step 1: Ampliar pruebas de interfaz para la cabecera**

Probar etiquetas “Nuevo”, “Empeoró”, “Resuelto”, “Comprobación parcial” y “Sin comparación anterior”, además de críticos, advertencias y servicios degradados.

- [ ] **Step 2: Añadir pruebas de acciones seguras**

Abrir el detalle, verificar impacto/módulo/acción, y confirmar que copiar no ejecuta comandos ni dispara mutaciones.

- [ ] **Step 3: Confirmar los fallos**

Run: `npx vitest run src/components/superadmin/system-health/SystemHealthDashboard.test.tsx`
Expected: FAIL por UI ausente.

- [ ] **Step 4: Crear `ExecutiveHealthSummary`**

Separar la cabecera del dashboard grande. Usar texto además de color/iconos, tarjetas responsivas y `aria-live` solo para la finalización del diagnóstico.

- [ ] **Step 5: Crear `OperationalHealthPanels`**

Mostrar despliegue, migraciones, servicios, tareas, rendimiento e imágenes. Los valores ausentes deben incluir la razón; no usar guiones ambiguos cuando corresponda `No verificable`.

- [ ] **Step 6: Integrar cambios y detalle**

Ordenar problemas con `prioritizeHealthChecks`, mostrar badges de cambio e incorporar acciones estructuradas en `CheckDetailSheet`.

- [ ] **Step 7: Verificar y guardar**

Run: `npx vitest run src/components/superadmin/system-health/SystemHealthDashboard.test.tsx`
Expected: PASS.

```bash
git add src/components/superadmin/system-health/ExecutiveHealthSummary.tsx src/components/superadmin/system-health/OperationalHealthPanels.tsx src/components/superadmin/system-health/SystemHealthDashboard.tsx src/components/superadmin/system-health/CheckDetailSheet.tsx src/components/superadmin/system-health/SystemHealthDashboard.test.tsx
git commit -m "feat(health): add operational system health overview"
```

### Task 7: Historial por ejecución y verificación integral

**Files:**
- Modify: `src/components/superadmin/system-health/HealthHistoryPanel.tsx`
- Modify: `src/components/superadmin/system-health/SystemHealthDashboard.test.tsx`
- Modify: `docs/plans/2026-10-02-system-health-operational-dashboard-design.md` only if implementation evidence requires a documented correction.

**Interfaces:**
- Consumes: `HealthRunSummary[]` de Task 2.
- Produces: vista resumida por ejecución con expansión al detalle existente.

- [ ] **Step 1: Escribir prueba fallida del historial agrupado**

Probar dos ejecuciones, conteos por estado, orden descendente, expansión accesible y filtros sin resultados.

- [ ] **Step 2: Confirmar el fallo**

Run: `npx vitest run src/components/superadmin/system-health/SystemHealthDashboard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar agrupación visual**

Mostrar una fila por `runId` con fecha, alcance, duración y conteos; expandir las comprobaciones sin perder los filtros actuales.

- [ ] **Step 4: Ejecutar pruebas enfocadas completas**

Run: `npx vitest run src/lib/health/*.test.ts src/lib/health/checks/integrations.test.ts src/components/superadmin/system-health/SystemHealthDashboard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Ejecutar controles estáticos**

Run: `npm run typecheck`
Expected: exit 0.

Run: `npx eslint src/lib/health src/components/superadmin/system-health src/app/superadmin/system-health/actions.ts`
Expected: exit 0.

Run: `git diff --check`
Expected: sin salida.

- [ ] **Step 6: Validar build y navegador sin sobreafirmar**

Run: `npm run build:turbo`
Expected: exit 0; si vuelve a quedar bloqueado sin error, detenerlo, restaurar solo artefactos generados y reportar el build como no verificado.

En un entorno autenticado, abrir `/superadmin/system-health`, ejecutar el diagnóstico y comprobar responsive, teclado, detalle y degradación parcial. Si no hay sesión/entorno, registrar la limitación.

- [ ] **Step 7: Commit final**

```bash
git add src/components/superadmin/system-health/HealthHistoryPanel.tsx src/components/superadmin/system-health/SystemHealthDashboard.test.tsx
git commit -m "feat(health): summarize diagnostic history by run"
```
