# System Health Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar `/superadmin/system-health` sin errores reales y con advertencias únicamente accionables, desplegando primero las correcciones ya verificadas y cerrando legal, CSP, multi-tenant, webhooks, rendimiento de imágenes y observabilidad con evidencia de producción.

**Architecture:** Tratar el despliegue de `origin/update-nextjs-16.3` como la primera dependencia: `origin/main` es ancestro directo y está 24 commits detrás, mientras Vercel despliega `main`. Después de ese fast-forward se vuelve a medir producción y sólo se implementan cambios adicionales para hallazgos persistentes. Seguridad de Storage/RLS se verifica en Supabase con consultas de sólo lectura; rendimiento se corrige en la política compartida de imágenes y en los cinco archivos pesados; observabilidad usa un proveedor externo sólo tras decisión explícita.

**Tech Stack:** Next.js 16.3, TypeScript, Vitest, Supabase/Postgres/RLS/Storage, Vercel, Cloudflare, Pagopar.

**Spec:** Auditoría de `/superadmin/system-health` realizada el 2026-09-29 contra `https://mitiendapy.com` y el proyecto Supabase remoto.

## Global Constraints

- No force-push, no reset y no descarte de cambios del checkout principal; contiene trabajo local ajeno.
- La promoción a `main` debe ser fast-forward desde un checkout aislado y sólo después de CI verde.
- No volver público `repair-images`; toda lectura permanece autorizada y firmada.
- No probar Pagopar con un pago real sin confirmación explícita; usar sandbox o una operación controlada.
- No publicar secretos, payloads, firmas, tokens, PII ni nombres de objetos de Storage en el diagnóstico.
- No activar un servicio externo de observabilidad sin la elección y credenciales del usuario.
- Medir producción antes y después; no declarar resuelto un hallazgo por pruebas estáticas solamente.

## Review Focus

- Vercel sigue desplegando un SHA anterior aunque `main` avance: verificar SHA/deployment y headers, no sólo Git.
- Las páginas legales están publicadas en DB pero un caché/deploy anterior responde 404: comprobar invalidación y respuesta anónima 200.
- Una política `PERMISSIVE` amplia con una `RESTRICTIVE` compatible es efectiva por AND: no reportarla como fuga, pero sí conservar evidencia.
- La optimización de imágenes no debe transformar dos veces hosts ya optimizados ni aumentar costos innecesarios de Vercel.
- Un webhook sintético no debe alterar una suscripción real ni guardar el payload; el smoke debe ser sandbox/controlado e idempotente.

---

### Task 1: Promover el release verificado a producción

**Files:**
- Verify: `.github/workflows/ci.yml`
- Verify: `.github/workflows/deploy.yml`
- Verify: `next.config.ts`
- Verify: `docs/superpowers/plans/2026-09-27-private-repair-images.md`

**Interfaces:**
- Consumes: `origin/update-nextjs-16.3` en `d0fa7b08`; `origin/main` en `1c6d5ec6`, confirmado como ancestro directo.
- Produces: `origin/main` y el deployment Production de Vercel en el mismo SHA verificado.

- [ ] **Step 1: Crear o reutilizar un worktree limpio desde `origin/main` y repetir `git fetch --prune`, `git status --short`, `git worktree list`, `git rev-list --left-right --count origin/main...origin/update-nextjs-16.3` y `git merge-base --is-ancestor origin/main origin/update-nextjs-16.3`.** Esperado: árbol limpio, divergencia `0 24` y fast-forward válido.
- [ ] **Step 2: Ejecutar en el SHA candidato** `npm run typecheck:fast`, `npm run lint`, las suites focalizadas de legal/health/RLS/Storage y `npm run build`. Esperado: 0 errores; documentar advertencias preexistentes sin presentarlas como éxito global.
- [ ] **Step 3: Promover mediante PR o fast-forward protegido a `main`**, nunca con force-push. Commit/merge: `release: promote system health hardening` sólo si Git necesita un merge commit; si es fast-forward, conservar los commits existentes.
- [ ] **Step 4: Esperar GitHub Actions y Vercel Production**, registrar URL, deployment id y SHA. Fallar la tarea si Vercel no despliega `main` o si el SHA no coincide.
- [ ] **Step 5: Verificar producción anónimamente:** CSP efectiva, `/saas/privacidad` 200, `/saas/terminos` 200, `repair-images` privado, imágenes de reparación con URL firmada y acceso público directo denegado.

