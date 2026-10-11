# Auditoría de ramas — 2026-10-10

Repositorio: eduardojeem/4gv4. Referencias remotas actualizadas con fetch. Base: origin/main 4409fd2a. Auditoría de historial y sincronización, no auditoría funcional de cada versión ni validación de CI/despliegue.

## Hallazgos prioritarios

1. Hay trabajo sin commit en 5 de 18 worktrees. No borrar ni archivar sin revisar y preservar esos archivos. El resto está limpio respecto de archivos versionados/no ignorados; los archivos ignorados no se inventariaron.
2. codex/beauty-services está sincronizada con su remoto pero tiene 3 commits fuera de main: 4e09d3e2 (caja móvil), d8656761 (mapa de tienda), 5bddf80f (enlace del marketplace). Main tiene 2 merge commits ausentes en esta rama. Falta integración y validación de CI; estar subido no significa publicado.
3. codex/system-health-dashboard tiene 9 commits exclusivos por historial y no tiene upstream. git cherry indica 8 parches equivalentes en main y solo e6743c66 sin equivalente exacto. No integrar automáticamente los 9: comparar el resultado actual y rescatar únicamente lo necesario. La comparación directa de componentes muestra diferencias en SystemHealthDashboard.tsx y su test; no equivale a 9 funcionalidades nuevas pendientes.
4. main local está 26 commits detrás de origin/main, sin commits exclusivos. Conviene actualizarla por fast-forward cuando se decida trabajar allí.
5. Cuatro ramas siguen un remoto de distinto nombre: fix/admin-navigation-ux → origin/update-nextjs-16.3; fix/server-only-cash-rpcs, fix/supabase-function-lint y fix/supabase-security-advisors → origin/main. Puede ser intencional, pero revisar antes de pull/push y usar destinos explícitos.
6. Cuatro ramas sin upstream: claude/practical-blackwell-dbe851, codex/global-catalog-hardening, codex/system-health-dashboard, fix/dashboard-profile-hardening.

## Trabajo sin commit

| Rama / worktree | Archivos pendientes |
| --- | --- |
| claude/practical-blackwell-dbe851 — .claude/worktrees/dreamy-wiles-d22b44 | globals.css, accessibility-context.tsx, use-accessibility.ts, accessibility.css modificados; accessibility-font-size.ts y test nuevos |
| claude/nostalgic-williamson-d2662e | branding.ts y swr-provider.tsx modificados; logo y carpeta de tests nuevos |
| chore/eslint-quality-remediation | eslint-current.json nuevo |
| fix/private-repair-images | next.config.ts, app-image.test.tsx, code-audit.json, image-url-policy.test.ts, images.ts modificados; vercel-image-optimization-policy.test.ts nuevo |
| agents/capabilities-overview | saas/negocios/page.tsx y saas-business-page-content.tsx modificados |

No se encontraron stashes. Los 18 worktrees registrados existen; 3 están en HEAD separado (professional-booking y dos worktrees temporales de verificación). No se evaluó la conservación de archivos ignorados ni la política de respaldo.

## Inventario completo

Hay 24 ramas locales y 32 remotas (sin contar origin/HEAD). Atrasada/exclusivos se comparan con origin/main; seguimiento se compara con su upstream. Cero exclusivos indica que el tip ya es ancestro de main, pero no autoriza a borrar un worktree con archivos pendientes.

