# Superadmin Subscriptions Audit and UX Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
**Goal:** Auditar y mejorar /superadmin/subscriptions?q=mitiendademo conservando contratos de cobro y permisos.
**Architecture:** UI de consulta primero, edición con revisión y cobro manual con confirmación. Helpers puros para preservar fechas y validar borradores. Mantener APIs/RPC existentes y cambios de Claude, especialmente ruta de pagos y formulario manual.
**Tech Stack:** Next, React, Radix, Tailwind, Vitest.
**Spec:** Continuación del rediseño de superadmin solicitado por el usuario; consulta/edición/pago separados, filtros legibles, datos comerciales honestos y guardado seguro.
## Global Constraints
Sin cobros reales, cambios de suscripción reales, Supabase remoto, migraciones, push/deploy o permisos nuevos. Solo fixtures y API simulada. Mantener lógica de activación de pago existente.
## Review Focus
- Precio ausente no equivale a cero.
- Fechas no modificadas conservan instante y segundos; cambios se envían con zona explícita.
- Cuenta activa con fecha de prueba residual no es prueba en curso.
- Reintentos y dobles clics no duplican solicitudes, ni se cierra durante un cobro.
- Filtros vacíos se recuperan y todos los controles se usan a 375px.
## Tasks
- [x] Regresiones de fechas, pruebas en curso, filtros y precio.
- [x] Dashboard/filtros más claros y corrección de payload/estado.
- [x] Detalle consulta/edición/pago con revisión, nombres claros y navegación.
- [x] Confirmación manual con validación local, preservando la lógica de cobro de Claude.
- [x] Pruebas, tipos/lint, navegador aislado y revisión independiente.

## Verificación y decisiones
51 pruebas pasan en seis archivos. Chrome con API simulada: consulta inicial, confirmación sin POST previo, error que preserva borrador y sin desbordamiento a 375 px. Revisión independiente: corregidas fecha efectiva de prueba, navegación durante cobro y reset de pestaña.
Se conservan los contratos y la activación mensual existentes; no se prueba ni modifica producción.