### Task 2: Cerrar legales y enlaces rotos después del deploy

**Files:**
- Modify only if the post-deploy smoke still fails: `src/app/superadmin/web-content/legal/actions.ts`
- Modify only if needed: `src/lib/legal/documents.ts`
- Test: `src/components/legal/legal.test.tsx`
- Test/Create if missing: `src/app/superadmin/web-content/legal/actions.test.ts`
- Test: `src/test/public-seo-health-contract.test.ts`

**Interfaces:**
- Consumes: documentos `privacy` y `terms` versión 1, estado `published`, publicados el 2026-09-29 a las 18:39 de Asunción.
- Produces: publicación que invalida tag y páginas; ambos enlaces responden 200 inmediatamente.

- [ ] **Step 1: Repetir el smoke anónimo de las dos rutas tras Task 1.** Si ambas responden 200, registrar que los dos enlaces rotos eran consecuencia del deploy atrasado y no cambiar código.
- [ ] **Step 2: Sólo si persiste el 404, escribir una prueba fallida** donde `publishLegalDocumentAction()` invoque `revalidateTag(LEGAL_DOCUMENTS_TAG, 'max')` y `revalidatePath(path, 'page')` para ambos documentos.
- [ ] **Step 3: Implementar la invalidación mínima** sin exponer borradores ni quitar `notFound()` cuando no existe una versión publicada.
- [ ] **Step 4: Ejecutar** `npx vitest run src/components/legal/legal.test.tsx src/lib/legal/legal-migration.test.ts src/test/public-seo-health-contract.test.ts` y la nueva prueba de acción. Esperado: PASS.
- [ ] **Step 5: Desplegar y confirmar** `/saas/privacidad` y `/saas/terminos` en 200, enlazadas desde `/saas`, sin que un borrador sea accesible.
- [ ] **Step 6: Commit sólo si hubo cambio:** `fix(legal): invalidate published document pages`.

### Task 3: Convertir los cinco avisos multi-tenant restantes en información correcta

**Files:**
- Modify: `src/lib/health/tenant-isolation.ts`
- Test: `src/lib/health/tenant-isolation.test.ts`
- Verify: `supabase/migrations/20260928004000_reapply_global_content_policies.sql`

**Interfaces:**
- Consumes: políticas remotas ya endurecidas; sólo quedan `cash_closures`, `cash_registers`, `product_alerts`, `product_movements` y `website_settings`, todas acotadas por una política `RESTRICTIVE` compatible.
- Produces: `analyzeTable()` mantiene una razón informativa pero devuelve `healthy/info` cuando toda rama amplia está efectivamente acotada para el mismo comando y rol.

- [ ] **Step 1: Agregar pruebas fallidas** para PERMISSIVE amplia + RESTRICTIVE scoped compatible (healthy), comando no compatible (warning/error), rol no compatible (warning/error) y tabla realmente abierta (error).
- [ ] **Step 2: Ajustar `policyIssues()`** para no añadir un `Issue` cuando la rama está efectivamente acotada; conservar el texto explicativo en el resultado saludable mediante metadata/razón segura, sin relajar la clasificación de políticas no protegidas.
- [ ] **Step 3: Ejecutar** `npx vitest run src/lib/health/tenant-isolation.test.ts src/lib/health/health-utils.test.ts`. Esperado: PASS y las cinco tablas remotas clasificadas como saludables.
- [ ] **Step 4: Ejecutar consulta remota de sólo lectura** a `get_system_health_catalog()` y confirmar 0 warnings/críticos sin modificar políticas.
- [ ] **Step 5: Commit:** `fix(health): recognize restrictive tenant guards`.

### Task 4: Validar el webhook Pagopar con evidencia real

**Files:**
- Verify/modify if a defect appears: `src/app/api/payments/pagopar/webhook/route.ts`
- Verify/modify if needed: `src/lib/health/webhook-log.ts`
- Test: `src/lib/health/health-utils.test.ts`
- Create if missing: `src/app/api/payments/pagopar/webhook/route.test.ts`

**Interfaces:**
- Consumes: 18 pagos históricos Pagopar, todos `failed`, y 0 filas en `payment_webhook_events`.
- Produces: al menos un evento controlado `processed`, `ignored` o `rejected` con endpoint, status y código corto; nunca payload/token/firma.