| Referencia | Atrasada vs main | Commits exclusivos | Upstream | Seguimiento |
| --- | ---: | ---: | --- | --- |
| agents/capabilities-overview | 984 | 0 | origin/agents/capabilities-overview | [behind 920] |
| audit/public-sections | 64 | 0 | origin/audit/public-sections | — |
| chore/eslint-quality-remediation | 353 | 0 | origin/chore/eslint-quality-remediation | [behind 289] |
| claude/dreamy-wiles-d22b44 | 64 | 0 | origin/claude/dreamy-wiles-d22b44 | — |
| claude/nostalgic-williamson-d2662e | 990 | 0 | origin/claude/nostalgic-williamson-d2662e | [behind 926] |
| claude/practical-blackwell-dbe851 | 198 | 0 | Sin upstream | — |
| codex/admin-finances | 877 | 0 | origin/codex/admin-finances | [behind 813] |
| codex/beauty-services | 2 | 3 | origin/codex/beauty-services | — |
| codex/global-catalog-hardening | 132 | 0 | Sin upstream | — |
| codex/release-all-20261008 | 38 | 0 | origin/codex/release-all-20261008 | [behind 8] |
| codex/system-health-dashboard | 168 | 9 | Sin upstream | — |
| feature/marketplace-profile-sync | 554 | 0 | origin/feature/marketplace-profile-sync | [behind 490] |
| feature/organization-business-profile | 670 | 0 | origin/feature/organization-business-profile | [behind 606] |
| feature/pos-product-credit | 64 | 0 | origin/feature/pos-product-credit | — |
| fix/admin-navigation-ux | 281 | 0 | origin/update-nextjs-16.3 | [behind 217] |
| fix/dashboard-profile-hardening | 252 | 0 | Sin upstream | — |
| fix/private-repair-images | 198 | 0 | origin/fix/private-repair-images | [behind 134] |
| fix/server-only-cash-rpcs | 263 | 0 | origin/main | [behind 263] |
| fix/supabase-function-lint | 64 | 0 | origin/main | [behind 64] |
| fix/supabase-security-advisors | 64 | 0 | origin/main | [behind 64] |
| main | 26 | 0 | origin/main | [behind 26] |
| perf/audit-optimizations | 64 | 0 | origin/perf/audit-optimizations | — |
| security/private-tenant-isolation | 633 | 0 | origin/security/private-tenant-isolation | [behind 569] |
| update-nextjs-16.3 | 64 | 0 | origin/update-nextjs-16.3 | — |
| origin/agents/capabilities-overview | 64 | 0 | Sin upstream | — |
| origin/audit/public-sections | 64 | 0 | Sin upstream | — |
| origin/chore/eslint-quality-remediation | 64 | 0 | Sin upstream | — |
| origin/claude/csp-violations-jdrg5s | 64 | 0 | Sin upstream | — |
| origin/claude/dreamy-wiles-d22b44 | 64 | 0 | Sin upstream | — |
| origin/claude/eloquent-allen-jnjuvw | 64 | 0 | Sin upstream | — |
| origin/claude/fix-lint-ci | 64 | 0 | Sin upstream | — |
| origin/claude/fix-remaining-tests | 64 | 0 | Sin upstream | — |
| origin/claude/nostalgic-williamson-d2662e | 64 | 0 | Sin upstream | — |
| origin/claude/redesign-admin-analytics | 64 | 0 | Sin upstream | — |
| origin/codex/admin-finances | 64 | 0 | Sin upstream | — |
| origin/codex/beauty-services | 2 | 3 | Sin upstream | — |
| origin/codex/release-all-20261008 | 30 | 0 | Sin upstream | — |
| origin/download-changes | 64 | 0 | Sin upstream | — |
| origin/feature/marketplace-profile-sync | 64 | 0 | Sin upstream | — |
| origin/feature/organization-business-profile | 64 | 0 | Sin upstream | — |
| origin/feature/pos-product-credit | 64 | 0 | Sin upstream | — |
| origin/fix/private-repair-images | 64 | 0 | Sin upstream | — |
| origin/fix/server-only-cash-rpcs | 64 | 0 | Sin upstream | — |
| origin/fix/supabase-function-lint | 64 | 0 | Sin upstream | — |
| origin/fix/supabase-security-advisors | 64 | 0 | Sin upstream | — |
| origin/main | 0 | 0 | Sin upstream | — |
| origin/perf/audit-optimizations | 64 | 0 | Sin upstream | — |
| origin/security/private-tenant-isolation | 64 | 0 | Sin upstream | — |
| origin/update-nextjs-16.3 | 64 | 0 | Sin upstream | — |
| origin/v0/jeem101595-5934-0bd9f77c | 64 | 0 | Sin upstream | — |
| origin/v0/jeem101595-5934-1e756bc9 | 64 | 0 | Sin upstream | — |
| origin/v0/jeem101595-5934-41463777 | 64 | 0 | Sin upstream | — |
| origin/v0/jeem101595-5934-db9059c0 | 64 | 0 | Sin upstream | — |
| origin/v0/jeem101595-5934-df300f69 | 64 | 0 | Sin upstream | — |
| origin/v0/jeem101595-5934-f10e5218 | 64 | 0 | Sin upstream | — |
| origin/vercel/react-server-components-cve-vu-dz72if | 64 | 0 | Sin upstream | — |

## Redundancia y limpieza propuesta

29 ramas remotas apuntan exactamente a 97bc2ed7 y están 64 commits detrás de main; origin/codex/release-all-20261008 también está integrada (30 detrás). En total, 30 ramas remotas distintas de main no tienen commits exclusivos. No hace falta fusionarlas otra vez.

Orden recomendado: preservar/revisar los 5 worktrees pendientes; comparar el commit no equivalente de System Health; validar e integrar los 3 commits actuales mediante PR; actualizar main local por fast-forward; luego decidir qué ramas/worktrees antiguos archivar o eliminar, con autorización explícita. Antes de eliminar, revisar también PR abiertos, archivos ignorados y dependencias de otras tareas.

No se modificaron ramas, upstreams, commits ni archivos de aplicación. Solo se creó este informe. No se ejecutaron builds de todas las ramas ni se comprobó el estado actual de GitHub Actions o Vercel.

