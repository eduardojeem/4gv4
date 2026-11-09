# Marketplace Plan Ads Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
**Goal:** Presentar planes como publicidad deslizable con orientación por negocio y acceso existente.
**Architecture:** Catálogo público existente, helper compartido de compatibilidad y carruseles web/native independientes. Índice derivado del desplazamiento, sin autoplay.
**Tech Stack:** React, Next, React Native, Expo 57, Vitest.
**Spec:** docs/superpowers/plans/2026-11-07-marketplace-plan-ads-design.md
## Global Constraints
Sin DB, push, merge, deploy, dependencias ni cambios ajenos. Mantener precios, pruebas y slugs publicados. Sin autoplay.
## Review Focus
- Sin funciones: no inventar compatibilidad.
- Un plan: controles sin avance inexistente.
- Error de red: retry disponible, ningún precio ficticio.
- Pantalla estrecha y texto largo: sin desborde.
- Deslizamiento manual y botones: índice coherente.
## Tasks
- [x] Agregar pruebas de compatibilidad por funciones y registro/login; comprobar fallo.
- [x] Implementar planAudiences en src/lib/public/marketplace-plan.ts y diseño en src/components/public/MarketplacePlanCarousel.tsx.
- [x] Implementar mismo comportamiento en mobile/src/components/marketplace-plan-carousel.tsx.
- [x] Ejecutar pruebas, lint y tipos en raíz/mobile. Verificar navegador 390 y 1440, navegación y reintento. Preservar cambios de Claude con hashes, sincronizar componentes de Expo si no divergieron.

## Verification ledger
14 focused tests passed. Root TypeScript and root/mobile lint passed. Web browser 390/1440 and native web preview 320/390 passed navigation, signup, login, overflow and runtime-error checks. iOS Expo bundle 200 includes audiences and signup CTA. Mobile TypeScript remains blocked only by pre-existing colors.primary errors in marketplace-location-picker.tsx; no changes to that component. No database writes.