- [ ] **Step 1: Escribir pruebas del handler** para payload inválido, token inválido, pago inexistente, pago aplicado, reintento idempotente y fallo de RPC; afirmar que el registrador recibe sólo campos sanitizados.
- [ ] **Step 2: Ejecutar** `npx vitest run src/app/api/payments/pagopar/webhook/route.test.ts src/lib/health/health-utils.test.ts`. Esperado: PASS.
- [ ] **Step 3: Configurar en Pagopar sandbox la URL Production exacta** y enviar una notificación controlada. Si no hay sandbox disponible, detener la tarea y pedir autorización antes de una operación real.
- [ ] **Step 4: Consultar `payment_webhook_events`** y verificar endpoint, resultado, HTTP, ausencia de secretos y actualización idempotente de la suscripción de prueba.
- [ ] **Step 5: Si el código falla, aplicar el arreglo mínimo y repetir tests/smoke; si funciona, no modificarlo.** Commit sólo si hubo cambio: `fix(payments): verify pagopar webhook delivery`.

### Task 5: Activar CSP efectiva y validar compatibilidad

**Files:**
- Verify: `next.config.ts`
- Test: `src/test/production-hardening.test.ts`
- Test: `src/test/public-seo-health-contract.test.ts`

**Interfaces:**
- Consumes: CSP enforce ya presente en `next.config.ts`; producción antigua aún responde sólo `Content-Security-Policy-Report-Only`.
- Produces: header `Content-Security-Policy` efectivo sin violaciones que rompan Supabase, Turnstile, imágenes, fuentes o navegación.

- [ ] **Step 1: Tras Task 1, comprobar con una petición real** que existe `Content-Security-Policy` y que `Report-Only` no es el único header.
- [ ] **Step 2: Ejecutar navegador autenticado y anónimo** sobre `/saas`, `/login`, `/register`, marketplace, dashboard y una reparación; revisar consola/red para violaciones CSP.
- [ ] **Step 3: Si hay un origen legítimo bloqueado, escribir primero una prueba de configuración y agregar sólo ese origen a la directiva mínima; nunca usar `*`.**
- [ ] **Step 4: Ejecutar** `npx vitest run src/test/production-hardening.test.ts src/test/public-seo-health-contract.test.ts` y `npm run build`.
- [ ] **Step 5: Commit sólo si hubo cambio:** `fix(security): enforce production CSP`.

### Task 6: Reducir imágenes sin optimizar y los cinco recursos pesados

**Files:**
- Preserve/complete current local change: `src/components/ui/app-image.tsx`
- Preserve/verify: `src/components/ui/app-image.test.tsx`
- Verify: `src/lib/images.ts`
- Test: `src/lib/image-url-policy.test.ts`
- Modify assets: `public/images/products/campera-softshell-corporativa.jpg`
- Modify assets: `public/images/products/remera-polo-corporativa.jpg`
- Modify relevant logo/product upload flows after tracing their owners.
- Verify: `scripts/post-build-checks.mjs`

**Interfaces:**
- Consumes: detección actual de 25 imágenes raster directas y cinco recursos de 543–1403 KB; existe un cambio local no confirmado que reemplaza `AppImage` con la política selectiva `shouldBypassImageOptimization()`.
- Produces: Supabase y assets locales optimizados selectivamente; SVG/data/blob/hosts ya optimizados mantienen bypass; imágenes de Supabase usan Next Image cuando aporta valor.

