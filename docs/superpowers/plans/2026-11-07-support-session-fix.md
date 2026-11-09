# Support Session Validation and Exit Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
**Goal:** Corregir validación y cierre de soporte sin ampliar permisos.
**Architecture:** Exigir actor explícito autenticado en lectura/cierre, conservar cookie cuando falle persistencia y mostrar errores recuperables. Compartir límites del motivo. Timer de vencimiento con un refresco. El modo sigue sin cambiar usuario ni abrir un panel operativo.
**Tech Stack:** Next, React, Supabase client existente, Vitest mocks.
**Spec:** Usuario autorizó expresamente corregir validación y cierre sin ampliar permisos. Auditoría en docs/audits/2026-11-07-organization-support.md.
## Global Constraints
Sin producción, migraciones, cambios de rol, nuevos permisos, push o deploy. TTL de 30 minutos y cookies HttpOnly/SameSite/Secure sin cambio.
## Review Focus
- Cookie de otra cuenta o de otra organización no es válida para el actor actual.
- Un error de cierre conserva la cookie y el banner para reintentar.
- Expiración detiene el temporizador y refresca una sola vez.
- Motivo se valida en servidor incluso si el cliente no aplica límites.
- Operaciones siguen exigiendo superadmin y no ganan acceso nuevo.
## Tasks
- [x] Pruebas fallidas de actor, cierre fallido, API y banner.
- [x] Helpers/API/layout con actor y manejo de errores.
- [x] UI con errores, pausa de envíos repetidos y vencimiento correcto.
- [x] Tipos/lint/pruebas/navegador simulado y revisión independiente. Sin sesiones reales.

## Evidencia
Se reprodujeron 10 fallos antes de corregir. Resultado final: 23 pruebas enfocadas en 5 archivos, TypeScript raíz y ESLint limpios; diff-check sin errores. Navegador claro/oscuro 375/1440 con solicitudes simuladas: error, reintento e inicio correctos. Revisión independiente no encontró ampliación de permisos. No sesiones reales ni DB/migraciones.
