# Reputacion verificada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar reseñas abiertas y verificadas con moderacion auditable, respuestas del negocio y una experiencia publica transparente.

**Architecture:** Una migracion aditiva extiende `organization_reviews` y crea invitaciones de un solo uso. La logica compartida normaliza estados, estadisticas y etiquetas; las rutas publicas y administrativas consumen ese contrato sin exponer datos internos. Las interfaces publica y administrativa presentan el mismo estado y la misma procedencia.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, Supabase/Postgres, SWR, Vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-13-reputacion-verificada.md`

## Global Constraints

- Conservar las reseñas existentes como `published` y `open`.
- No ejecutar migraciones remotas sin autorizacion explicita.
- Mantener aislamiento por `organization_id` y no exponer PII publicamente.
- No ponderar silenciosamente las reseñas verificadas.
- No agregar dependencias nuevas.

---

### Task 1: Contrato de dominio y migracion

**Files:**
- Create: `src/lib/reviews/review-domain.ts`
- Create: `src/lib/reviews/review-domain.test.ts`
- Create: `supabase/migrations/20260913090000_verified_organization_reviews.sql`

**Interfaces:**
- Produces: `ReviewStatus`, `ReviewVerificationType`, `getReviewStatus`, `calculateReviewStats` y columnas de confianza.

- [ ] Escribir pruebas que exijan estados separados, estadisticas publicas consistentes y promedio verificado independiente.
- [ ] Ejecutar `npm test -- src/lib/reviews/review-domain.test.ts` y confirmar que falla.
- [ ] Implementar la logica minima y ejecutar nuevamente la prueba.
- [ ] Crear la migracion aditiva, RLS, indices, backfill y trigger de estadisticas.
- [ ] Ejecutar las pruebas de dominio y revisar el SQL sin aplicar remotamente.

### Task 2: API publica transparente y paginada

**Files:**
- Modify: `src/app/api/public/reviews/route.ts`
- Create: `src/app/api/public/reviews/route.test.ts`
- Create: `src/lib/security/turnstile.ts`
- Create: `src/lib/security/turnstile.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: estados y tipos del Task 1.
- Produces: GET con filtros, distribucion y metricas; POST con mensaje de moderacion, limite por tenant/IP y verificacion opcional de invitacion.

- [ ] Escribir pruebas de contrato para campos publicos, mensajes y aislamiento de rate limit.
- [ ] Ejecutar las pruebas y confirmar el fallo.
- [ ] Implementar validacion Turnstile y contrato publico sin exponer datos internos.
- [ ] Ejecutar las pruebas enfocadas.

### Task 3: Moderacion administrativa y respuestas

**Files:**
- Modify: `src/app/api/admin/reviews/route.ts`
- Modify: `src/app/api/admin/reviews/[id]/route.ts`
- Modify: `src/test/admin-reviews.test.ts`

**Interfaces:**
- Produces: filtros por `status`/`verification`, acciones explicitas y respuesta publica con motivo de moderacion.

- [ ] Actualizar pruebas para estados reales, ausencia de borrado ordinario y estadisticas publicadas.
- [ ] Ejecutar las pruebas y confirmar el fallo.
- [ ] Implementar handlers tenant-scoped y validacion Zod.
- [ ] Ejecutar pruebas de API administrativa.

### Task 4: Interfaz publica de confianza

**Files:**
- Modify: `src/components/public/inicio/OrganizationReviews.tsx`
- Create: `src/components/public/inicio/OrganizationReviews.test.tsx`

**Interfaces:**
- Consumes: contrato publico del Task 2.
- Produces: filtros, paginacion, badges, respuestas, estados y formulario accesible.

- [ ] Escribir pruebas para mensaje pendiente, verificacion visible y paginacion real.
- [ ] Ejecutar y confirmar el fallo.
- [ ] Implementar la interfaz responsive y accesible.
- [ ] Ejecutar pruebas de componente.

### Task 5: Bandeja administrativa de reputacion

**Files:**
- Modify: `src/components/admin/reviews/reviews-management.tsx`
- Modify: `src/app/admin/reviews/page.tsx`

**Interfaces:**
- Consumes: contrato administrativo del Task 3.
- Produces: filtros de confianza, respuesta, moderacion con motivo, enlace correcto y copy neutral.

- [ ] Añadir cobertura contractual del enlace canonico, estados y respuesta.
- [ ] Ejecutar y confirmar el fallo.
- [ ] Implementar cambios manteniendo tabla y tarjetas existentes.
- [ ] Ejecutar pruebas enfocadas.

### Task 6: Verificacion integral

**Files:**
- Review: todos los archivos modificados.

- [ ] Ejecutar pruebas enfocadas de reseñas.
- [ ] Ejecutar `npm run typecheck`.
- [ ] Ejecutar ESLint sobre archivos modificados.
- [ ] Ejecutar `npm run build`.
- [ ] Ejecutar `git diff --check` y revisar que no existan secretos.
- [ ] Documentar la migracion pendiente y los resultados reales.