- [ ] **Step 1: Preservar el cambio local de `AppImage` en un parche/commit aislado**, sin arrastrar la refactorización Superadmin del checkout principal.
- [ ] **Step 2: Ejecutar las pruebas existentes de política:** `npx vitest run src/components/ui/app-image.test.tsx src/lib/image-url-policy.test.ts`. Deben cubrir Supabase optimizado, SVG/data bypass y override explícito.
- [ ] **Step 3: Medir antes de transformar:** registrar bytes, dimensiones, formato y consumidor de los cinco recursos; fijar presupuesto de 200 KB por imagen pública y dimensiones máximas por uso.
- [ ] **Step 4: Convertir los dos JPEG locales a WebP/AVIF**, actualizar referencias y mantener dimensiones/aspect ratio. Verificar visualmente desktop/móvil.
- [ ] **Step 5: Para los tres objetos remotos, crear copias optimizadas con nombres nuevos, actualizar las referencias DB autoritativas y verificar el consumidor público antes de considerar el objeto anterior para limpieza.** No sobrescribir ni borrar originales en esta tarea.
- [ ] **Step 6: Añadir compresión/redimensionamiento a los flujos de subida propietarios** con límites por tipo (logo/producto) y pruebas de MIME/tamaño; reutilizar `browser-image-compression` ya instalado, sin nueva dependencia.
- [ ] **Step 7: Repetir el diagnóstico:** objetivo 0 recursos >400 KB y reducción material de las 25 imágenes directas; registrar cualquier excepción deliberada.
- [ ] **Step 8: Ejecutar** tests focalizados, `npm run typecheck:fast`, `npm run lint`, `npm run build` y post-build 14/14.
- [ ] **Step 9: Commit por dos unidades:** `perf(images): enable selective optimization` y `perf(assets): compress public catalog images`.

### Task 7: Añadir observabilidad persistente sin filtrar PII

**Files:**
- Modify: `src/lib/logger.ts`
- Modify: `src/lib/health/checks/integrations.ts`
- Modify: `.env.example`
- Create provider configuration/tests only after the user chooses Sentry or Vercel Log Drain.
- Test: `src/lib/health/health-utils.test.ts`

**Interfaces:**
- Consumes: tres error boundaries y logs efímeros; `logger.error()` actualmente reduce todo error de producción a `An error occurred`.
- Produces: eventos persistentes con código, ruta/subsistema, request id y stack privado; sin tokens, payloads de pago, correo, IP completa ni datos de reparación.

- [ ] **Step 1: Decisión humana obligatoria:** elegir Sentry (recomendado para stack y trazas) o Vercel Log Drain (menos cambio en app). No crear cuenta ni instalar SDK sin autorización.
- [ ] **Step 2: Escribir pruebas de sanitización** para Error, objetos con campos sensibles, Supabase errors y contexto de petición; afirmar redacción de token, authorization, cookie, email, payment payload y URLs firmadas.
- [ ] **Step 3: Introducir una interfaz `ErrorReporter.capture(error, context)`** y adaptar `logger.error` manteniendo consola como fallback; el cliente externo vive sólo en servidor salvo que se apruebe captura browser.
- [ ] **Step 4: Integrar `global-error.tsx`, `superadmin/error.tsx` y `dashboard/pos/error.tsx`** con identificadores de evento mostrables al usuario, sin stack público.
- [ ] **Step 5: Actualizar el health check** para verificar configuración y una señal reciente, no sólo la presencia de `SENTRY_DSN`.
- [ ] **Step 6: Enviar un error sintético no sensible en preview y Production**, confirmar retención/alerta y que `/superadmin/system-health` cambie a saludable.
- [ ] **Step 7: Ejecutar tests focalizados, typecheck, lint y build. Commit:** `feat(observability): retain sanitized production errors`.

### Task 8: Cierre de release y regresión completa

**Files:**
- Verify: `src/components/superadmin/system-health/SystemHealthDashboard.test.tsx`
- Verify: all files touched by Tasks 2–7.

**Interfaces:**
- Consumes: todos los entregables anteriores.
- Produces: informe final con estado real, excepciones justificadas y rollback.

- [ ] **Step 1: Ejecutar suites focalizadas**, migraciones contractuales, typecheck, lint, `git diff --check` y build/post-build.
- [ ] **Step 2: Ejecutar la suite global** y separar fallos nuevos de baseline; no ocultar timeouts ni advertencias.
- [ ] **Step 3: Repetir `/superadmin/system-health` dos veces** para descartar caché/transitorios y exportar cada detalle restante.
- [ ] **Step 4: Smoke autenticado/anónimo:** legales, registro/login con Turnstile, catálogo/marketplace, reparación privada, webhook sandbox y página Superadmin.
- [ ] **Step 5: Confirmar rollback:** Git revert para código/assets; conservar originales remotos; migraciones RLS sólo hacia adelante con políticas previas documentadas, nunca desactivar RLS.
- [ ] **Step 6: Publicar el resumen final** con SHA de Git/Vercel, migraciones remotas, checks verdes, hallazgos diferidos y evidencia de producción.
