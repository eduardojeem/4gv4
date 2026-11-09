# Organization Detail and Support Review Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
**Goal:** Mejorar la ficha de organización y auditar cómo funciona soporte.
**Architecture:** Extraer una cabecera de identidad/acciones reutilizable, conservar las cinco pestañas y métricas; navegación interna del resumen. Revisar soporte en backend/cookie/API/banner sin activar sesiones reales.
**Tech Stack:** Next, React, Tailwind, Vitest.
**Spec:** Pedido: mejorar /superadmin/organizations/mitiendademo y revisar modo soporte. Diseño comunicado: identidad/gestión/actividad separados, accesos a actividad/contacto/cuenta, conservar métricas.
## Global Constraints
Sin producción, migraciones, push/deploy ni permisos nuevos. Correcciones de validación de acceso pendientes de respuesta explícita del usuario. Preservar trabajo existente.
## Review Focus
- Cookie de soporte no debe atribuir sesión a otro superadmin.
- Expiración inválida o vencida no debe considerarse activa.
- Cierre fallido no debe anunciar éxito ni esconder el error.
- Modo soporte actual no cambia contexto ni representa una suplantación de usuario.
- Resumen, contactos y acciones deben ser legibles a 375px y con teclado.
## Tasks
- [x] Extraer cabecera y mejorar navegación visual del detalle, sin alterar datos.
- [x] Registrar auditoría con evidencias de soporte y alcance real.
- [x] Autorizado y corregido: pruebas de actor, vencimiento, cierre y validaciones; corregir preservando permisos.
- [x] Verificar regresiones, tipos/lint y navegador con fixtures; no iniciar soporte real.

## Resultado
115 pruebas enfocadas pasaron; lint limpio. Navegador a 375 y 1440 (claro/oscuro): pestañas, anclas, acciones y diálogo de soporte sin inicio real; sin desborde ni pageerror. Revisión independiente confirma hallazgos sin nuevos problemas de UI. Los cinco archivos de soporte/layout coinciden con el respaldo: auditoría de solo lectura y corrección de acceso pendiente de respuesta del usuario. Sin producción, migración, commit, push o deploy.

## Continuación autorizada
El usuario aprobó corregir validación y cierre sin ampliar permisos. Implementación y evidencia final en 2026-11-07-support-session-fix.md. El resultado previo de hashes sin cambios corresponde a la fase de auditoría; los archivos de soporte se modificaron después de esa autorización.
