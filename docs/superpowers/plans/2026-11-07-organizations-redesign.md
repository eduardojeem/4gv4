# Organizations Redesign Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
**Goal:** Hacer intuitiva y legible toda la gestión de organizaciones, con edición que preserve campos no modificados.
**Architecture:** Mantener las páginas servidor y contratos actuales; reorganizar cuatro componentes cliente. Helper puro para parches de edición y búsqueda.
**Tech Stack:** Next, React, Tailwind, Radix, Vitest.
**Spec:** docs/superpowers/plans/2026-11-07-organizations-design.md
## Global Constraints
Sin cambios de DB, push, deploy, permisos o datos reales. Sin dependencias nuevas ni cambios ajenos.
## Review Focus
- Módulos heredados null y lista vacía no son equivalentes.
- Cambiar nombre no altera moneda, plan, suscripción ni zona horaria.
- Filtros sin coincidencias deben permitir limpiar y recuperarse.
- Tablas y pestañas deben funcionar a 375px y con teclado.
- Fallos de guardado preservan edición y permiten reintentar.
## Tasks
- [x] Probar y corregir parches parciales y módulos heredados en edición.
- [x] Rediseñar directorio con filtros legibles, vista móvil, estados honestos y búsqueda sin acentos.
- [x] Rediseñar ficha completa y navegación de sus cinco secciones; clipboard con error visible.
- [x] Rediseñar alta/edición por grupos con revisión y navegación claras.
- [x] Ejecutar regresión de organizaciones, types/lint, diff-check y navegador con fixtures aisladas.

## Resultado y verificación
- Directorio, ficha con cinco pestañas, alta y edición rediseñados en C:/proyecto/mitiendapy (servidor existente 3000). Sin push/commit/deploy.
- 150 pruebas de organizaciones verificadas: ejecución completa final dio 149/150; la única falla fue selector ambiguo tras traducir estado en cabecera. Se acotó al tabpanel y se repitió la suite (29/29). Último ajuste de errores visibles: diálogo/ruta 7/7. ESLint final limpio; diff acotado sin errores.
- Navegador con fixtures: 375 y 1440, claro/oscuro, filtros y búsqueda sin acentos, menús, revisión, cinco pestañas, teclado y anclas de alta: sin desborde ni pageerror. El caso de suscripción ausente exige estado explícito y envía solo plan/status, con PATCH interceptado.
- Revisión independiente encontró guardado falso positivo sin fila subscriptions. Se reprodujo con dos pruebas fallidas y corrigió la ruta para insertar con plan existente y propagar errores; revisor no encontró nuevos problemas en la corrección.
- TypeScript pasó antes de cambios concurrentes externos; última corrida bloqueada por InformaticaElectronicaHome.tsx:36, import formatGuarani no exportado. No se modificó ese archivo ni currency.ts.
- Sin DB, migraciones, correos o escrituras de producción. No se alteraron permisos ni autenticación. Servidor QA usó solo fixtures locales y APIs simuladas.
